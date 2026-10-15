// Edit in place: the owner layer on an organiser's LIVE public page. Loaded as
// a lazy chunk by src/pages/OrganiserProfile.tsx ONLY when ownershipFacts says
// canEdit (owner or manager); visitors, signed-out people and contributors
// never download it and see nothing new.
//
// Flow: a pencil (or the card's Add) opens a sheet for ONE field; its Done
// changes a LOCAL draft only; the sticky bar's ONE Save sends ONE call for every
// drafted field (draftModel.saveDrafts). Nothing is moderated: on success the
// change is live. The draft is kept in localStorage per organiser and survives
// leaving; leaving in-app with a draft asks first.
//
// It also carries the owner-only Create event links (into the organiser area's
// existing create flow, which makes a draft only), so a visitor downloads none
// of that either; and the Contact card + Contact details sheet, whose private
// read (get_organiser_contact_settings_v1) only this layer makes; and, for an
// owner or admin only (teamPickerAccess, from organiser_team_v1's my_role), the
// Team card and its "Add a person" picker (TeamSheet). Team adds are live once
// Done answers: team access is not page content, so it is not in the draft.
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { UNSAFE_DataRouterContext, UNSAFE_DataRouterStateContext, type Blocker, type BlockerFunction } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveCanonicalCity } from '@/lib/city-canonical';
import { searchCities as searchCityList } from '@/modules/organiser/home/onboarding/citySearch';
import { formFromEntity, type ProfileEntity } from '@/modules/organiser/profile/profileForm';
import { organiserEntityQueryKey } from '@/modules/profile/organiserPublicProfile';
import { fetchContactSettings, organiserContactSettingsQueryKey, organiserPublicContactQueryKey, type ContactSettings } from '@/modules/organiser/shared/ownershipApi';
import type { EditInPlaceLayerProps, EipBridge, EipSlot } from './bridge';
import {
  ADDED_MESSAGE,
  buildSavePatch,
  cardModel,
  draftCount,
  draftMatchesStored,
  fieldInPatch,
  londonTime,
  overlayFor,
  prunedDrafts,
  readStoredDraft,
  restoredMessage,
  saveDrafts,
  savedMessage,
  unsavedBarText,
  writeStoredDraft,
  type Drafts,
  type EditBase,
} from './draftModel';
import { FIELD_KEYS, FIELD_LABEL, type FieldKey } from './fieldRules';
import FieldSheet from './FieldSheet';
import ContactSheet from './ContactSheet';
import { ContactCard } from './ContactCard';
import { CONTACT_COPY, contactItems, isContactField, storedContactFromSettings } from './contactModel';
import type { CityLookups } from './cityCheck';
import { BAR_Z, BOTTOM_NAV_OFFSET, inBody } from './layers';
import { uploadOrganiserPhoto } from './organiserPhotoUploadApi';
import { ORGANISER_HOME_KEY } from '@/modules/organiser/shared/selfServeApi';
import { addTeamMemberByProfile, fetchOrganiserTeam, organiserTeamQueryKey, searchTeamPeople } from '@/modules/organiser/shared/teamRpcApi';
import { teamPickerAccess, type TeamMember, type TeamRole } from '@/modules/organiser/shared/teamModel';
import TeamSheet from './TeamSheet';
import { TeamCard } from './TeamCard';
import { SEARCH_LIMIT, addedMessage, teamCountLine, type AddOutcome, type AddRole } from './teamPickerModel';
import { AboutEmpty, AboutSlot, CompleteCard, CreateEventLink, CREAM, GOLD, INK, LAYER_CSS, LinkRows, MetaSlot, NameSlot, PhotoSlot, type OpenSheet } from './parts';

type Notice = { tone: 'gold' | 'ok' | 'error'; text: string };
type SaveClient = Parameters<typeof saveDrafts>[0];

export interface EditInPlaceLayerInternals {
  /** Injected by tests; the real client otherwise. */
  client?: SaveClient;
  uploadPhoto?: (organiserId: string, file: File) => Promise<string>;
  searchCities?: CityLookups['searchCities'];
  resolveCity?: CityLookups['resolveCity'];
  fetchContact?: (organiserId: string) => Promise<ContactSettings>;
  fetchTeam?: (organiserId: string) => Promise<{ myRole: TeamRole | 'admin' | null; members: TeamMember[] }>;
  searchPeople?: (organiserId: string, term: string) => Promise<unknown>;
  addPerson?: (organiserId: string, profileId: string, role: AddRole, reason: string | null) => Promise<unknown>;
}

const btn = { minHeight: 44, padding: '0 16px', borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: 'pointer' } as const;

export default function EditInPlaceLayer({ organiserId, entity, onBridge, userId, client, uploadPhoto, searchCities, resolveCity, fetchContact, fetchTeam, searchPeople, addPerson }: EditInPlaceLayerProps & EditInPlaceLayerInternals) {
  const queryClient = useQueryClient();
  // Who may add people (owner or admin), from the server's own answer; a manager or
  // contributor gets no Team card and no picker. A failed read shows nothing.
  const teamQuery = useQuery({
    queryKey: organiserTeamQueryKey(organiserId),
    queryFn: () => (fetchTeam ?? fetchOrganiserTeam)(organiserId),
    staleTime: 60 * 1000,
    retry: false,
  });
  const teamAccess = teamPickerAccess(teamQuery.data?.myRole);
  const teamLine = useMemo(() => {
    const members = teamQuery.data?.members ?? [];
    const n = (r: TeamRole) => members.filter((m) => m.role === r).length;
    return teamCountLine({ owner: n('owner'), manager: n('manager'), contributor: n('contributor') });
  }, [teamQuery.data]);
  const searchTeam = useCallback(
    (term: string) => (searchPeople ? searchPeople(organiserId, term) : searchTeamPeople(organiserId, term, SEARCH_LIMIT)),
    [searchPeople, organiserId],
  );
  const addToTeam = useCallback(
    (profileId: string, role: AddRole, reason: string | null) =>
      (addPerson ?? addTeamMemberByProfile)(organiserId, profileId, role, reason),
    [addPerson, organiserId],
  );
  // The owner's private contact details: read here only (this chunk is owner / manager only).
  const contactKey = useMemo(() => organiserContactSettingsQueryKey(organiserId, userId), [organiserId, userId]);
  const contactQuery = useQuery({
    queryKey: contactKey,
    queryFn: () => (fetchContact ?? fetchContactSettings)(organiserId),
    staleTime: 60 * 1000,
    // A failed read shows at once; the card's Try again reads again.
    retry: false,
  });
  const storedContact = useMemo(() => (contactQuery.data ? storedContactFromSettings(contactQuery.data) : null), [contactQuery.data]);
  const contactLoad = contactQuery.data ? 'ready' : contactQuery.isError ? 'failed' : 'loading';
  // What every draft is compared with and laid over: the row, plus the contact once loaded.
  const base = useMemo<EditBase>(() => ({ ...entity, contact: storedContact }), [entity, storedContact]);
  const saveClient: SaveClient = client ?? supabase;
  const upload = uploadPhoto ?? uploadOrganiserPhoto;
  const cityLookups = useMemo<CityLookups>(
    () => ({ searchCities: searchCities ?? searchCityList, resolveCity: resolveCity ?? resolveCanonicalCity }),
    [searchCities, resolveCity],
  );

  // A stored draft from an earlier visit, minus anything that is already on the page.
  const [restored] = useState<Drafts>(() => prunedDrafts(entity, readStoredDraft(organiserId)));
  const [drafts, setDrafts] = useState<Drafts>(restored);
  const [notice, setNotice] = useState<Notice | null>(() =>
    draftCount(restored) > 0 ? { tone: 'gold', text: restoredMessage(draftCount(restored)) } : null,
  );
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [sheet, setSheet] = useState<FieldKey | 'contact' | 'team' | null>(null);
  // City id -> name, for the drafted city shown in place (the stored one to start).
  const [cityNames, setCityNames] = useState<Record<string, string>>(() =>
    entity.city_id && entity.cities?.name ? { [entity.city_id]: entity.cities.name } : {},
  );
  // The server's refusal of a value (a taken name), shown in that field's sheet.
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, { value: string; message: string }>>>({});
  const openerRef = useRef<HTMLElement | null>(null);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const entityRef = useRef(base);
  entityRef.current = base;

  const count = draftCount(drafts);

  // The dock's real height (a long error notice wraps), for the room kept below the page.
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockHeight, setDockHeight] = useState(0);
  useEffect(() => {
    const el = dockRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setDockHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // The estimate covers the first frame (and browsers without ResizeObserver);
  // the measurement takes over once it lands, longer than the estimate or not.
  const estimate = (notice ? 72 : 0) + (count > 0 ? 64 : 0);
  const room = dockHeight > 0 ? Math.max(dockHeight, estimate) : estimate;

  useEffect(() => {
    writeStoredDraft(organiserId, drafts);
  }, [organiserId, drafts]);

  // A refetched row (or contact) that now carries a drafted value: that draft is done.
  useEffect(() => {
    setDrafts((d) => {
      const p = prunedDrafts(base, d);
      return draftCount(p) === draftCount(d) ? d : p;
    });
  }, [base]);

  // A restored City draft: look its name up once, so the page shows it in place.
  const draftedCity = drafts.city;
  const knownCity = draftedCity ? !!cityNames[draftedCity] : true;
  useEffect(() => {
    if (!draftedCity || knownCity) return;
    let live = true;
    cityLookups.resolveCity(draftedCity).then(
      (c) => { if (live && c) setCityNames((m) => ({ ...m, [c.cityId]: c.cityName })); },
      () => undefined, // the page shows no city name until it is known; Save still works
    );
    return () => { live = false; };
  }, [draftedCity, knownCity, cityLookups]);

  // Closing the tab or reloading with a draft. Some phone browsers ignore this;
  // the stored draft is the backstop.
  useEffect(() => {
    if (count === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [count]);

  const openSheet: OpenSheet = useCallback((field, opener) => {
    openerRef.current = opener ?? (document.activeElement as HTMLElement | null);
    setSheet(field);
  }, []);
  const openContact = useCallback((opener: HTMLElement) => {
    openerRef.current = opener;
    setSheet('contact');
  }, []);

  const openTeam = useCallback((opener: HTMLElement) => {
    openerRef.current = opener;
    setSheet('team');
  }, []);

  // Done in the team picker has asked the server: say who was added, then re-read the team.
  const onTeamAdded = useCallback((outcomes: AddOutcome[], role: AddRole) => {
    const text = addedMessage(outcomes, role);
    if (text) setNotice({ tone: 'ok', text });
    if (outcomes.some((o) => o.ok)) {
      void queryClient.invalidateQueries({ queryKey: organiserTeamQueryKey(organiserId) });
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    }
  }, [queryClient, organiserId]);

  const closeSheet = useCallback(() => {
    setSheet(null);
    const back = openerRef.current;
    // After the sheet unmounts, focus returns to the pencil (or Add) that opened it.
    setTimeout(() => {
      if (back && back.isConnected) back.focus();
    }, 0);
  }, []);

  const onDone = useCallback((field: FieldKey, value: string, label?: string) => {
    if (field === 'city' && value && label) setCityNames((m) => ({ ...m, [value]: label }));
    const same = draftMatchesStored(entityRef.current, field, value);
    setDrafts((d) => {
      const next = { ...d };
      if (same) delete next[field];
      else next[field] = value;
      return next;
    });
    setNotice(same ? { tone: 'gold', text: `No change: that ${FIELD_LABEL[field].toLowerCase()} is already on your page.` } : { tone: 'gold', text: ADDED_MESSAGE });
    closeSheet();
  }, [closeSheet]);

  // The Contact details sheet's Done: its keys are replaced as one (contactDraftsFor gives only the changed ones).
  const onContactDone = useCallback((next: Drafts) => {
    setDrafts((d) => {
      const out: Drafts = {};
      for (const k of FIELD_KEYS) if (!isContactField(k) && d[k] !== undefined) out[k] = d[k];
      return { ...out, ...next };
    });
    setNotice({ tone: 'gold', text: draftCount(next) === 0 ? CONTACT_COPY.noChange : ADDED_MESSAGE });
    closeSheet();
  }, [closeSheet]);

  const save = useCallback(async (): Promise<boolean> => {
    if (savingRef.current) return false; // double tap
    savingRef.current = true;
    setSaving(true);
    const sentDrafts = draftsRef.current;
    const sentEntity = entityRef.current;
    try {
      const outcome = await saveDrafts(saveClient, organiserId, sentEntity, sentDrafts);
      if (outcome.kind === 'nothing') {
        setDrafts({});
        setNotice({ tone: 'ok', text: 'Nothing to save: your page already shows these.' });
        return true;
      }
      if (outcome.kind !== 'saved') {
        // Never clear a draft on error.
        setNotice({ tone: 'error', text: outcome.message });
        if (outcome.kind === 'refused' && outcome.field && outcome.fieldError) {
          const f = outcome.field;
          // Not drafted (the save re-sends the stored name, which can collide too): the stored value.
          const refused = sentDrafts[f] ?? (f === 'city' ? sentEntity.city_id ?? '' : (formFromEntity(sentEntity)[f] as string) ?? '');
          setFieldErrors((m) => ({ ...m, [f]: { value: refused, message: outcome.fieldError! } }));
        }
        return false;
      }
      setFieldErrors({});
      // The server's stored row goes into the page's cache at once (no flash of
      // the old values), then the organiser is refetched.
      const key = organiserEntityQueryKey(organiserId);
      if (outcome.row) {
        const r = outcome.row;
        const cityId = (r.city_id ?? null) as string | null;
        queryClient.setQueryData(key, (old: ProfileEntity | null | undefined) => (old ? {
          ...old,
          name: (r.name ?? old.name) as string,
          city_id: cityId,
          cities: cityId === old.city_id ? old.cities : cityId && cityNames[cityId] ? { name: cityNames[cityId], slug: null } : null,
          avatar_url: (r.avatar_url ?? null) as string | null,
          bio: (r.bio ?? null) as string | null,
          instagram: (r.instagram ?? null) as string | null,
          website: (r.website ?? null) as string | null,
          organisation_category: (r.organisation_category ?? null) as string | null,
          founded_year: (r.founded_year ?? null) as number | null,
          socials: (r.socials ?? null) as ProfileEntity['socials'],
        } : old));
      }
      void queryClient.invalidateQueries({ queryKey: key });
      const sent = buildSavePatch(sentEntity, sentDrafts);
      // Contact: the saved values into the private read's cache at once, then both reads refetched.
      if (['contact_phone', 'show_phone_publicly', 'show_email_publicly'].some((k) => k in sent)) {
        queryClient.setQueryData(contactKey, (old: ContactSettings | undefined) => (old ? {
          ...old,
          ...('contact_phone' in sent ? { contact_phone: (sent.contact_phone ?? null) as string | null } : null),
          ...('show_phone_publicly' in sent ? { show_phone_publicly: sent.show_phone_publicly as boolean } : null),
          ...('show_email_publicly' in sent ? { show_email_publicly: sent.show_email_publicly as boolean } : null),
        } : old));
        void queryClient.invalidateQueries({ queryKey: contactKey });
        void queryClient.invalidateQueries({ queryKey: organiserPublicContactQueryKey(organiserId) });
      }
      // Clear ONLY the drafts that went out unchanged and came back as sent.
      setDrafts((cur) => {
        const next = { ...cur };
        for (const k of Object.keys(sentDrafts) as FieldKey[]) {
          if (cur[k] === sentDrafts[k] && !outcome.unmatched.includes(k)) delete next[k];
        }
        return next;
      });
      const time = londonTime();
      if (outcome.unmatched.length > 0) {
        const names = outcome.unmatched.map((k) => FIELD_LABEL[k]).join(', ');
        setNotice({ tone: 'error', text: `Saved at ${time}, but ${names} came back different from what you entered (we will show: ${outcome.unmatched.map((k) => String(fieldInPatch(sent, k) ?? 'empty')).join(', ')}). Check it and tap Save again.` });
      } else {
        setNotice({ tone: 'ok', text: savedMessage(time) });
      }
      return true;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [saveClient, organiserId, queryClient, cityNames, contactKey]);

  const discard = useCallback(() => {
    setDrafts({});
    writeStoredDraft(organiserId, {});
    setNotice({ tone: 'ok', text: 'Changes discarded. Your page is unchanged.' });
  }, [organiserId]);

  const overlay = useMemo(() => overlayFor(base, drafts, cityNames), [base, drafts, cityNames]);
  const contact = useMemo(() => (storedContact ? contactItems(storedContact, drafts) : null), [storedContact, drafts]);
  const refetchContact = contactQuery.refetch;
  const card = useMemo(() => cardModel(entity, drafts), [entity, drafts]);

  const bridge = useMemo<EipBridge>(() => {
    const has = (f: FieldKey) => drafts[f] !== undefined;
    const shown = { ...formFromEntity(entity), ...buildShown(entity, drafts) };
    const slot = (where: EipSlot) => {
      switch (where) {
        case 'card': return <CompleteCard model={card} onOpen={openSheet} />;
        case 'photo': return <PhotoSlot drafted={has('avatar_url')} onOpen={openSheet} />;
        case 'name': return <NameSlot drafted={has('name')} onOpen={openSheet} />;
        case 'meta': return (
          <MetaSlot
            year={overlay.founded_year !== undefined ? overlay.founded_year : entity.founded_year}
            category={overlay.organisation_category !== undefined ? overlay.organisation_category : entity.organisation_category}
            city={overlay.cities !== undefined ? overlay.cities?.name : entity.cities?.name}
            drafted={{ year: has('founded_year'), category: has('organisation_category'), city: has('city') }}
            onOpen={openSheet}
          />
        );
        case 'about': return <AboutSlot drafted={has('bio')} onOpen={openSheet} />;
        case 'about-empty': return <AboutEmpty />;
        case 'links': return (
          <LinkRows
            values={{ instagram: shown.instagram, facebook: shown.facebook, website: shown.website }}
            drafted={{ instagram: has('instagram'), facebook: has('facebook'), website: has('website') }}
            onOpen={openSheet}
          />
        );
        case 'contact': return <ContactCard load={contactLoad} items={contact} onEdit={openContact} onRetry={() => void refetchContact()} />;
        case 'team': return teamAccess ? <TeamCard countLine={teamLine} onAdd={openTeam} /> : null;
        case 'create-event': return <CreateEventLink organiserId={organiserId} label="Create event" />;
        case 'create-first-event': return <CreateEventLink organiserId={organiserId} label="Create your first event" />;
        case 'create-another-event': return <CreateEventLink organiserId={organiserId} label="Create an event" />;
      }
    };
    return { overlay, slot, mark: (f) => (has(f) ? 'eip-drafted' : undefined) };
  }, [entity, drafts, overlay, card, openSheet, organiserId, contact, contactLoad, openContact, refetchContact, teamAccess, teamLine, openTeam]);

  useEffect(() => {
    onBridge(bridge);
  }, [bridge, onBridge]);
  useEffect(() => () => onBridge(null), [onBridge]);

  const dataRouter = useContext(UNSAFE_DataRouterContext);
  const stored = (f: FieldKey): string => (f === 'city' ? entity.city_id ?? '' : (formFromEntity(entity)[f] as string) ?? '');
  const fieldSheet = sheet === 'contact' || sheet === 'team' ? null : sheet;
  const sheetInitial = fieldSheet ? (drafts[fieldSheet] ?? stored(fieldSheet)) : '';

  return (
    <>
      <style>{LAYER_CSS}</style>
      {sheet === 'contact' && storedContact && (
        <ContactSheet stored={storedContact} drafts={drafts} onDone={onContactDone} onClose={closeSheet} />
      )}
      {sheet === 'team' && teamAccess && (
        <TeamSheet access={teamAccess} organiserName={entity.name ?? ''} search={searchTeam} add={addToTeam} onAdded={onTeamAdded} onClose={closeSheet} />
      )}
      {fieldSheet && (
        <FieldSheet
          key={fieldSheet}
          field={fieldSheet}
          initial={sheetInitial}
          storedCategory={entity.organisation_category ?? null}
          initialCityName={fieldSheet === 'city' && sheetInitial ? cityNames[sheetInitial] ?? null : null}
          serverError={fieldErrors[fieldSheet] ?? null}
          onDone={(v, label) => onDone(fieldSheet, v, label)}
          onClose={closeSheet}
          uploadPhoto={(file) => upload(organiserId, file)}
          cityLookups={cityLookups}
        />
      )}
      {dataRouter && <LeaveGuard active={count > 0} onSave={save} onDiscard={discard} />}
      {/* Room at the very END of the page (after the footer), so at full scroll the
          bar and notice cover nothing: their height. */}
      {room > 0 && inBody(<div aria-hidden="true" data-testid="eip-spacer" style={{ height: `${room}px` }} />)}
      {/* In document.body (see layers.tsx), at the real bottom edge (the section row is under the header now). */}
      {inBody(
      <div ref={dockRef} data-testid="eip-dock" style={{ position: 'fixed', left: 0, right: 0, bottom: `calc(${BOTTOM_NAV_OFFSET})`, zIndex: BAR_Z, pointerEvents: 'none' }}>
        <div aria-live="polite" role="status" style={{ pointerEvents: 'auto' }}>
          {notice && (
            <div data-testid="eip-notice" data-tone={notice.tone} style={{ margin: '0 8px 6px', padding: '8px 12px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.35, display: 'flex', gap: 8, alignItems: 'center', background: notice.tone === 'error' ? '#3A1712' : '#1E1A12', color: notice.tone === 'error' ? '#FFB4A2' : GOLD, border: `1px solid ${notice.tone === 'error' ? 'rgba(255,138,112,0.5)' : 'rgba(231,190,110,0.5)'}` }}>
              <span style={{ flex: 1 }}>{notice.text}</span>
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message" style={{ minWidth: 44, minHeight: 44, background: 'none', border: 'none', color: 'inherit', fontSize: 18, cursor: 'pointer' }}>&times;</button>
            </div>
          )}
        </div>
        {count > 0 && (
          <div role="region" aria-label="Unsaved changes" data-testid="eip-bar" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: INK, borderTop: `1px solid ${GOLD}`, color: CREAM }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }} data-testid="eip-bar-count">{unsavedBarText(count)}</span>
            <button type="button" onClick={discard} disabled={saving} style={{ ...btn, background: 'none', border: '1px solid rgba(246,241,234,0.3)', color: CREAM }}>Discard</button>
            <button type="button" onClick={() => void save()} disabled={saving} aria-disabled={saving} style={{ ...btn, background: GOLD, border: 'none', color: INK, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving\u2026' : 'Save'}
            </button>
          </div>
        )}
      </div>,
      )}
    </>
  );
}

/** The values the owner's link rows show: the draft (as it will be saved) over the stored form. */
function buildShown(entity: ProfileEntity, drafts: Drafts): Partial<Record<'instagram' | 'facebook' | 'website', string>> {
  const patch = buildSavePatch(entity, drafts);
  const out: Partial<Record<'instagram' | 'facebook' | 'website', string>> = {};
  for (const f of ['instagram', 'facebook', 'website'] as const) {
    if (drafts[f] !== undefined) out[f] = String(fieldInPatch(patch, f) ?? '');
  }
  return out;
}

const IDLE_BLOCKER = { state: 'unblocked', proceed: undefined, reset: undefined, location: undefined } as Blocker;
let blockerSeq = 0;

/**
 * react-router's useBlocker, rebuilt on the router's own getBlocker/deleteBlocker.
 * Importing useBlocker itself puts its code in the SHARED react-router chunk,
 * which is on every route's first load (+0.3 KB gz, measured: /classes went
 * over its perf-budgets.json budget). Here it stays in this lazy owner chunk.
 * The predicate compares pathnames only, so react-router's basename strip is
 * not needed (the site has no basename either).
 */
function useLeaveBlocker(shouldBlock: BlockerFunction): Blocker {
  const router = useContext(UNSAFE_DataRouterContext)?.router;
  const blockers = useContext(UNSAFE_DataRouterStateContext)?.blockers;
  const [key, setKey] = useState('');
  useEffect(() => {
    if (!router) return;
    const k = `eip-${++blockerSeq}`;
    setKey(k);
    return () => router.deleteBlocker(k);
  }, [router]);
  useEffect(() => {
    if (router && key) router.getBlocker(key, shouldBlock);
  }, [router, key, shouldBlock]);
  return (key && blockers?.get(key)) || IDLE_BLOCKER;
}

/**
 * Leaving in-app (the back link, any route change) with a draft. Only mounted
 * under a data router (the blocker needs one); the public page always is one.
 */
function LeaveGuard({ active, onSave, onDiscard }: { active: boolean; onSave: () => Promise<boolean>; onDiscard: () => void }): ReactNode {
  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) => active && currentLocation.pathname !== nextLocation.pathname,
    [active],
  );
  const blocker = useLeaveBlocker(shouldBlock);
  const firstRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const blocked = blocker.state === 'blocked';
  useEffect(() => {
    if (blocked) firstRef.current?.focus();
  }, [blocked]);
  if (!blocked) return null;
  const stay = () => blocker.reset?.();
  return inBody(
    <>
      <div aria-hidden="true" onClick={stay} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.6)' }} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="eip-leave-title"
        aria-describedby="eip-leave-desc"
        data-testid="eip-leave"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); stay(); } }}
        style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 71, maxWidth: 440, margin: '0 auto', padding: 16, borderRadius: 16, background: '#17131A', color: CREAM, border: '1px solid rgba(231,190,110,0.4)' }}
      >
        <h2 id="eip-leave-title" style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>You have changes that are not saved</h2>
        <p id="eip-leave-desc" style={{ margin: '0 0 12px', fontSize: 13.5, color: 'rgba(246,241,234,0.75)' }}>They are not on your page yet.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button ref={firstRef} type="button" disabled={busy} onClick={async () => {
            setBusy(true);
            const ok = await onSave();
            setBusy(false);
            if (ok) blocker.proceed?.();
            else stay();
          }} style={{ ...btn, background: GOLD, color: INK, border: 'none' }}>{busy ? 'Saving\u2026' : 'Save and leave'}</button>
          <button type="button" disabled={busy} onClick={() => blocker.proceed?.()} style={{ ...btn, background: 'none', color: CREAM, border: '1px solid rgba(246,241,234,0.3)' }}>Leave, keep draft</button>
          <button type="button" disabled={busy} onClick={() => { onDiscard(); blocker.proceed?.(); }} style={{ ...btn, background: 'none', color: '#FFB4A2', border: '1px solid rgba(255,138,112,0.4)' }}>Discard changes</button>
          <button type="button" disabled={busy} onClick={stay} style={{ ...btn, background: 'none', color: CREAM, border: 'none' }}>Stay here</button>
        </div>
      </div>
    </>,
  );
}
