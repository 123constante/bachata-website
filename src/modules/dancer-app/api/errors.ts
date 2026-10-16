import { DANCER_ERROR_CODES, SAVE_KEYS, type DancerErrorCode, type DancerErrorField, type SaveKey } from './types';

/**
 * The ONE map from a dancer-area error code to the words a person sees. Every
 * screen shows these through copyFor() / DancerApiError, never its own string.
 *
 * Copy rules (owner's definition of done): plain words, says what the person
 * can do next, never points at a control that might not be on screen (so no
 * "tap X" -- the screen that shows the message owns its buttons).
 *
 * Some codes arrive with a DETAIL naming the field (unknown_key, invalid_type,
 * invalid_text, invalid_handle, invalid_url, invalid_list). Then the copy names
 * that field in plain words (FIELD_LABEL), and the error is put under it.
 */
const COPY: Record<DancerErrorCode, string> = {
  area_closed: 'The new dancer area is not open for your account yet.',
  not_signed_in: 'You are signed out. Sign in again to carry on.',
  no_profile: 'We could not find your dancer profile. Message us and we will sort it out.',
  profile_mismatch: 'Your account and your dancer profile do not match. Message us and we will sort it out.',
  rate_limited: 'That was a lot of saves in a short time. Wait a few minutes, then try again.',
  whatsapp_not_allowed: 'WhatsApp is only for people who also teach, DJ or organise.',
  invalid_payload: 'This save could not be read. Reload the page and try again.',
  unknown_key: 'Something in this save was not recognised. Reload the page and try again.',
  invalid_type: 'One of your answers is in the wrong format. Reload the page and try again.',
  first_name_required: 'Your first name cannot be empty. You can change it, but not remove it.',
  city_required: 'Pick your city from the list. You can change it, but not remove it.',
  photo_required: 'Your photo cannot be removed. You can replace it with a new one.',
  invalid_display_name: 'Display name must be 1 to 40 characters, with no links or @.',
  invalid_text: 'Some of your text has characters we cannot save. Remove any links or odd symbols and try again.',
  // The chips' own words (api/nextStep ROLE_CHOICES labels), not the stored value 'Lead and Follow' (L17).
  invalid_role: 'Pick Leader, Follower or Both.',
  invalid_year: 'Pick a year between 1950 and this year.',
  bio_too_long: 'Your bio can be up to 280 characters.',
  bio_has_link: 'Links are not allowed in your bio. Add your Instagram, Facebook or website in their own fields.',
  invalid_handle: 'That does not look like a valid handle. Use letters, numbers, dots or underscores.',
  invalid_url: 'That link must start with http:// or https://.',
  invalid_whatsapp: 'That does not look like a WhatsApp number. Use the full number with the country code, like +44 7700 900123.',
  invalid_list: 'One of your lists could not be saved. Keep each item short and try again.',
  unknown: 'Something went wrong. Check your connection and try again.',
};

/** Plain words for every save key, used when the DB's DETAIL names the field. */
export const FIELD_LABEL: Record<SaveKey, string> = {
  display_name: 'display name',
  first_name: 'first name',
  surname: 'surname',
  based_city_id: 'city',
  dance_role: 'dance role',
  nationality: 'nationality',
  languages: 'languages',
  bio: 'bio',
  instagram: 'Instagram',
  facebook: 'Facebook',
  website_url: 'website',
  whatsapp: 'WhatsApp number',
  show_whatsapp_publicly: 'WhatsApp visibility',
  hide_surname_publicly: 'surname visibility',
  avatar_url: 'photo',
  dance_started_year: 'year you started dancing',
  favorite_styles: 'favourite styles',
  favorite_songs: 'favourite songs',
  achievements: 'achievements',
};

/** Copy for a code whose DETAIL named a field: says WHICH field, in plain words. */
const DETAIL_COPY: Partial<Record<DancerErrorCode, (field: SaveKey) => string>> = {
  unknown_key: (f) => `Your ${FIELD_LABEL[f]} could not be saved here. Reload the page and try again.`,
  invalid_type: (f) => `Your ${FIELD_LABEL[f]} is in the wrong format. Reload the page and try again.`,
  invalid_text: (f) => `Your ${FIELD_LABEL[f]} has characters we cannot save. Remove any links or odd symbols and try again.`,
  invalid_handle: (f) => `That does not look like a valid ${FIELD_LABEL[f]} handle. Use letters, numbers, dots or underscores.`,
  invalid_url: (f) =>
    f === 'avatar_url'
      ? 'Your photo link is not valid. Upload the photo again.'
      : `Your ${FIELD_LABEL[f]} must start with http:// or https://.`,
  invalid_list: (f) => `Your ${FIELD_LABEL[f]} could not be saved. Keep each item short and try again.`,
};

/** Which field a code is about when no DETAIL names one (null = the whole screen). */
const FIELD: Record<DancerErrorCode, DancerErrorField> = {
  area_closed: null,
  not_signed_in: null,
  no_profile: null,
  profile_mismatch: null,
  rate_limited: null,
  whatsapp_not_allowed: 'whatsapp',
  invalid_payload: null,
  unknown_key: null,
  invalid_type: null,
  first_name_required: 'first_name',
  city_required: 'based_city_id',
  photo_required: 'avatar_url',
  invalid_display_name: 'display_name',
  invalid_text: null,
  invalid_role: 'dance_role',
  invalid_year: 'dance_started_year',
  bio_too_long: 'bio',
  bio_has_link: 'bio',
  invalid_handle: null,
  invalid_url: 'website_url',
  invalid_whatsapp: 'whatsapp',
  invalid_list: null,
  unknown: null,
};

const KNOWN = new Set<string>(DANCER_ERROR_CODES);
const KEYS = new Set<string>(SAVE_KEYS);

export const isDancerErrorCode = (value: unknown): value is DancerErrorCode =>
  typeof value === 'string' && KNOWN.has(value);

/** A DETAIL -> the save key it names, or null (anything else is ignored). */
export const fieldFromDetail = (detail: unknown): SaveKey | null => {
  const d = typeof detail === 'string' ? detail.trim() : null;
  return d && KEYS.has(d) ? (d as SaveKey) : null;
};

/** The copy for a code; names the field when the DB's DETAIL named one this code talks about. */
export const copyFor = (code: DancerErrorCode, detail?: string | null): string => {
  const field = fieldFromDetail(detail);
  const named = field ? DETAIL_COPY[code] : undefined;
  return named && field ? named(field) : COPY[code];
};

/** The field a code belongs to (the DETAIL's field first), or null for a screen-level message. */
export const fieldFor = (code: DancerErrorCode, detail?: string | null): DancerErrorField =>
  (DETAIL_COPY[code] ? fieldFromDetail(detail) : null) ?? FIELD[code];

/** PostgreSQL's own refusal when a signed-out (anon) caller reaches a member RPC. */
const PERMISSION_DENIED_RE = /permission denied for function/i;

/**
 * An RPC error message -> a code. The server raises `MESSAGE = '<name>'`, so the
 * message IS the code; PostgREST sometimes wraps it, so a known code anywhere
 * as a whole word counts. PostgreSQL's "permission denied for function ..." is
 * a signed-out caller: `not_signed_in`. Anything else is `unknown`.
 */
export const codeFromMessage = (message: string | null | undefined): DancerErrorCode => {
  if (!message) return 'unknown';
  const trimmed = message.trim();
  if (isDancerErrorCode(trimmed) && trimmed !== 'unknown') return trimmed;
  for (const code of DANCER_ERROR_CODES) {
    if (code === 'unknown') continue;
    if (new RegExp(`(^|[^a-z_])${code}([^a-z_]|$)`).test(trimmed)) return code;
  }
  if (PERMISSION_DENIED_RE.test(trimmed)) return 'not_signed_in';
  return 'unknown';
};

/** What every api/rpc.ts wrapper throws. `message` is the copy, so a plain `String(err)` is still readable. */
export class DancerApiError extends Error {
  readonly code: DancerErrorCode;
  readonly field: DancerErrorField;
  /** The raw server text, for logs only; never shown. */
  readonly raw: string | null;
  /** The DB's DETAIL (a field name for some codes); already reflected in `message` and `field`. */
  readonly detail: string | null;
  constructor(code: DancerErrorCode, raw: string | null = null, detail: string | null = null) {
    super(copyFor(code, detail));
    this.name = 'DancerApiError';
    this.code = code;
    this.field = fieldFor(code, detail);
    this.raw = raw;
    this.detail = detail;
  }
}

/** Any thrown value -> a DancerApiError (an unknown one becomes `unknown`). */
export const toDancerError = (err: unknown): DancerApiError => {
  if (err instanceof DancerApiError) return err;
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : null;
  return new DancerApiError(codeFromMessage(raw), raw);
};
