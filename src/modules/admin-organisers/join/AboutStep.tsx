// "A bit about you", inline on the invite page (Option B): first name, city, dance role and photo, the
// SAME four fields and the same save as /finish-profile (saveMyDancerProfile; the server's
// profile_complete_v1 is the one definition of complete). Only the missing fields are asked; a linked
// pre-made profile that lacks one thing asks for that one thing. Nothing is saved until Continue.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CityPicker } from '@/components/ui/city-picker';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { DanceRolePicker } from '@/components/profile/DanceRolePicker';
import type { DanceRoleValue } from '@/lib/auth-otp-routing';
import { MY_DANCER_SUMMARY_ROOT } from '@/lib/myPersona';
import { PROFILE_FIELDS, listFieldLabels, type ProfileCompletion, type ProfileField } from '@/lib/profileCompletion';
import { saveMyDancerProfile, type SaveMyDancerProfileInput } from '@/lib/saveMyDancerProfile';
import { JOIN_COPY } from './joinCopy';
import type { JoinPreview } from './joinModel';
import { BTN, ErrorLine, FIELD, Lead, WHY } from './JoinScreens';

type Draft = Record<ProfileField, string>;

/** The fields still to add, in screen order. An "incomplete" answer with an empty list asks for everything (mirror drift). */
export const fieldsToAsk = (completion: Pick<ProfileCompletion, 'missing'>): ProfileField[] =>
  completion.missing.length > 0 ? PROFILE_FIELDS.filter((f) => completion.missing.includes(f)) : [...PROFILE_FIELDS];

/** The save payload: only the asked fields, only when every one of them is filled; null while something is missing. */
export function buildAboutSave(fields: readonly ProfileField[], draft: Draft): SaveMyDancerProfileInput | null {
  const out: SaveMyDancerProfileInput = {};
  for (const f of fields) {
    const v = draft[f].trim();
    if (!v) return null;
    out[f] = v;
  }
  return fields.length > 0 ? out : null;
}

export const stillMissing = (fields: readonly ProfileField[], draft: Draft): ProfileField[] => fields.filter((f) => !draft[f].trim());

export function AboutStep({ completion, preview, linked, onSaved }: {
  completion: Pick<ProfileCompletion, 'missing' | 'profileId'>;
  preview: JoinPreview;
  /** The claim just linked an existing profile: say so, and ask only for the gap. */
  linked: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const fields = fieldsToAsk(completion);
  const [draft, setDraft] = useState<Draft>({
    first_name: preview.prefillFirstName ?? '',
    based_city_id: preview.prefillCityId ?? '',
    dance_role: '',
    avatar_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const set = (key: ProfileField, value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const pending = buildAboutSave(fields, draft);
  const missing = stillMissing(fields, draft);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await saveMyDancerProfile(pending);
      // The dancer home's summary (name, city, role, photo) read the row before this save.
      void queryClient.invalidateQueries({ queryKey: [MY_DANCER_SUMMARY_ROOT] });
      await onSaved();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" noValidate onSubmit={(e) => void save(e)} data-testid="join-about-form">
      {linked && <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-[13px]" role="status" data-testid="join-about-linked">{JOIN_COPY.about.linked}</p>}
      <Lead testId="join-about-lead">{linked && fields.length < PROFILE_FIELDS.length ? JOIN_COPY.about.missing(fields.length) : JOIN_COPY.about.lead}</Lead>

      {fields.includes('first_name') && (
        <div className="flex flex-col gap-1">
          <label htmlFor="join-first-name" className="text-[14px] font-semibold">{JOIN_COPY.about.firstName}</label>
          <input id="join-first-name" autoComplete="given-name" className={FIELD} value={draft.first_name} onChange={(e) => set('first_name', e.target.value)} data-testid="join-about-first-name" />
        </div>
      )}
      {fields.includes('based_city_id') && (
        <div className="flex flex-col gap-1">
          <label htmlFor="join-city" className="text-[14px] font-semibold">{JOIN_COPY.about.city}</label>
          <CityPicker id="join-city" value={draft.based_city_id} onChange={(id) => set('based_city_id', id)} placeholder={JOIN_COPY.about.cityPlaceholder} className="min-h-[48px]" />
        </div>
      )}
      {fields.includes('dance_role') && (
        <div className="flex flex-col gap-1">
          <p id="join-dance-role-label" className="text-[14px] font-semibold">{JOIN_COPY.about.role}</p>
          <DanceRolePicker labelId="join-dance-role-label" value={draft.dance_role as DanceRoleValue | ''} onChange={(v) => set('dance_role', v)} />
        </div>
      )}
      {fields.includes('avatar_url') && completion.profileId && (
        <div className="flex flex-col gap-1">
          <p className="text-[14px] font-semibold">{JOIN_COPY.about.photo}<span className="block text-[13px] font-normal text-muted-foreground">{JOIN_COPY.about.photoHint}</span></p>
          <AvatarUpload value={draft.avatar_url} onChange={(url) => set('avatar_url', url)} userId={completion.profileId} name={draft.first_name.trim() || null} />
        </div>
      )}

      <ErrorLine id="join-about-error">{failed ? JOIN_COPY.about.saveFailed : null}</ErrorLine>
      <button type="submit" className={BTN} disabled={!pending || saving} aria-describedby={!pending ? 'join-about-why' : undefined} data-testid="join-about-save">{saving ? JOIN_COPY.about.saving : JOIN_COPY.about.button}</button>
      <p id="join-about-why" className={WHY} data-testid="join-about-why">{missing.length > 0 ? JOIN_COPY.about.stillToAdd(listFieldLabels(missing)) : ''}</p>
    </form>
  );
}
