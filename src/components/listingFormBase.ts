/**
 * The form-side half of ListingRequestForm's copy: the type, the event copy
 * every gate and empty-city note shows and the event link rule (the
 * "Submitted from" path is listingSourceUrl.ts). The teacher variant lives in
 * listingRequestCopy.ts and only the teachers page imports it, so the teacher strings and its
 * Instagram rule are not in the first load of every route that loads
 * ComingSoonGate (auth, /app) -- the 2026-10-26 bundle-budget red.
 */
export type ListingFormCopy = {
  heading: string | null;
  linkLabel: string;
  placeholder: string;
  hint: string;
  missing: string;
  invalidLink: string;
  success: string;
};

/** What the form sends as event_link, or null when it cannot be sent (may load code first). */
export type ListingLinkRule = (raw: string) => string | null | Promise<string | null>;

export const LISTING_URL_RE = /^https?:\/\//i;

export const EVENT_LISTING_COPY: ListingFormCopy = {
  heading: null,
  linkLabel: 'Event link',
  placeholder: 'https://',
  hint: 'Paste a link to your event — your Facebook event, Eventbrite, Instagram post, your own site, anything.',
  missing: 'Please fill in name, phone, and event link.',
  invalidLink: 'Event link must start with http:// or https://',
  success: 'Thanks — I’ll call you soon.',
};

/** event: the typed link as is, only when it already starts with http(s)://. */
export function eventListingLink(raw: string): string | null {
  const v = raw.trim();
  return v && LISTING_URL_RE.test(v) ? v : null;
}
