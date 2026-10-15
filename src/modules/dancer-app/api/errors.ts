import { DANCER_ERROR_CODES, type DancerErrorCode, type DancerErrorField } from './types';

/**
 * The ONE map from a dancer-area error code to the words a person sees. Every
 * screen shows these through copyFor() / DancerApiError, never its own string.
 *
 * Copy rules (owner's definition of done): plain words, says what the person
 * can do next, never points at a control that might not be on screen (so no
 * "tap X" -- the screen that shows the message owns its buttons).
 */
const COPY: Record<DancerErrorCode, string> = {
  area_closed: 'The new dancer area is not open for your account yet.',
  not_signed_in: 'You are signed out. Sign in again to carry on.',
  no_profile: 'We could not find your dancer profile. Message us and we will sort it out.',
  rate_limited: 'That was a lot of saves in a short time. Wait a few minutes, then try again.',
  invalid_display_name: 'Display name must be 1 to 40 characters, with no links or @.',
  first_name_required: 'Your first name cannot be empty. You can change it, but not remove it.',
  city_required: 'Pick your city from the list. You can change it, but not remove it.',
  photo_required: 'Your photo cannot be removed. You can replace it with a new one.',
  bio_too_long: 'Your bio can be up to 280 characters.',
  bio_has_link: 'Links are not allowed in your bio. Add your Instagram, Facebook or website in their own fields.',
  invalid_handle: 'That does not look like a valid handle. Use letters, numbers, dots or underscores.',
  invalid_url: 'Your website must start with http:// or https://.',
  invalid_year: 'Pick a year between 1950 and this year.',
  whatsapp_not_allowed: 'WhatsApp is only for people who also teach, DJ or organise.',
  invalid_role: 'Pick Leader, Follower or Lead and Follow.',
  unknown_key: 'Something in this save was not recognised. Reload the page and try again.',
  unknown: 'Something went wrong. Check your connection and try again.',
};

/** Which field a code is about (null = the whole screen). */
const FIELD: Record<DancerErrorCode, DancerErrorField> = {
  area_closed: null,
  not_signed_in: null,
  no_profile: null,
  rate_limited: null,
  invalid_display_name: 'display_name',
  first_name_required: 'first_name',
  city_required: 'based_city_id',
  photo_required: 'avatar_url',
  bio_too_long: 'bio',
  bio_has_link: 'bio',
  invalid_handle: null,
  invalid_url: 'website_url',
  invalid_year: 'dance_started_year',
  whatsapp_not_allowed: 'whatsapp',
  invalid_role: 'dance_role',
  unknown_key: null,
  unknown: null,
};

const KNOWN = new Set<string>(DANCER_ERROR_CODES);

export const isDancerErrorCode = (value: unknown): value is DancerErrorCode =>
  typeof value === 'string' && KNOWN.has(value);

/** The copy for a code. */
export const copyFor = (code: DancerErrorCode): string => COPY[code];

/** The field a code belongs to, or null for a screen-level message. */
export const fieldFor = (code: DancerErrorCode): DancerErrorField => FIELD[code];

/**
 * An RPC error message -> a code. The server raises `MESSAGE = '<name>'`, so the
 * message IS the code; PostgREST sometimes wraps it, so a known code anywhere
 * as a whole word counts. Anything else is `unknown`.
 */
export const codeFromMessage = (message: string | null | undefined): DancerErrorCode => {
  if (!message) return 'unknown';
  const trimmed = message.trim();
  if (isDancerErrorCode(trimmed) && trimmed !== 'unknown') return trimmed;
  for (const code of DANCER_ERROR_CODES) {
    if (code === 'unknown') continue;
    if (new RegExp(`(^|[^a-z_])${code}([^a-z_]|$)`).test(trimmed)) return code;
  }
  return 'unknown';
};

/** What every api/rpc.ts wrapper throws. `message` is the copy, so a plain `String(err)` is still readable. */
export class DancerApiError extends Error {
  readonly code: DancerErrorCode;
  readonly field: DancerErrorField;
  /** The raw server text, for logs only; never shown. */
  readonly raw: string | null;
  constructor(code: DancerErrorCode, raw: string | null = null) {
    super(copyFor(code));
    this.name = 'DancerApiError';
    this.code = code;
    this.field = fieldFor(code);
    this.raw = raw;
  }
}

/** Any thrown value -> a DancerApiError (an unknown one becomes `unknown`). */
export const toDancerError = (err: unknown): DancerApiError => {
  if (err instanceof DancerApiError) return err;
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : null;
  return new DancerApiError(codeFromMessage(raw), raw);
};
