// =============================================================================
// instagramHandle -- the ONE stored-Instagram rule: the bare name, lower case.
//
// Normalising mirrors the server's normalize_instagram_handle_v1 step for step
// (lower + trim, drop an optional http(s):// + www. + instagram.com/, drop one
// leading @, cut at the first / or ?). The validator is A1's addition to it:
// at most 30 characters, only letters, numbers, dots and underscores, no dot at
// either end, no two dots together and not a reserved path segment (p, reel,
// reels, tv, explore, stories, accounts), else `invalid_instagram`. Parity is a
// test, not a copy: both sides run src/lib/__fixtures__/phone-instagram-cases.json.
//
// Import-free on purpose: the dancer app and the organiser screens share it, and
// an import of organiserLinkLabels dragged two more chunks onto /app (budget).
// =============================================================================


/** The server's refusal code for an Instagram name that breaks the rule (agreed name, A1). */
export const INVALID_INSTAGRAM = 'invalid_instagram';
export const INSTAGRAM_MAX = 30;

export type InstagramProblem = 'too_long' | 'characters' | 'dots' | 'reserved' | 'no_name';

export type InstagramResult =
  | { ok: true; handle: string | null }
  | { ok: false; code: typeof INVALID_INSTAGRAM; problem: InstagramProblem };

/** A non-empty box that leaves no name (a bare instagram.com link, '@' alone): refused, never saved as a clear. */
export const INSTAGRAM_NO_NAME = 'That link has no Instagram name in it.';

/** What the person is told for each problem: what to change, never the code. */
export const INSTAGRAM_PROBLEM_COPY: Record<InstagramProblem, string> = {
  too_long: `Instagram names are ${INSTAGRAM_MAX} characters or fewer.`,
  characters: 'Use only letters, numbers, dots and underscores.',
  dots: 'It cannot start or end with a dot, or have two dots together.',
  no_name: INSTAGRAM_NO_NAME,
  reserved: 'That is part of an Instagram link, not a name. Use your @name or your profile link instead.',
};

/** Path segments that are never a profile name (the server's reserved list, A1). */
export const INSTAGRAM_RESERVED = ['p', 'reel', 'reels', 'tv', 'explore', 'stories', 'accounts'] as const;

/** The server's normaliser, as it is (no validation): null when nothing is left. */
export function stripInstagram(raw: string | null | undefined): string | null {
  const lowered = (raw ?? '').replace(/^ +| +$/g, '').toLowerCase();
  const bare = lowered
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, '')
    .replace(/^@/, '')
    .replace(/[/?].*$/, '');
  return bare === '' ? null : bare;
}

/** Normalise and check one typed value. Empty is a clear (handle null); a box that leaves no name is refused. */
export function normalizeInstagramHandle(raw: string | null | undefined): InstagramResult {
  if (raw == null || raw.trim() === '') return { ok: true, handle: null };
  const handle = stripInstagram(raw);
  if (handle === null) return { ok: false, code: INVALID_INSTAGRAM, problem: 'no_name' };
  if (handle.length > INSTAGRAM_MAX) return { ok: false, code: INVALID_INSTAGRAM, problem: 'too_long' };
  if (!/^[a-z0-9._]+$/.test(handle)) return { ok: false, code: INVALID_INSTAGRAM, problem: 'characters' };
  if (/^\.|\.$|\.\./.test(handle)) return { ok: false, code: INVALID_INSTAGRAM, problem: 'dots' };
  if ((INSTAGRAM_RESERVED as readonly string[]).includes(handle)) return { ok: false, code: INVALID_INSTAGRAM, problem: 'reserved' };
  return { ok: true, handle };
}

/** The owner's words for an Instagram that cannot be saved (instagram-refusal r2, 2026-11-02): the field and the server's refusal say the same. */
export const INSTAGRAM_INVALID = 'Enter your Instagram handle (like @yourname) or a full instagram.com link.';
/** A link that is not an instagram.com profile link (another site, no name). */
export const INSTAGRAM_NOT_PROFILE_LINK = INSTAGRAM_INVALID;
/** An instagram.com link to a post, reel or story: it has no name in it. */
export const INSTAGRAM_POST_LINK = 'That is a link to a post, not a profile. Use your @name or your profile link instead.';

// The www. and m. hosts are both profile links (m. is what phone share sheets produce; fix1 F1).
const PROFILE_LINK = /^(https?:\/\/)?(www\.|m\.)?instagram\.com\/([^/?#]+)/i;

export type InstagramFieldCheck =
  | { ok: true; handle: string | null }
  | { ok: false; error: string };

/** What a typed box would save: the bare name, null to clear, or the words saying what to change. */
export function checkInstagramField(raw: string): InstagramFieldCheck {
  // The field is stricter than the stored rule about LINKS only: anything with a / or : (or an
  // instagram.com host) must be an instagram.com profile link, so another site or a post link
  // is refused here instead of being cut down to a wrong name. An m. link is read as the same
  // link without the m. (the server's normaliser only knows www.), so what is saved is still
  // the bare name. Everything it lets through is then exactly the server's rule.
  let t = raw.trim();
  if (/[/:]/.test(t) || /^(www\.|m\.)?instagram\.com/i.test(t)) {
    const m = t.match(PROFILE_LINK);
    if (!m) return { ok: false, error: INSTAGRAM_NOT_PROFILE_LINK };
    if ((INSTAGRAM_RESERVED as readonly string[]).includes(m[3].toLowerCase())) return { ok: false, error: INSTAGRAM_POST_LINK };
    if (m[2]?.toLowerCase() === 'm.') t = (m[1] ?? '') + t.slice((m[1] ?? '').length + 2);
  }
  const r = normalizeInstagramHandle(t);
  if ('problem' in r) return { ok: false, error: INSTAGRAM_PROBLEM_COPY[r.problem] };
  return { ok: true, handle: r.handle };
}

/**
 * The name in an instagram.com PROFILE link, else null. The field's own rule decides
 * (checkInstagramField ok with a name: www. and m. accepted; post and reel links
 * are not profile links), and only a value that IS a link counts, so a bare word
 * or "example.com" in a Website box is never read as an Instagram name.
 */
export function instagramProfileLinkHandle(raw: string): string | null {
  const t = raw.trim();
  if (!PROFILE_LINK.test(t)) return null;
  const r = checkInstagramField(t);
  return r.ok && r.handle !== null ? r.handle : null;
}

/** The profile link the "tap to check it's you" line opens. */
export const instagramProfileUrl = (handle: string): string => `https://instagram.com/${encodeURIComponent(handle)}`;

