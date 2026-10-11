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
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { UNSAFE_DataRouterContext, UNSAFE_DataRouterStateContext, type Blocker, type BlockerFunction } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formFromEntity, type ProfileEntity } from '@/modules/organiser/profile/profileForm';
import { organiserEntityQueryKey } from '@/modules/profile/organiserPublicProfile';
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
} from './draftModel';
import { FIELD_LABEL, type FieldKey } from './fieldRules';
import FieldSheet from './FieldSheet';
import { BAR_Z, BOTTOM_NAV_OFFSET, inBody } from './layers';
import { uploadOrganiserPhoto } from './organiserPhotoUploadApi';
import { AboutEmpty, AboutSlot, CompleteCard, CREAM, GOLD, INK, LAYER_CSS, LinkRows, MetaSlot, PhotoSlot, type OpenSheet } from './parts';

type Notice = { tone: 'gold' | 'ok' | 'error'; text: string };
type SaveClient = Parameters<typeof saveDrafts>[0];

export interface EditInPlaceLayerInternals {
  /** Injected by tests; the real client otherwise. */
  client?: SaveClient;
  uploadPhoto?: (organiserId: string, file: File) => Promise<string>;
}

const btn = { minHeight: 44, padding: '0 16px', borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: 'pointer' } as const;

export default function EditInPlaceLayer({ organiserId, entity, onBridge, client, uploadPhoto }: EditInPlaceLayerProps & EditInPlaceLayerInternals) {
  const queryClient = useQueryClient();
  const saveClient: SaveClient = client ?? supabase;
  const upload = uploadPhoto ?? uploadOrganiserPhoto;

  // A stored draft from an earlier visit, minus anything that is already on the page.
  const [restored] = useState<Drafts>(() => prunedDrafts(entity, readStoredDraft(organiserId)));
  const [drafts, setDrafts] = useState<Drafts>(restored);
  const [notice, setNotice] = useState<Notice | null>(() =>
    draftCount(restored) > 0 ? { tone: 'gold', text: restoredMessage(draftCount(restored)) } : null,
  );
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [sheet, setSheet] = useState<FieldKey | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const entityRef = useRef(entity);
  entityRef.current = entity;

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

  // A refetched row that now carries a drafted value: that draft is done.
  useEffect(() => {
    setDrafts((d) => {
      const p = prunedDrafts(entity, d);
      return draftCount(p) === draftCount(d) ? d : p;
    });
  }, [entity]);

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

  const closeSheet = useCallback(() => {
    setSheet(null);
    const back = openerRef.current;
    // After the sheet unmounts, focus returns to the pencil (or Add) that opened it.
    setTimeout(() => {
      if (back && back.isConnected) back.focus();
    }, 0);
  }, []);

  const onDone = useCallback((field: FieldKey, value: string) => {
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
        return false;
      }
      // The server's stored row goes into the page's cache at once (no flash of
      // the old values), then the organiser is refetched.
      const key = organiserEntityQueryKey(organiserId);
      if (outcome.row) {
        const r = outcome.row;
        queryClient.setQueryData(key, (old: ProfileEntity | null | undefined) => (old ? {
          ...old,
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
  }, [saveClient, organiserId, queryClient]);

  const discard = useCallback(() => {
    setDrafts({});
    writeStoredDraft(organiserId, {});
    setNotice({ tone: 'ok', text: 'Changes discarded. Your page is unchanged.' });
  }, [organiserId]);

  const overlay = useMemo(() => overlayFor(entity, drafts), [entity, drafts]);
  const card = useMemo(() => cardModel(entity, drafts), [entity, drafts]);

  const bridge = useMemo<EipBridge>(() => {
    const has = (f: FieldKey) => drafts[f] !== undefined;
    const shown = { ...formFromEntity(entity), ...buildShown(entity, drafts) };
    const slot = (where: EipSlot) => {
      switch (where) {
        case 'card': return <CompleteCard model={card} onOpen={openSheet} />;
        case 'photo': return <PhotoSlot drafted={has('avatar_url')} onOpen={openSheet} />;
        case 'meta': return (
          <MetaSlot
            year={overlay.founded_year !== undefined ? overlay.founded_year : entity.founded_year}
            category={overlay.organisation_category !== undefined ? overlay.organisation_category : entity.organisation_category}
            drafted={{ year: has('founded_year'), category: has('organisation_category') }}
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
      }
    };
    return { overlay, slot, mark: (f) => (has(f) ? 'eip-drafted' : undefined) };
  }, [entity, drafts, overlay, card, openSheet]);

  useEffect(() => {
    onBridge(bridge);
  }, [bridge, onBridge]);
  useEffect(() => () => onBridge(null), [onBridge]);

  const dataRouter = useContext(UNSAFE_DataRouterContext);
  const sheetInitial = sheet ? (drafts[sheet] ?? (formFromEntity(entity)[sheet] as string) ?? '') : '';

  return (
    <>
      <style>{LAYER_CSS}</style>
      {sheet && (
        <FieldSheet
          key={sheet}
          field={sheet}
          initial={sheetInitial}
          storedCategory={entity.organisation_category ?? null}
          onDone={(v) => onDone(sheet, v)}
          onClose={closeSheet}
          uploadPhoto={(file) => upload(organiserId, file)}
        />
      )}
      {dataRouter && <LeaveGuard active={count > 0} onSave={save} onDiscard={discard} />}
      {/* Room at the very END of the page (after the footer and AppChrome's
          64px + safe-area nav spacer), so at full scroll the bar and notice
          cover nothing: their height plus what the bar's offset adds over 64px. */}
      {room > 0 && inBody(<div aria-hidden="true" data-testid="eip-spacer" style={{ height: `calc(${room}px + var(--bottom-nav-h, 68px) - 64px)` }} />)}
      {/* In document.body (see layers.tsx), sitting ON TOP of the BottomNav's
          row, never under it: the nav is on every organiser page at every width
          (AppChrome hides it only on the home map), so the offset is constant. */}
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
