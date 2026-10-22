import { PROFILE_FIELDS, type ProfileField } from '@/lib/profileCompletion';

/**
 * Dancer 4, one question per screen (Arc 1 slice A). The four fields are the
 * profile gate's whole definition (profile_complete_v1: first name, city, dance
 * role, photo); this module only decides ORDER, which questions are skipped, and
 * the words. Pure: no React, no network.
 */

/** Prefill from redeem_organiser_invite_v1 (`ok:true` -> `prefill`). Either half may be null. */
export type DancerPrefill = { first_name: string | null; city_id: string | null };

export const NO_PREFILL: DancerPrefill = { first_name: null, city_id: null };

/** Anything off-shape is "no prefill": a bad payload must never block the questions. */
export const parseDancerPrefill = (raw: unknown): DancerPrefill => {
  if (!raw || typeof raw !== 'object') return NO_PREFILL;
  const row = raw as Record<string, unknown>;
  const first = typeof row.first_name === 'string' ? row.first_name.trim() : '';
  const city = typeof row.city_id === 'string' ? row.city_id.trim() : '';
  return { first_name: first || null, city_id: city || null };
};

export type Answers = Record<ProfileField, string>;
export const EMPTY_ANSWERS: Answers = { first_name: '', based_city_id: '', dance_role: '', avatar_url: '' };

export type Dancer4Plan = {
  /** The screens to show, in order. Answered and prefilled fields are not here. */
  steps: ProfileField[];
  /** Prefilled values for fields the profile is missing: saved without asking (the city only). */
  prefilled: Partial<Record<ProfileField, string>>;
  /** Starting values for questions that ARE asked: the person sees and can edit them (the first name). */
  defaults: Partial<Record<ProfileField, string>>;
};

/** The order is the approved flow (prototype v8): name, city, lead or follow, photo. */
export const planDancer4 = (missing: readonly ProfileField[], prefill: DancerPrefill = NO_PREFILL): Dancer4Plan => {
  const prefilled: Partial<Record<ProfileField, string>> = {};
  const defaults: Partial<Record<ProfileField, string>> = {};
  if (missing.includes('first_name') && prefill.first_name) defaults.first_name = prefill.first_name;
  if (missing.includes('based_city_id') && prefill.city_id) prefilled.based_city_id = prefill.city_id;
  return { steps: PROFILE_FIELDS.filter((f) => missing.includes(f) && !(f in prefilled)), prefilled, defaults };
};

export type StepCopy = { title: string; why: string; disabledReason: string };

/** One mapping for the words of every screen (title, the line under it, why Next is off). */
export const STEP_COPY: Record<ProfileField, StepCopy> = {
  first_name: { title: 'Your first name', why: 'Shown on your profile.', disabledReason: 'Type your first name' },
  based_city_id: { title: 'Which city do you dance in?', why: 'Shown on your profile.', disabledReason: 'Pick your city' },
  dance_role: { title: 'Do you lead or follow?', why: 'Shown on your profile.', disabledReason: 'Pick one' },
  avatar_url: { title: 'Add a photo of you', why: 'Shown on your profile.', disabledReason: 'Add a photo' },
};

/** After a city request: the city is still required, so say what to do next. */
export const CITY_REQUESTED_NOTE = 'We will add it. For now, pick the nearest city above. You can change it later.';
export const CITY_REQUESTED_DISABLED_REASON = 'Pick the nearest city for now';
export const CITY_REQUEST_FAILED = 'We could not send that. Check your connection and try again.';
export const CITY_SEARCH_FAILED = 'We could not search cities. Check your connection and try again.';
export const CITY_NOT_FOUND_LABEL = "Can't find it? Tell us your city";
export const SAVE_FAILED = 'We could not save that. Check your connection and try again.';

export const stepReady = (field: ProfileField, answers: Answers): boolean => answers[field].trim().length > 0;

/** The reason the primary button is off, or null when it is on. Never a disabled control without a reason. */
export const disabledReason = (field: ProfileField, answers: Answers, cityRequested: boolean): string | null => {
  if (stepReady(field, answers)) return null;
  if (field === 'based_city_id' && cityRequested) return CITY_REQUESTED_DISABLED_REASON;
  return STEP_COPY[field].disabledReason;
};

export const progressLabel = (index: number, total: number): string => `Step ${index + 1} of ${total}`;

/**
 * The command for one save: only fields whose value differs from what was already
 * sent (so a changed answer after Back is sent again). Null when there is nothing
 * to send (an untouched record sends no command).
 */
export const buildDancer4Save = (
  fields: readonly ProfileField[],
  answers: Answers,
  sent: Readonly<Partial<Record<ProfileField, string>>>,
): Partial<Record<ProfileField, string>> | null => {
  const out: Partial<Record<ProfileField, string>> = {};
  for (const f of fields) {
    const v = answers[f].trim();
    if (v && sent[f] !== v) out[f] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
};

/** The name typed for "Tell us your city": trimmed, spaces collapsed, 2 to 80 characters; null when unusable. */
export const normaliseCityRequest = (raw: string): string | null => {
  const name = raw.trim().replace(/\s+/g, ' ');
  return name.length >= 2 && name.length <= 80 ? name : null;
};

/** Quick-pick chips, by name. Names that match more than one active city are dropped (search finds those). */
export const CHIP_CITY_NAMES = ['London', 'Madrid', 'Barcelona', 'Manchester', 'Birmingham', 'Paris', 'Berlin', 'Lisbon'] as const;

export type CityChip = { id: string; name: string };

export const pickChipCities = (rows: readonly { id: string; name: string }[]): CityChip[] => {
  const byName = new Map<string, CityChip[]>();
  for (const r of rows) byName.set(r.name, [...(byName.get(r.name) ?? []), { id: r.id, name: r.name }]);
  return CHIP_CITY_NAMES.flatMap((n) => {
    const hits = byName.get(n) ?? [];
    return hits.length === 1 ? [hits[0]] : [];
  });
};
