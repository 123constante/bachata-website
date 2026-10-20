// The ONE table from a save_my_role_v1 / set_my_role_declined_v1 refusal (or
// a client-side check with the same code) to plain words. A test asserts
// every pinned code has a sentence.

export const ROLE_ERROR_CODES = [
  'not_signed_in',
  'invalid_role',
  'no_profile',
  'invalid_payload',
  'unknown_key',
  'invalid_type',
  'invalid_years',
  'invalid_text',
  'invalid_link',
  'invalid_list',
  'rate_limited',
] as const;
export type RoleErrorCode = (typeof ROLE_ERROR_CODES)[number];

export const ROLE_ERROR_COPY: Record<RoleErrorCode, string> = {
  not_signed_in: 'You are signed out. Sign in again, then save.',
  invalid_role: 'This area is not available. Go back and open it again.',
  no_profile: 'Finish your dancer profile first, then come back to add these details.',
  invalid_payload: 'Something in this form could not be saved. Check your answers and try again.',
  unknown_key: 'One of these details can no longer be saved. Reload the page and try again.',
  invalid_type: 'One answer is in the wrong form. Check it and try again.',
  invalid_years: 'Years must be a whole number from 0 to 80.',
  invalid_text: 'This answer is too long. Shorten it and try again.',
  invalid_link: 'Paste the full link, with no spaces, up to 300 characters.',
  invalid_list: 'Lists can hold up to 20 items of up to 80 characters each.',
  rate_limited: 'Too many saves in a short time. Wait a minute, then try again.',
};

export const ROLE_ERROR_FALLBACK = 'This did not save. Check your connection, then try again. Nothing you typed is lost.';

/** Finds a pinned code anywhere in the message (Postgres may prefix it). */
export function roleErrorCode(err: unknown): RoleErrorCode | null {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : (err as { message?: unknown } | null)?.message;
  if (typeof msg !== 'string') return null;
  return ROLE_ERROR_CODES.find((c) => new RegExp(`\\b${c}\\b`).test(msg)) ?? null;
}

export function roleErrorMessage(err: unknown): string {
  const code = roleErrorCode(err);
  return code ? ROLE_ERROR_COPY[code] : ROLE_ERROR_FALLBACK;
}
