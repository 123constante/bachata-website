// Raffle v3 winner journey: the six profile fields a winner needs before the QR.
// Pure logic, no React, no network. Order is the order the profile steps show.

export type ProfileField = 'avatar_url' | 'first_name' | 'dance_role' | 'based_city_id' | 'nationality' | 'languages';

export const PROFILE_STEP_ORDER: readonly ProfileField[] =
  ['avatar_url', 'first_name', 'dance_role', 'based_city_id', 'nationality', 'languages'];

/** Stored dance_role value for the "Both" choice is 'Lead and Follow'; the label is Both. */
export const DANCE_ROLE_BOTH_VALUE = 'Lead and Follow';
export const DANCE_ROLE_BOTH_LABEL = 'Both';

export const isProfileField = (v: unknown): v is ProfileField =>
  typeof v === 'string' && (PROFILE_STEP_ORDER as readonly string[]).includes(v);

const blank = (v: unknown): boolean => v == null || (typeof v === 'string' && v.trim() === '');

/** Missing fields, in PROFILE_STEP_ORDER. NULL/blank text counts empty; languages null or [] counts empty. */
export function missingProfileFields(row: Partial<Record<ProfileField, unknown>> | null | undefined): ProfileField[] {
  const r = row ?? {};
  return PROFILE_STEP_ORDER.filter((f) => (f === 'languages'
    ? !Array.isArray(r.languages) || r.languages.length === 0
    : blank(r[f])));
}

/** Keep known field names only, deduped, in step order. */
export const orderMissing = (names: readonly unknown[]): ProfileField[] =>
  PROFILE_STEP_ORDER.filter((f) => names.includes(f));

export function introLineFor(opts: { isNewAccount: boolean; missing: readonly ProfileField[] }): string | null {
  if (opts.missing.length === 0) return null;
  return opts.isNewAccount
    ? 'We need a few details before we can give you your QR.'
    : 'Almost there. We need a few more details.';
}

export const stepCount = (missing: readonly ProfileField[]): number => missing.length;
