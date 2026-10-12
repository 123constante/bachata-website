// Edit in place: the ONE set of rules for each field an owner or manager can
// change on their live organiser page. Pure functions, no React, no client:
// the sheet, the "We will save" preview, the page overlay and the save all read
// these. The server (organiser_profile_update_p5_v1) stays the final word; a
// refusal there is mapped back to a field in draftModel.ts.

import {
  buildOrganiserProfilePatch,
  hostMatchesDomain,
  lowercaseScheme,
  withNormalizedProtocol,
  type OrganiserProfileEditForm,
} from '@/lib/organiserProfileUpdate';
import { extractDomain, extractIgHandle, facebookDisplayLabel } from '@/lib/organiserLinkLabels';

export type FieldKey =
  | 'name'
  | 'city'
  | 'avatar_url'
  | 'founded_year'
  | 'instagram'
  | 'bio'
  | 'website'
  | 'facebook'
  | 'organisation_category';

export const FIELD_KEYS: readonly FieldKey[] = [
  'name',
  'city',
  'avatar_url',
  'founded_year',
  'instagram',
  'bio',
  'website',
  'facebook',
  'organisation_category',
];

export const FIELD_LABEL: Record<FieldKey, string> = {
  name: 'Name',
  city: 'City',
  avatar_url: 'Photo',
  founded_year: 'Year started',
  instagram: 'Instagram',
  bio: 'About',
  website: 'Website',
  facebook: 'Facebook',
  organisation_category: 'Category',
};

export function isFieldKey(v: unknown): v is FieldKey {
  return typeof v === 'string' && (FIELD_KEYS as readonly string[]).includes(v);
}

// ---- the "Complete your page" prompts ---------------------------------------------------

export interface PromptedField {
  key: FieldKey;
  importance: 'Essential' | 'Recommended';
  reason: string;
}

/** In ORDER. About, Website, Facebook and Category are optional and never prompted. */
export const PROMPTED_FIELDS: readonly PromptedField[] = [
  { key: 'avatar_url', importance: 'Essential', reason: 'Dancers recognise you by your photo.' },
  { key: 'founded_year', importance: 'Essential', reason: 'Shows dancers how long you have been running nights.' },
  { key: 'instagram', importance: 'Recommended', reason: 'Most dancers check Instagram before they come.' },
];

/** The card shows at most this many rows before a "Show more". */
export const CARD_VISIBLE_ROWS = 3;

// ---- the result every check returns -------------------------------------------------------

export interface FieldCheck {
  /** False: Done is disabled and `error` says why. */
  ok: boolean;
  /** The draft value to keep (what the person typed, cleaned). '' clears the field. */
  value: string;
  /** Plain refusal copy, or null. */
  error: string | null;
  /** Never blocking: things worth a second look. */
  hints: string[];
  /** What the save will store for this field, or null when it clears it. */
  willSave: string | null;
  /** A link the person can open to check, when the value is a valid link. */
  href: string | null;
}

const ok = (value: string, willSave: string | null, href: string | null = null, hints: string[] = []): FieldCheck => ({
  ok: true, value, error: null, hints, willSave, href,
});
const bad = (value: string, error: string): FieldCheck => ({ ok: false, value, error, hints: [], willSave: null, href: null });

// An empty form: patchValue() fills ONE field and reads back what
// buildOrganiserProfilePatch makes of it, so "We will save" can never disagree
// with the save itself (no second format is invented here).
const EMPTY_FORM: OrganiserProfileEditForm = {
  name: 'x', avatar_url: '', bio: '', instagram: '', facebook: '', website: '', organisation_category: '', founded_year: '',
};

/** The patch value buildOrganiserProfilePatch produces for one field's draft (not City: it is the patch's city_id). */
export function patchValue(field: Exclude<FieldKey, 'city'>, draft: string): string | number | null {
  const patch = buildOrganiserProfilePatch({ ...EMPTY_FORM, [field]: draft }, 'x');
  if (field === 'facebook') return (patch.socials as { facebook: string | null }).facebook;
  return patch[field] as string | number | null;
}

// ---- name -------------------------------------------------------------------------------

// The server's rule (organiser_profile_update_p5_v1 + _self_serve_text_problem_p5,
// read from prod 2026-10-12): required, at most 80 characters (char_length, so
// code points), single line (no control character). A name another LIVE
// organiser already uses (trimmed, any case) is refused as organiser_name_taken:
// only the server can know that, so it comes back on Save (draftModel.ts).
export const NAME_MAX = 80;
export const NAME_COPY = {
  required: 'Your page needs a name.',
  tooLong: (n: number) => `A name can be at most ${NAME_MAX} characters. Yours has ${n}.`,
  oneLine: 'Keep the name on one line, with no special characters.',
  taken: 'Another organiser already uses this name. Pick a different one.',
};

/** Characters as the server counts them (code points, after trimming). */
export const nameLength = (raw: string): number => Array.from(raw.trim()).length;

export function checkName(raw: string): FieldCheck {
  const t = raw.trim();
  if (!t) return bad(t, NAME_COPY.required);
  // eslint-disable-next-line no-control-regex -- the server's single-line rule
  if (/[\x00-\x1f\x7f]/.test(t)) return bad(t, NAME_COPY.oneLine);
  const n = nameLength(t);
  if (n > NAME_MAX) return bad(t, NAME_COPY.tooLong(n));
  return ok(t, patchValue('name', t) as string);
}

// ---- city --------------------------------------------------------------------------------

// A pick from the city list, never free text: the draft is the picked city's id.
// The sheet confirms it against the cities table (resolveCanonicalCity) and shows
// the city's name; the server refuses an unknown id as city_not_found.
export const CITY_COPY = {
  required: 'Pick your city from the list.',
  notFound: 'That city is not on our list. Pick one from the list.',
  checkFailed: 'We could not check that city. Check your connection, then tap Check again.',
};
const CITY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function checkCity(raw: string): FieldCheck {
  const t = raw.trim().toLowerCase();
  if (!CITY_ID.test(t)) return bad(t, CITY_COPY.required);
  return ok(t, t);
}

// ---- year started ------------------------------------------------------------------------

export const YEAR_COPY = {
  format: 'Use a four-digit year, like 2019.',
  range: 'Pick a year from 1900 to this year.',
};

export function checkYear(raw: string, nowYear: number = new Date().getFullYear()): FieldCheck {
  const t = raw.trim();
  if (!t) return ok('', null);
  if (!/^\d{4}$/.test(t)) return bad(t, YEAR_COPY.format);
  const n = Number(t);
  if (n < 1900 || n > nowYear) return bad(t, YEAR_COPY.range);
  return ok(t, t);
}

// ---- instagram ---------------------------------------------------------------------------

export const INSTAGRAM_COPY = {
  refuse: 'Use your Instagram name, like @yourname, or an instagram.com link.',
  tooLong: 'An Instagram name is at most 30 letters, numbers, dots or underscores.',
};
const IG_HANDLE = /^@?[A-Za-z0-9._]{1,30}$/;

export function checkInstagram(raw: string): FieldCheck {
  const t = raw.trim();
  if (!t) return ok('', null);
  if (IG_HANDLE.test(t)) {
    const value = t.startsWith('@') ? t : `@${t}`;
    return ok(value, patchValue('instagram', value) as string, `https://instagram.com/${value.slice(1)}`);
  }
  if (/^@?[A-Za-z0-9._]{31,}$/.test(t)) return bad(t, INSTAGRAM_COPY.tooLong);
  if (/\s/.test(t) || !hostMatchesDomain(t, 'instagram.com')) return bad(t, INSTAGRAM_COPY.refuse);
  // The server takes only instagram.com / www.instagram.com, http(s), with a path.
  const url = withNormalizedProtocol(t, 'instagram.com');
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if ((host !== 'instagram.com' && host !== 'www.instagram.com') || u.pathname.replace(/\/+$/, '') === '') {
      return bad(t, INSTAGRAM_COPY.refuse);
    }
  } catch {
    return bad(t, INSTAGRAM_COPY.refuse);
  }
  return ok(t, patchValue('instagram', t) as string, url);
}

/** The public display: '@handle' (a pasted profile link is shown as its handle), else 'Instagram'. */
export const instagramDisplay = (value: string | null | undefined): string => extractIgHandle(value ?? null);

// ---- website -----------------------------------------------------------------------------

export const WEBSITE_COPY = {
  refuse: 'Use a web address, like yourschool.com.',
  tooLong: 'That web address is too long.',
  hintEnding: 'Check the ending. Did you mean .com?',
  hintWww: 'Check the www. It has too many w\u2019s.',
  hintComma: 'There is a comma in it. Web addresses use dots.',
  hintInstagram: 'This is an Instagram link. Put it under Instagram instead.',
  hintFacebook: 'This is a Facebook link. Put it under Facebook instead.',
};

/** Trim, remove spaces, repair 'htp://' and 'http//', add https:// when missing. */
export function cleanWebsite(raw: string): string {
  let t = raw.replace(/\s+/g, '');
  if (!t) return '';
  t = t
    .replace(/^ht(tp|p)(s?):\/\//i, (_m, _p, s: string) => `http${s ? 's' : ''}://`) // htp:// htps://
    .replace(/^(https?)\/\//i, '$1://') // http//
    .replace(/^(https?):\/(?!\/)/i, '$1://'); // http:/
  return withNormalizedProtocol(t);
}

export function checkWebsite(raw: string): FieldCheck {
  const value = cleanWebsite(raw);
  if (!value) return ok('', null);
  if (value.length > 2048) return bad(value, WEBSITE_COPY.tooLong);
  let host: string;
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return bad(value, WEBSITE_COPY.refuse);
    host = u.hostname.toLowerCase();
  } catch {
    return bad(value, WEBSITE_COPY.refuse);
  }
  if (!host.includes('.') || !/[a-z]/.test(host)) return bad(value, WEBSITE_COPY.refuse);
  const hints: string[] = [];
  if (/\.(con|cmo|vom|ocm)$/.test(host)) hints.push(WEBSITE_COPY.hintEnding);
  if (/w{4,}/.test(host)) hints.push(WEBSITE_COPY.hintWww);
  if (value.includes(',')) hints.push(WEBSITE_COPY.hintComma);
  if (hostMatchesDomain(host, 'instagram.com')) hints.push(WEBSITE_COPY.hintInstagram);
  if (hostMatchesDomain(host, 'facebook.com') || hostMatchesDomain(host, 'fb.com')) hints.push(WEBSITE_COPY.hintFacebook);
  return ok(value, patchValue('website', value) as string, value, hints);
}

export const websiteDisplay = (value: string | null | undefined): string => extractDomain(value ?? null);

// ---- facebook ----------------------------------------------------------------------------

export const FACEBOOK_COPY = {
  refuse: 'Use your Facebook page name or a facebook.com link.',
  hintProfile: 'This is a personal profile link. A page link, like facebook.com/yourpage, works better for an organiser.',
  hintLogin: 'This is a Facebook sign-in link, not your page. Open your page and copy its address.',
};
const FB_NAME = /^@?[A-Za-z0-9.\-_]{1,50}$/;
const FB_HOSTS = new Set(['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com', 'www.fb.com', 'm.fb.com']);
// A bare "name" that is really a web address of somewhere else.
const LOOKS_LIKE_A_SITE = /^www\.|\.(com|net|org|uk|io|co|info|biz)$/i;

export function checkFacebook(raw: string): FieldCheck {
  const t = raw.trim();
  if (!t) return ok('', null);
  const isLink = /^https?:\/\//i.test(t) || hostMatchesDomain(t, 'facebook.com') || hostMatchesDomain(t, 'fb.com');
  if (!isLink) {
    if (!FB_NAME.test(t) || LOOKS_LIKE_A_SITE.test(t)) return bad(t, FACEBOOK_COPY.refuse);
    const value = `https://facebook.com/${t.replace(/^@/, '')}`;
    return ok(value, patchValue('facebook', value) as string, value);
  }
  if (/\s/.test(t)) return bad(t, FACEBOOK_COPY.refuse);
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(t) ? lowercaseScheme(t) : `https://${t}`);
  } catch {
    return bad(t, FACEBOOK_COPY.refuse);
  }
  const host = u.hostname.toLowerCase();
  const first = u.pathname.split('/').filter(Boolean)[0] ?? '';
  if (!FB_HOSTS.has(host) || (u.protocol !== 'https:' && u.protocol !== 'http:') || !first) return bad(t, FACEBOOK_COPY.refuse);
  // fb.com is Facebook's short host for the same paths. The public page only
  // renders facebook.com links (hostMatchesDomain), so store that host.
  if (host.endsWith('fb.com')) u.hostname = 'facebook.com';
  const value = u.toString();
  const hints: string[] = [];
  const seg = first.toLowerCase();
  if (seg === 'profile.php') hints.push(FACEBOOK_COPY.hintProfile);
  if (seg === 'login' || seg === 'login.php') hints.push(FACEBOOK_COPY.hintLogin);
  return ok(value, patchValue('facebook', value) as string, value, hints);
}

/** '@name' when the path segment is a real page name, else 'Facebook page'. */
export const facebookDisplay = (value: string | null | undefined): string => facebookDisplayLabel(value ?? null);

// ---- about -------------------------------------------------------------------------------

export const ABOUT_MAX = 4000;
export const ABOUT_COPY = {
  tooLong: (n: number) => `About can be at most ${ABOUT_MAX} characters. Yours has ${n}.`,
};

/** Characters as the server counts them (code points, after trimming). */
export const aboutLength = (raw: string): number => Array.from(raw.trim()).length;

export function checkAbout(raw: string): FieldCheck {
  const n = aboutLength(raw);
  if (n === 0) return ok('', null);
  if (n > ABOUT_MAX) return bad(raw, ABOUT_COPY.tooLong(n));
  return ok(raw, patchValue('bio', raw) as string);
}

// ---- category ----------------------------------------------------------------------------

/** The picker: the five real values (prod 2026-10-11), plus None (''). Not free text. */
export const CATEGORY_OPTIONS = ['Dance School', 'Event Brand', 'Community Group', 'Promoter', 'Festival Brand'] as const;

export function checkCategory(raw: string, stored: string | null | undefined = null): FieldCheck {
  const t = raw.trim();
  if (!t) return ok('', null);
  // A stored legacy value outside the list may stay as it is; nothing new outside it.
  if ((CATEGORY_OPTIONS as readonly string[]).includes(t) || (stored && t === stored.trim())) return ok(t, t);
  return bad(t, 'Pick one of the categories.');
}

// ---- photo -------------------------------------------------------------------------------

/** The photo's draft is the public URL of an object already uploaded by the sheet. */
export function checkPhotoUrl(raw: string): FieldCheck {
  const t = raw.trim();
  if (!t) return ok('', null);
  return /^https:\/\/[^\s]+$/i.test(t) ? ok(t, t, t) : bad(t, 'That photo did not upload. Choose it again.');
}

// ---- dispatch ----------------------------------------------------------------------------

export function checkField(field: FieldKey, raw: string, opts: { nowYear?: number; storedCategory?: string | null } = {}): FieldCheck {
  switch (field) {
    case 'name': return checkName(raw);
    case 'city': return checkCity(raw);
    case 'founded_year': return checkYear(raw, opts.nowYear);
    case 'instagram': return checkInstagram(raw);
    case 'website': return checkWebsite(raw);
    case 'facebook': return checkFacebook(raw);
    case 'bio': return checkAbout(raw);
    case 'organisation_category': return checkCategory(raw, opts.storedCategory);
    case 'avatar_url': return checkPhotoUrl(raw);
  }
}

/** How a value reads in a one-line row ('Not added' when empty). */
export function displayValue(field: FieldKey, value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (!v) return 'Not added';
  switch (field) {
    case 'instagram': return instagramDisplay(v);
    case 'facebook': return facebookDisplay(v);
    case 'website': return websiteDisplay(v);
    case 'avatar_url': return 'Photo added';
    default: return v;
  }
}
