import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { MouseEvent } from 'react';
import { ChevronLeft } from 'lucide-react';
import { GhostButton, PrimaryButton, SheetView } from '@/modules/organiser/ui';
import { useLeaveGuard } from '../../shell/leaveGuard';
import { useMutation } from '@tanstack/react-query';
import { CityPicker } from '@/components/ui/city-picker';
import { NationalityPicker } from '@/components/ui/nationality-picker';
import { HideSurnameSwitch, hideSurnameDisabledReason } from '@/components/profile/HideSurnameSwitch';
import { FAVORITE_STYLE_OPTIONS } from '@/components/profile/dancerConstants';
import { toast } from '@/hooks/use-toast';
import { saveMyDancerProfile } from '../../api/rpc';
import { toDancerError } from '../../api/errors';
import { ADD_CITY_MESSAGE, dancerMessageUsUrl } from '../../api/messageUs';
import type { DancerDelta, MyDancerEdit } from '../../api/types';
import {
  BIO_MAX,
  DISPLAY_NAME_MAX,
  PHOTO_PATH,
  ROLE_CHOICES,
  YEAR_BANDS,
  bandForYear,
  buildDelta,
  draftFromProfile,
  fieldForKey,
  profileName,
  saveDisabledReason,
  storedValueHints,
  validateDraft,
  yearForBand,
  type EditDraft,
  type FormFieldId,
  type YearBand,
} from '../me/model';
import { useMyDancerEdit, usePutMyDancerEdit } from '../../api/useMyDancerEdit';
import { Avatar, QueryGate, ghostButton, mainButton } from '../me/ui';
import { ChipChoice, ChipListInput, Field, TextInput, inputStyle } from './fields';
import { SAVE_DONE, chipFor, nationalityCodeForPick, styleChipOptions } from './editModel';

type ServerErrors = Partial<Record<FormFieldId, string>>;

/** Where a server error belongs. A code the client did not predict (no field) goes to the top with Retry. */
const placeServerError = (err: unknown, delta: DancerDelta): { field: ServerErrors; top: string | null } => {
  const e = toDancerError(err);
  let fields: FormFieldId[] = [];
  if (e.field) fields = [fieldForKey(e.field)].filter((f): f is FormFieldId => f !== null);
  // invalid_handle names no field in the code map; the delta says which handle(s) were sent.
  else if (e.code === 'invalid_handle') fields = (['instagram', 'facebook'] as const).filter((k) => k in delta);
  if (fields.length === 0) return { field: {}, top: e.message };
  return { field: Object.fromEntries(fields.map((f) => [f, e.message])), top: null };
};

/** The hide-surname switch: the EXISTING component, written through its own immediate save. The form never owns this key. */
const HideSurnameRow = ({ profile }: { profile: MyDancerEdit }) => {
  const put = usePutMyDancerEdit();
  const m = useMutation({
    mutationFn: (hide: boolean) => saveMyDancerProfile({ hide_surname_publicly: hide }, profile),
    onSuccess: (next) => put(next),
  });
  const reason = hideSurnameDisabledReason({
    isSaving: m.isPending,
    firstName: profile.first_name ?? '',
    cityId: profile.based_city_id ?? '',
    switchReadable: true,
  });
  return (
    <div data-testid="edit-hide-surname" style={{ display: 'grid', gap: 4 }}>
      <HideSurnameSwitch checked={profile.hide_surname_publicly} onChange={(next) => m.mutate(next)} disabledReason={reason} />
      {m.isError && (
        <p role="alert" data-testid="error-hide_surname_publicly" style={{ fontSize: 13, margin: 0, color: 'var(--da-danger)' }}>
          {toDancerError(m.error).message}
        </p>
      )}
    </div>
  );
};

const FOCUS_IDS: Record<string, string> = {
  first_name: 'first_name',
  city: 'based_city_id',
  role: 'dance_role',
  year: 'dance_started_year',
  styles: 'favorite_styles',
  bio: 'bio',
  instagram: 'instagram',
};

const EditForm = ({ profile }: { profile: MyDancerEdit }) => {
  const put = usePutMyDancerEdit();
  const [search] = useSearchParams();
  const [draft, setDraft] = useState<EditDraft>(() => draftFromProfile(profile));
  const [serverErrors, setServerErrors] = useState<ServerErrors>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // The draft a save was sent from: a draft edited while the save was in flight is kept (review S1).
  const sentDraft = useRef<EditDraft | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const set = <K extends keyof EditDraft>(key: K, value: EditDraft[K]) => {
    setSaved(false);
    setServerErrors((e) => ({ ...e, [key]: undefined }));
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const errors = useMemo(() => validateDraft(draft, profile), [draft, profile]);
  const hints = useMemo(() => storedValueHints(draft, profile), [draft, profile]);
  const delta = useMemo(() => buildDelta(profile, draft), [profile, draft]);

  const mutation = useMutation({
    mutationFn: (d: DancerDelta) => saveMyDancerProfile(d, profile),
    onSuccess: (next) => {
      put(next);
      // Untouched since it was sent: take the server shape. Edited meanwhile: keep the newer input;
      // the next delta is computed against the server's new shape, so nothing is sent twice.
      if (draftRef.current === sentDraft.current) setDraft(draftFromProfile(next));
      setServerErrors({});
      setTopError(null);
      setSaved(true);
      toast({ title: SAVE_DONE });
    },
    onError: (err, d) => {
      const placed = placeServerError(err, d);
      setServerErrors(placed.field);
      setTopError(placed.top);
    },
  });

  // D119: leaving with unsaved edits asks first. Every way out (back buttons, the tabs, the home link) shares this one guard.
  const navigate = useNavigate();
  const dirty = Object.keys(delta).length > 0;
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  useLeaveGuard((to) => {
    if (!dirtyRef.current) return true;
    setLeaveTo(to);
    return false;
  });
  const leave = (to: string) => (e: MouseEvent) => {
    if (!dirtyRef.current) return;
    e.preventDefault();
    setLeaveTo(to);
  };

  const reason = saveDisabledReason(delta, errors, mutation.isPending);
  // A programmatic submit with an empty delta sends NO request (the button is also disabled).
  const submit = () => {
    if (reason !== null) return;
    sentDraft.current = draft;
    setTopError(null);
    mutation.mutate(delta);
  };

  // ?focus=city etc. from the Me screen's main button.
  const focusParam = search.get('focus');
  useEffect(() => {
    const id = focusParam ? FOCUS_IDS[focusParam] : null;
    if (!id) return;
    const el = document.getElementById(id);
    const target = el?.matches('input,textarea,button') ? el : el?.querySelector<HTMLElement>('input,textarea,button');
    target?.focus();
    el?.scrollIntoView?.({ block: 'center' });
  }, [focusParam]);

  const shown = (f: FormFieldId): string | null => serverErrors[f] ?? errors[f] ?? null;
  const note = (f: FormFieldId): string | null => hints[f] ?? null;
  const eligibleWhatsapp = profile.other_roles.length > 0;
  // Real-data fix F3: the switch controls nothing without a number, so it is disabled with the reason.
  const hasNumber = draft.whatsapp.trim() !== '';
  const bandNow = bandForYear(draft.dance_started_year);
  const savedBand = bandForYear(profile.dance_started_year);
  const styleChips = useMemo(
    () => styleChipOptions(FAVORITE_STYLE_OPTIONS, profile.favorite_styles, draft.favorite_styles),
    [draft.favorite_styles, profile.favorite_styles],
  );
  const styleOptions = useMemo(() => styleChips.map((s) => ({ value: s, label: s })), [styleChips]);
  const selectedStyles = draft.favorite_styles.map((s) => chipFor(styleChips, s));
  const bioLen = draft.bio.length;

  return (
    <form
      data-testid="dancer-screen-edit"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      style={{ display: 'grid', gap: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Link to="/app/me" onClick={leave('/app/me')} className="da-tap" aria-label="Back" data-testid="edit-header-back" style={{ flex: '0 0 44px' }}>
          <ChevronLeft aria-hidden="true" style={{ width: 24, height: 24 }} />
        </Link>
        <h1 className="da-muted" style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Edit my profile</h1>
      </div>

      {topError && (
        <div className="da-card" role="alert" data-testid="edit-top-error" style={{ borderColor: 'var(--da-danger)' }}>
          <p style={{ fontSize: 14, margin: '0 0 8px' }}>{topError}</p>
          <button type="button" className="da-tap" style={{ ...ghostButton, minHeight: 44 }} onClick={submit} data-testid="edit-retry">
            Try again
          </button>
        </div>
      )}

      <div className="da-card" style={{ display: 'grid', gap: 14, borderTop: '3px solid var(--da-accent)' }}>
        <div data-testid="edit-photo-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar profile={profile} size={64} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, margin: 0, overflowWrap: 'anywhere' }}>{profileName(profile)}</p>
            <Link to={`${PHOTO_PATH}?return=/app/me/edit`} className="da-tap" style={{ color: 'var(--da-accent)', fontWeight: 700, fontSize: 15, justifyContent: 'flex-start' }} data-testid="edit-change-photo">
              {profile.avatar_url ? 'Change photo' : 'Add photo'}
            </Link>
          </div>
        </div>
        {shown('avatar_url') && <p role="alert" style={{ fontSize: 13, margin: 0, color: 'var(--da-danger)' }}>{shown('avatar_url')}</p>}

        <Field id="display_name" label="Display name" hint="(shown on your page)" error={shown('display_name')} note={note('display_name')}>
          <TextInput id="display_name" value={draft.display_name} maxLength={DISPLAY_NAME_MAX + 20} onChange={(v) => set('display_name', v)} error={shown('display_name')} />
        </Field>

        <Field id="first_name" label="First name" error={shown('first_name')}>
          <TextInput id="first_name" value={draft.first_name} autoComplete="given-name" onChange={(v) => set('first_name', v)} error={shown('first_name')} />
        </Field>

        <Field id="surname" label="Surname" hint="(optional)" error={shown('surname')}>
          <TextInput id="surname" value={draft.surname} autoComplete="family-name" onChange={(v) => set('surname', v)} error={shown('surname')} />
        </Field>
        <HideSurnameRow profile={profile} />

        <Field id="based_city_id" label="City" error={shown('based_city_id')}>
          <CityPicker id="based_city_id" value={draft.based_city_id || undefined} onChange={(id) => set('based_city_id', id)} placeholder="Pick your city" className="min-h-[48px] w-full" />
          {/* Audit M28: the picker's own city request is switched off; this is the way on. */}
          <p className="da-muted" style={{ fontSize: 14, margin: 0 }}>
            City not in the list?{' '}
            <a
              href={dancerMessageUsUrl(ADD_CITY_MESSAGE)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="edit-add-city"
              style={{ textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
            >
              Message us to add your city
            </a>
          </p>
        </Field>

        <Field id="dance_role" label="I dance as" error={shown('dance_role')}>
          <ChipChoice
            id="dance_role"
            options={ROLE_CHOICES}
            selected={draft.dance_role ? [draft.dance_role] : []}
            onToggle={(v) => set('dance_role', draft.dance_role === v ? null : v)}
          />
        </Field>

        <Field id="nationality" label="Nationality" error={shown('nationality')}>
          <NationalityPicker id="nationality" value={draft.nationality || undefined} onChange={(pick) => set('nationality', nationalityCodeForPick(pick))} className="min-h-[48px] w-full" />
        </Field>

        <Field id="languages" label="Languages" hint="(separate with commas)" error={shown('languages')}>
          <TextInput id="languages" value={draft.languages} placeholder="English, Spanish" onChange={(v) => set('languages', v)} error={shown('languages')} />
        </Field>

        <Field id="dance_started_year" label="Dancing since" error={shown('dance_started_year')}>
          <ChipChoice<YearBand>
            id="dance_started_year"
            options={YEAR_BANDS.map((b) => ({ value: b.id, label: b.label }))}
            selected={bandNow ? [bandNow] : []}
            onToggle={(band) => {
              if (band === bandNow) return set('dance_started_year', null);
              // Choosing the band the saved year is already in keeps the saved year (no change sent).
              set('dance_started_year', band === savedBand && profile.dance_started_year !== null ? profile.dance_started_year : yearForBand(band));
            }}
          />
        </Field>

        <Field id="favorite_styles" label="Favourite styles" error={shown('favorite_styles')}>
          <ChipChoice
            id="favorite_styles"
            options={styleOptions}
            selected={selectedStyles}
            onToggle={(s) =>
              set(
                'favorite_styles',
                selectedStyles.includes(s) ? draft.favorite_styles.filter((x) => chipFor(styleChips, x) !== s) : [...draft.favorite_styles, s],
              )
            }
          />
        </Field>

        <Field id="favorite_songs" label="Favourite songs" error={shown('favorite_songs')}>
          <ChipListInput id="favorite_songs" value={draft.favorite_songs} onChange={(v) => set('favorite_songs', v)} placeholder="Add a song" />
        </Field>

        <Field id="achievements" label="Achievements" error={shown('achievements')}>
          <ChipListInput id="achievements" value={draft.achievements} onChange={(v) => set('achievements', v)} placeholder="Add an achievement" />
        </Field>

        <Field id="bio" label="About me" error={shown('bio')} note={note('bio')}>
          <textarea
            id="bio"
            value={draft.bio}
            rows={4}
            aria-invalid={shown('bio') ? true : undefined}
            aria-describedby={shown('bio') ? 'bio-error bio-count' : 'bio-count'}
            onChange={(e) => set('bio', e.target.value)}
            style={{ ...inputStyle, minHeight: 96, padding: 12, resize: 'vertical', borderColor: shown('bio') ? 'var(--da-danger)' : 'var(--da-border)' }}
          />
          <p id="bio-count" data-testid="bio-count" className="da-muted" style={{ fontSize: 13, margin: 0, textAlign: 'right' }}>
            {bioLen}/{BIO_MAX}
          </p>
        </Field>

        <Field id="instagram" label="Instagram" error={shown('instagram')} note={note('instagram')}>
          <TextInput id="instagram" value={draft.instagram} placeholder="your.handle" onChange={(v) => set('instagram', v)} error={shown('instagram')} />
        </Field>
        <Field id="facebook" label="Facebook" error={shown('facebook')} note={note('facebook')}>
          <TextInput id="facebook" value={draft.facebook} placeholder="your.handle" onChange={(v) => set('facebook', v)} error={shown('facebook')} />
        </Field>
        <Field id="website_url" label="Website" error={shown('website_url')} note={note('website_url')}>
          <TextInput id="website_url" type="url" inputMode="url" value={draft.website_url} placeholder="https://" onChange={(v) => set('website_url', v)} error={shown('website_url')} />
        </Field>

        {eligibleWhatsapp && (
          <div data-testid="edit-whatsapp" style={{ display: 'grid', gap: 10 }}>
            <Field id="whatsapp" label="WhatsApp" hint="(number with country code)" error={shown('whatsapp')} note={note('whatsapp')}>
              <TextInput id="whatsapp" type="tel" inputMode="tel" value={draft.whatsapp} placeholder="+44 7700 900123" onChange={(v) => set('whatsapp', v)} error={shown('whatsapp')} />
            </Field>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 }}>
              <label htmlFor="show_whatsapp_publicly" style={{ fontSize: 15, fontWeight: 600 }}>Show my WhatsApp on my page</label>
              <button
                id="show_whatsapp_publicly"
                type="button"
                role="switch"
                aria-checked={draft.show_whatsapp_publicly}
                disabled={!hasNumber}
                aria-describedby={hasNumber ? undefined : 'whatsapp-switch-reason'}
                onClick={() => set('show_whatsapp_publicly', !draft.show_whatsapp_publicly)}
                style={{
                  width: 56, height: 44, borderRadius: 999, flex: '0 0 auto', cursor: hasNumber ? 'pointer' : 'not-allowed', opacity: hasNumber ? 1 : 0.5,
                  border: '1px solid var(--da-border)',
                  background: draft.show_whatsapp_publicly ? 'var(--da-accent)' : 'var(--da-surface-2)',
                  color: draft.show_whatsapp_publicly ? 'var(--da-on-accent)' : 'var(--da-text)', fontWeight: 700,
                }}
              >
                {draft.show_whatsapp_publicly ? 'On' : 'Off'}
              </button>
            </div>
            {!hasNumber && (
              <p id="whatsapp-switch-reason" data-testid="whatsapp-switch-reason" style={{ fontSize: 14, margin: 0, color: 'var(--da-warn, #F2B84B)' }}>
                Add your number above to show it on your page.
              </p>
            )}
            <p className="da-muted" style={{ fontSize: 13, margin: 0 }}>
              WhatsApp is only for people who also teach, DJ or organise, so students and partners can reach you. It shows on your page only while this is on.
            </p>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <button type="submit" disabled={reason !== null} aria-describedby="save-reason" data-testid="edit-save" className="da-tap" style={{ ...mainButton, opacity: reason !== null ? 0.5 : 1, cursor: reason !== null ? 'not-allowed' : 'pointer' }}>
          Save changes
        </button>
        {reason !== null && (
          <p id="save-reason" data-testid="edit-save-reason" style={{ fontSize: 14, margin: 0, color: 'var(--da-warn, #F2B84B)' }}>
            {reason}
          </p>
        )}
        {saved && reason !== null && !mutation.isPending && (
          <p role="status" data-testid="edit-saved" style={{ fontSize: 14, margin: 0 }}>{SAVE_DONE}</p>
        )}
        <Link to="/app/me" onClick={leave('/app/me')} className="da-tap" style={ghostButton}>Back to Me</Link>
      </div>
      <SheetView open={leaveTo !== null} onOpenChange={(o) => !o && setLeaveTo(null)} title="Discard changes?" description="You have changes that are not saved yet.">
        <div style={{ display: 'grid', gap: 8 }}>
          <PrimaryButton onClick={() => setLeaveTo(null)}>Keep editing</PrimaryButton>
          <GhostButton
            onClick={() => {
              const to = leaveTo;
              setLeaveTo(null);
              if (to) navigate(to);
            }}
          >
            Discard
          </GhostButton>
        </div>
      </SheetView>
    </form>
  );
};

const EditScreen = () => {
  const q = useMyDancerEdit();
  const gate = QueryGate({ q, id: 'edit' });
  if (gate) return <>{gate}</>;
  // Remount the form only for another person; a save or the hide-surname switch updates the cache in place.
  return <EditForm key={q.data!.profile_id} profile={q.data!} />;
};

export default EditScreen;
