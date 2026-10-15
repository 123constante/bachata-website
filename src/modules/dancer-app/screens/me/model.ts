/**
 * W2c: the ONE mapping for every fact the Me and Edit screens both show
 * (name, "Leader · London", the next-step button, the dancing-since bands) and
 * every rule the Edit form enforces before it asks the server. Pure functions,
 * no React, so the tests can table-drive them.
 *
 * Strength is NEVER computed here: it is `profile.strength` from the server.
 */
import { diffDelta } from '../../api/delta';
// Client-side refusals read the SAME copy the DB's refusal maps to (one mapping, api/errors.ts).
import { copyFor } from '../../api/errors';
import type { DancerDelta, DanceRole, MyDancerEdit, SaveKey, StrengthStep } from '../../api/types';

export const BIO_MAX = 280;
export const DISPLAY_NAME_MAX = 40;
export const LIST_MAX_ITEMS = 20;
export const LIST_ITEM_MAX = 60;

/* ---------- names, role, city: one reading of the profile ---------- */

export const profileName = (p: Pick<MyDancerEdit, 'display_name' | 'first_name'>): string =>
  p.display_name?.trim() || p.first_name?.trim() || 'No name yet';

/** The three role chips. `Both` is what the person reads; the column holds `Lead and Follow`. */
export const ROLE_CHOICES: ReadonlyArray<{ value: DanceRole; label: string }> = [
  { value: 'Leader', label: 'Leader' },
  { value: 'Follower', label: 'Follower' },
  { value: 'Lead and Follow', label: 'Both' },
];

export const roleLabel = (role: DanceRole | null): string | null => ROLE_CHOICES.find((r) => r.value === role)?.label ?? null;

/** "Leader · London". Either part may be missing; both missing says so in words. */
export const roleCityLine = (p: Pick<MyDancerEdit, 'dance_role' | 'city_name'>): string => {
  const parts = [roleLabel(p.dance_role), p.city_name?.trim() || null].filter((x): x is string => Boolean(x));
  return parts.length > 0 ? parts.join(' · ') : 'Your role and city are not set yet';
};

/* ---------- the next step: copy + where the button goes ---------- */

export type NextStepTarget = { path: string; focus: EditFocus | null };
export type EditFocus = 'first_name' | 'city' | 'role' | 'year' | 'styles' | 'bio';

export const PHOTO_PATH = '/app/me/photo';
export const EDIT_PATH = '/app/me/edit';

/** What the main button says and where it goes, per `strength.next_step`. */
export const NEXT_STEP: Record<StrengthStep, { button: string; sentence: string; path: string; focus: EditFocus | null }> = {
  first_name: { button: 'Add your first name', sentence: 'Add your first name', path: EDIT_PATH, focus: 'first_name' },
  city: { button: 'Add your city', sentence: 'Add your city', path: EDIT_PATH, focus: 'city' },
  role: { button: 'Choose how you dance', sentence: 'Choose whether you lead or follow', path: EDIT_PATH, focus: 'role' },
  photo: { button: 'Add your photo', sentence: 'Add your photo', path: PHOTO_PATH, focus: null },
  started_year: { button: 'Add when you started', sentence: 'Add when you started dancing', path: EDIT_PATH, focus: 'year' },
  styles: { button: 'Pick your styles', sentence: 'Pick your favourite styles', path: EDIT_PATH, focus: 'styles' },
  bio_social: { button: 'Add a bio and a link', sentence: 'Add a bio and one link', path: EDIT_PATH, focus: 'bio' },
};

const REQUIRED_STEPS: ReadonlySet<StrengthStep> = new Set(['first_name', 'city', 'role', 'photo']);

export const editHref = (focus: EditFocus | null): string => (focus ? `${EDIT_PATH}?focus=${focus}` : EDIT_PATH);

export type MeAction = { label: string; href: string; isEdit: boolean };

/** The ONE main button: the next missing step, or "Edit my profile" at 100. */
export const mainAction = (p: Pick<MyDancerEdit, 'strength'>): MeAction => {
  const step = p.strength.next_step;
  if (!step) return { label: 'Edit my profile', href: EDIT_PATH, isEdit: true };
  const s = NEXT_STEP[step];
  return { label: s.button, href: s.path === EDIT_PATH ? editHref(s.focus) : s.path, isEdit: false };
};

/** The line under the strength bar. Says what the person CAN do. */
export const nextStepCopy = (p: Pick<MyDancerEdit, 'strength'>): string => {
  const step = p.strength.next_step;
  if (!step) return 'Your profile is complete. You can edit it any time.';
  const s = NEXT_STEP[step].sentence;
  return REQUIRED_STEPS.has(step) ? `${s} to reach 70% and unlock Going and Interested.` : `${s} to move towards 100%.`;
};

/* ---------- dancing since: the four bands, both ways ---------- */

export type YearBand = 'new' | 'one-two' | 'three-five' | 'six-plus';

/** Years of dancing -> band. Age 0 = this year. */
export const YEAR_BANDS: ReadonlyArray<{ id: YearBand; label: string; years: number }> = [
  { id: 'new', label: 'This year', years: 0 },
  { id: 'one-two', label: '1–2 years', years: 1 },
  { id: 'three-five', label: '3–5 years', years: 4 },
  { id: 'six-plus', label: '6+ years', years: 8 },
];

export const bandForYear = (year: number | null, now: number = new Date().getFullYear()): YearBand | null => {
  if (year === null) return null;
  const age = Math.max(0, now - year);
  if (age < 1) return 'new';
  if (age <= 2) return 'one-two';
  if (age <= 5) return 'three-five';
  return 'six-plus';
};

/** Band -> the year it stands for (representative: 0, 1, 4, 8 years back). */
export const yearForBand = (band: YearBand, now: number = new Date().getFullYear()): number =>
  now - (YEAR_BANDS.find((b) => b.id === band)?.years ?? 0);

/* ---------- parsing ---------- */

/** Free text -> list: split on commas, trim, drop empties, dedupe (case-insensitive, first spelling wins). */
export const parseLanguages = (text: string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(',')) {
    const item = raw.trim();
    const key = item.toLowerCase();
    if (item === '' || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};

export const languagesToText = (languages: string[]): string => languages.join(', ');

/** Add one chip: trimmed, non-empty, not a duplicate, within the caps. Returns the list unchanged otherwise. */
export const addChip = (list: string[], raw: string): string[] => {
  const item = raw.trim().slice(0, LIST_ITEM_MAX);
  if (item === '' || list.length >= LIST_MAX_ITEMS) return list;
  if (list.some((x) => x.toLowerCase() === item.toLowerCase())) return list;
  return [...list, item];
};

/* ---------- field rules (client mirror of the server's codes) ---------- */

/** Same rule as the server's bio_has_link: http://, https://, www., or a .tld/ pattern. */
export const BIO_LINK_RE = /https?:\/\/|www\.|\.[a-z]{2,}\//i;
const HANDLE_RE = /^@?[A-Za-z0-9._]{1,50}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

export type FormFieldId =
  | 'display_name'
  | 'first_name'
  | 'surname'
  | 'based_city_id'
  | 'dance_role'
  | 'nationality'
  | 'languages'
  | 'dance_started_year'
  | 'favorite_styles'
  | 'favorite_songs'
  | 'achievements'
  | 'bio'
  | 'instagram'
  | 'facebook'
  | 'website_url'
  | 'whatsapp'
  | 'avatar_url';

export type EditDraft = {
  display_name: string;
  first_name: string;
  surname: string;
  based_city_id: string;
  dance_role: DanceRole | null;
  nationality: string;
  languages: string;
  dance_started_year: number | null;
  favorite_styles: string[];
  favorite_songs: string[];
  achievements: string[];
  bio: string;
  instagram: string;
  facebook: string;
  website_url: string;
  whatsapp: string;
  show_whatsapp_publicly: boolean;
};

export const draftFromProfile = (p: MyDancerEdit): EditDraft => ({
  display_name: p.display_name ?? '',
  first_name: p.first_name ?? '',
  surname: p.surname ?? '',
  based_city_id: p.based_city_id ?? '',
  dance_role: p.dance_role,
  nationality: p.nationality ?? '',
  languages: languagesToText(p.languages),
  dance_started_year: p.dance_started_year,
  favorite_styles: [...p.favorite_styles],
  favorite_songs: [...p.favorite_songs],
  achievements: [...p.achievements],
  bio: p.bio ?? '',
  instagram: p.instagram ?? '',
  facebook: p.facebook ?? '',
  website_url: p.website_url ?? '',
  whatsapp: p.whatsapp ?? '',
  show_whatsapp_publicly: p.show_whatsapp_publicly,
});

/** The same reasons the server gives, found before the request. Empty object = the draft is sendable. */
export const validateDraft = (d: EditDraft, p: Pick<MyDancerEdit, 'other_roles' | 'first_name' | 'based_city_id'>): Partial<Record<FormFieldId, string>> => {
  const e: Partial<Record<FormFieldId, string>> = {};
  const dn = d.display_name.trim();
  if (dn !== '' && (dn.length > DISPLAY_NAME_MAX || /http|:\/\/|@/i.test(dn) || CONTROL_RE.test(dn))) {
    e.display_name = `Display name must be 1 to ${DISPLAY_NAME_MAX} characters, with no links or @.`;
  }
  // Replace-only: once saved, the input refuses empty (with the reason) instead of sending a clear.
  // A field that was never filled is not an error: an untouched form is simply untouched.
  if (d.first_name.trim() === '' && (p.first_name ?? '').trim() !== '') e.first_name = copyFor('first_name_required');
  if (d.based_city_id.trim() === '' && (p.based_city_id ?? '').trim() !== '') e.based_city_id = copyFor('city_required');
  const bioLen = d.bio.length;
  if (bioLen > BIO_MAX) e.bio = `Your bio can be up to ${BIO_MAX} characters. Remove ${bioLen - BIO_MAX} to save.`;
  else if (BIO_LINK_RE.test(d.bio)) e.bio = copyFor('bio_has_link');
  for (const k of ['instagram', 'facebook'] as const) {
    const v = d[k].trim();
    if (v !== '' && !HANDLE_RE.test(v)) e[k] = copyFor('invalid_handle', k);
  }
  const url = d.website_url.trim();
  if (url !== '' && !/^https?:\/\/\S+$/i.test(url)) e.website_url = copyFor('invalid_url', 'website_url');
  if (p.other_roles.length > 0) {
    const wa = d.whatsapp.trim();
    const digits = wa.replace(/\D/g, '');
    if (wa !== '' && (!/^[0-9+()\s-]+$/.test(wa) || digits.length < 7 || digits.length > 15)) {
      e.whatsapp = 'Enter your number with the country code, for example +44 7700 900123.';
    }
  }
  return e;
};

const text = (v: string): string | null => (v.trim() === '' ? null : v.trim());

/**
 * The draft -> the keys that changed, nothing else. Built on api/delta's diffDelta
 * (the ONE client rule for "what changed"). `hide_surname_publicly` and `avatar_url`
 * are never here: the switch and the photo screen write through their own paths.
 * A pure dancer (no other_roles) can NEVER produce a whatsapp key.
 */
export const buildDelta = (current: MyDancerEdit, d: EditDraft): DancerDelta => {
  const candidate: DancerDelta = {
    display_name: text(d.display_name),
    first_name: text(d.first_name),
    surname: text(d.surname),
    based_city_id: text(d.based_city_id),
    dance_role: d.dance_role,
    nationality: text(d.nationality),
    languages: parseLanguages(d.languages),
    dance_started_year: d.dance_started_year,
    favorite_styles: d.favorite_styles,
    favorite_songs: d.favorite_songs,
    achievements: d.achievements,
    bio: text(d.bio),
    instagram: text(d.instagram),
    facebook: text(d.facebook),
    website_url: text(d.website_url),
  };
  if (current.other_roles.length > 0) {
    candidate.whatsapp = text(d.whatsapp);
    candidate.show_whatsapp_publicly = d.show_whatsapp_publicly;
  }
  return diffDelta(current, candidate);
};

/** Why Save is off, or null when it can be pressed. Visible text, one mapping. */
export const SAVE_REASON_UNTOUCHED = 'Nothing has changed yet. Edit a field above to save.';
export const SAVE_REASON_INVALID = 'Fix the fields marked above, then save.';

export const saveDisabledReason = (delta: DancerDelta, errors: Partial<Record<FormFieldId, string>>, saving: boolean): string | null => {
  if (saving) return 'Saving your changes…';
  if (Object.keys(errors).length > 0) return SAVE_REASON_INVALID;
  if (Object.keys(delta).length === 0) return SAVE_REASON_UNTOUCHED;
  return null;
};

/** The delta key -> the form field that shows its server error. */
export const fieldForKey = (key: SaveKey): FormFieldId | null =>
  key === 'hide_surname_publicly' || key === 'show_whatsapp_publicly' ? null : (key as FormFieldId);
