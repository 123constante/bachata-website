/**
 * The ONE copy map for ListingRequestForm, per variant. Every gate and
 * empty-city note uses 'event' (EVENT_LISTING_COPY, which the form defaults
 * to); the teachers page "Tell us" passes the 'teacher' copy and link rule.
 * The payload key stays event_link (the RPC column) for both.
 *
 * Only the teachers page (and tests) import this module; see listingFormBase.ts
 * for why the form itself does not.
 */
import type { InstagramResult } from '@/lib/instagramHandle';
import { EVENT_LISTING_COPY, LISTING_URL_RE, eventListingLink, type ListingFormCopy, type ListingLinkRule } from './listingFormBase';

export { type ListingFormCopy } from './listingFormBase';
export { listingSourceUrl } from './listingSourceUrl';

export type ListingFormVariant = 'event' | 'teacher';

export function listingFormCopy(variant: ListingFormVariant, cityName?: string | null): ListingFormCopy {
  if (variant !== 'teacher') return EVENT_LISTING_COPY;
  return {
    heading: cityName ? `Know a teacher in ${cityName}?` : 'Know a teacher?',
    linkLabel: 'Their profile or Instagram link',
    placeholder: '@name or https://',
    hint: 'Paste their Instagram, Facebook or website link. An Instagram name like @name works too.',
    missing: 'Please fill in name, phone, and their link.',
    invalidLink: 'Use their @name or a link starting with http:// or https://',
    success: 'Thanks — we’ll look them up and add them.',
  };
}

/**
 * What the form sends as event_link, or null when it cannot be sent.
 * event: the typed link as is, only when it already starts with http(s)://.
 * teacher: also accepts an Instagram name (@name / name) and a bare domain,
 * turned into a URL here because the RPC only takes ^https?://. The Instagram
 * rule is passed in (normalizeInstagramHandle); without it a name is refused.
 */
export function normalizeListingLink(
  variant: ListingFormVariant,
  raw: string,
  normalizeHandle?: (raw: string) => InstagramResult,
): string | null {
  if (variant !== 'teacher') return eventListingLink(raw);
  const v = raw.trim();
  if (!v) return null;
  if (LISTING_URL_RE.test(v)) return v;
  if (/\s/.test(v) || /^(www\.)?instagram\.com\/?$/i.test(v)) return null;
  const isInstagram = v.startsWith('@') || /^(www\.)?instagram\.com\//i.test(v);
  // Anything else with a dot reads as a website (www.x.com, linktr.ee/x).
  if (!isInstagram && /^[^@/]+\.[a-z]{2,}(\/.*)?$/i.test(v)) return `https://${v}`;
  if (!normalizeHandle) return null;
  const ig = normalizeHandle(v);
  return ig.ok && ig.handle ? `https://instagram.com/${ig.handle}` : null;
}

/**
 * The teacher link rule the teachers page hands the form. The Instagram rule
 * loads on submit: @/lib/instagramHandle rides lib-org-ui (vite.chunks.ts), and
 * a static edge would put that group in the teachers page's first load.
 */
export const teacherListingLink: ListingLinkRule = async (raw) =>
  normalizeListingLink('teacher', raw, (await import('./teacherInstagram')).teacherInstagramHandle);
