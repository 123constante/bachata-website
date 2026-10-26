/**
 * The ONE copy map for ListingRequestForm, per variant. Every gate and
 * empty-city note uses 'event'; the teachers page "Tell us" uses 'teacher'.
 * The payload key stays event_link (the RPC column) for both.
 */
import { normalizeInstagramHandle } from '@/lib/instagramHandle';

export type ListingFormVariant = 'event' | 'teacher';

export type ListingFormCopy = {
  heading: string | null;
  linkLabel: string;
  placeholder: string;
  hint: string;
  missing: string;
  invalidLink: string;
  success: string;
};

const URL_RE = /^https?:\/\//i;

export function listingFormCopy(variant: ListingFormVariant, cityName?: string | null): ListingFormCopy {
  if (variant === 'teacher') {
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
  return {
    heading: null,
    linkLabel: 'Event link',
    placeholder: 'https://',
    hint: 'Paste a link to your event — your Facebook event, Eventbrite, Instagram post, your own site, anything.',
    missing: 'Please fill in name, phone, and event link.',
    invalidLink: 'Event link must start with http:// or https://',
    success: 'Thanks — I’ll call you soon.',
  };
}

/**
 * What the form sends as event_link, or null when it cannot be sent.
 * event: the typed link as is, only when it already starts with http(s)://.
 * teacher: also accepts an Instagram name (@name / name) and a bare domain,
 * turned into a URL here because the RPC only takes ^https?://.
 */
export function normalizeListingLink(variant: ListingFormVariant, raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (URL_RE.test(v)) return v;
  if (variant !== 'teacher') return null;
  if (/\s/.test(v) || /^(www\.)?instagram\.com\/?$/i.test(v)) return null;
  const isInstagram = v.startsWith('@') || /^(www\.)?instagram\.com\//i.test(v);
  // Anything else with a dot reads as a website (www.x.com, linktr.ee/x).
  if (!isInstagram && /^[^@/]+\.[a-z]{2,}(\/.*)?$/i.test(v)) return `https://${v}`;
  const ig = normalizeInstagramHandle(v);
  return ig.ok && ig.handle ? `https://instagram.com/${ig.handle}` : null;
}

/**
 * The page path + query the receiver sees as "Submitted from". A bare route
 * (/djs) does not name the city a stored-city visitor was looking at, so the
 * slug is added as ?city=<slug> unless the path already carries /city/<slug>/.
 */
export function listingSourceUrl(pathname: string, search: string, citySlug?: string | null): string {
  if (!citySlug || pathname.startsWith(`/city/${citySlug}`)) return pathname + search;
  const q = new URLSearchParams(search);
  q.set('city', citySlug);
  return `${pathname}?${q.toString()}`;
}
