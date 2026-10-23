// =============================================================================
// instagramHandle -- the ONE stored-Instagram rule: the bare name, lower case.
//
// Normalising mirrors the server's normalize_instagram_handle_v1 step for step
// (lower + trim, drop an optional http(s):// + www. + instagram.com/, drop one
// leading @, cut at the first / or ?). The validator is A1's addition to it:
// at most 30 characters, only letters, numbers, dots and underscores, no dot at
// either end and no two dots together, else `invalid_instagram`. Parity is a
// test, not a copy: both sides run src/lib/__fixtures__/phone-instagram-cases.json.
//
// Display still goes through extractIgHandle (organiserLinkLabels), so a legacy
// stored link and a new bare name read the same '@name' everywhere.
// =============================================================================

import { IG_NON_HANDLE_PATHS, extractIgHandle } from '@/lib/organiserLinkLabels';

/** The server's refusal code for an Instagram name that breaks the rule (agreed name, A1). */
export const INVALID_INSTAGRAM = 'invalid_instagram';
export const INSTAGRAM_MAX = 30;

export type InstagramProblem = 'too_long' | 'characters' | 'dots';

export type InstagramResult =
  | { ok: true; handle: string | null }
  | { ok: false; code: typeof INVALID_INSTAGRAM; problem: InstagramProblem };

/** What the person is told for each problem: what to change, never the code. */
export const INSTAGRAM_PROBLEM_COPY: Record<InstagramProblem, string> = {
  too_long: `Instagram names are ${INSTAGRAM_MAX} characters or fewer.`,
  characters: 'Use only letters, numbers, dots and underscores.',
  dots: 'It cannot start or end with a dot, or have two dots together.',
};

/** The server's normaliser, as it is (no validation): null when nothing is left. */
export function stripInstagram(raw: string | null | undefined): string | null {
  const lowered = (raw ?? '').replace(/^ +| +$/g, '').toLowerCase();
  const bare = lowered
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, '')
    .replace(/^@/, '')
    .replace(/[/?].*$/, '');
  return bare === '' ? null : bare;
}

/** Normalise and check one typed value. Empty (or a link with no name) is a clear: handle null. */
export function normalizeInstagramHandle(raw: string | null | undefined): InstagramResult {
  const handle = stripInstagram(raw);
  if (handle === null) return { ok: true, handle: null };
  if (handle.length > INSTAGRAM_MAX) return { ok: false, code: INVALID_INSTAGRAM, problem: 'too_long' };
  if (!/^[a-z0-9._]+$/.test(handle)) return { ok: false, code: INVALID_INSTAGRAM, problem: 'characters' };
  if (/^\.|\.$|\.\./.test(handle)) return { ok: false, code: INVALID_INSTAGRAM, problem: 'dots' };
  return { ok: true, handle };
}

/** A non-empty box that leaves no name (a bare instagram.com link): refused at the field, never saved as a clear. */
export const INSTAGRAM_NO_NAME = 'That link has no Instagram name in it.';
/** A link that is not an instagram.com profile link (another site, m.instagram.com, no name). */
export const INSTAGRAM_NOT_PROFILE_LINK = 'Use your Instagram name, like @yourname, or your profile link from instagram.com.';
/** An instagram.com link to a post, reel or story: it has no name in it. */
export const INSTAGRAM_POST_LINK = 'That is a link to a post, not a profile. Use your @name or your profile link instead.';

const PROFILE_LINK = /^(https?:\/\/)?(www\.)?instagram\.com\/([^/?#]+)/i;

export type InstagramFieldCheck =
  | { ok: true; handle: string | null }
  | { ok: false; error: string };

/** What a typed box would save: the bare name, null to clear, or the words saying what to change. */
export function checkInstagramField(raw: string): InstagramFieldCheck {
  // The field is stricter than the stored rule about LINKS only: anything with a / or : (or an
  // instagram.com host) must be an instagram.com profile link, so "m.instagram.com/x" or a post
  // link is refused here instead of being cut down to a wrong name. Everything it lets through
  // is then exactly the server's rule.
  const t = raw.trim();
  if (/[/:]/.test(t) || /^(www\.|m\.)?instagram\.com/i.test(t)) {
    const m = t.match(PROFILE_LINK);
    if (!m) return { ok: false, error: INSTAGRAM_NOT_PROFILE_LINK };
    if (IG_NON_HANDLE_PATHS.includes(m[3].toLowerCase())) return { ok: false, error: INSTAGRAM_POST_LINK };
  }
  const r = normalizeInstagramHandle(raw);
  if ('problem' in r) return { ok: false, error: INSTAGRAM_PROBLEM_COPY[r.problem] };
  if (r.handle === null && raw.trim() !== '' && raw.trim() !== '@') return { ok: false, error: INSTAGRAM_NO_NAME };
  return { ok: true, handle: r.handle };
}

/** The profile link the "tap to check it's you" line opens. */
export const instagramProfileUrl = (handle: string): string => `https://instagram.com/${encodeURIComponent(handle)}`;

/** '@name' for any stored value (bare name, @name or a legacy link), else 'Instagram'. */
export const instagramDisplay = (stored: string | null | undefined): string => extractIgHandle(stored ?? null);
