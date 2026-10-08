// "My venue is missing" (Lever 2 B2). The request goes through the channel that already
// exists for it: submit_listing_request_v1 with section 'venue_detail', which lands in the
// admin's Listing requests queue (bachata-admin ListingRequestsAdmin, section "Venue") where
// the team replies on WhatsApp. No new table or admin screen. The RPC needs a name, a phone
// and an http(s) link, and is honeypot-, duplicate- and IP-throttle-aware on its side.

import { supabase } from '@/integrations/supabase/client';

export interface VenueRequestForm {
  venueName: string;
  link: string;
  phone: string;
}

export const emptyVenueRequest = (venueName = ''): VenueRequestForm => ({ venueName, link: '', phone: '' });

const HTTP = /^https?:\/\/\S+$/i;
const PHONE = /^\+?[\d\s()-]{7,20}$/;

/** What is still missing, in form order; empty = ready. */
export function venueRequestProblems(form: VenueRequestForm): string[] {
  const problems: string[] = [];
  if (!form.venueName.trim()) problems.push('the venue name');
  if (!HTTP.test(form.link.trim())) problems.push('a link starting with https://');
  if (!PHONE.test(form.phone.trim())) problems.push('a phone number');
  return problems;
}

/**
 * The RPC's payload. `name` carries the venue and who asked (the queue's row has no other
 * free-text field); `source_url` says it came from the organiser screens.
 */
export function venueRequestPayload(form: VenueRequestForm, organiserName: string | null, sourceUrl: string | null) {
  const venue = form.venueName.trim();
  const who = organiserName?.trim();
  return {
    section: 'venue_detail',
    name: who ? `${venue} (venue for ${who})` : venue,
    phone: form.phone.trim(),
    event_link: form.link.trim(),
    source_url: sourceUrl,
  };
}

const ERRORS: Record<string, string> = {
  rate_limited: 'Too many requests from this connection. Try again in an hour.',
  invalid_event_link: 'The link must start with https://.',
  missing_required_fields: 'Add the venue name, a link and a phone number.',
};

/** The RPC answers { ok, id } or { ok: false, error }; a transport error throws. `message` is null when ok. */
export function venueRequestOutcome(data: unknown): { ok: boolean; message: string | null } {
  const body = (data ?? {}) as { ok?: boolean; error?: string };
  if (body.ok) return { ok: true, message: null };
  return { ok: false, message: (body.error && ERRORS[body.error]) || 'The request did not go through. Try again.' };
}

export async function submitVenueRequest(form: VenueRequestForm, organiserName: string | null) {
  const sourceUrl = typeof window === 'undefined' ? null : window.location.href;
  const { data, error } = await supabase.rpc('submit_listing_request_v1', { p_payload: venueRequestPayload(form, organiserName, sourceUrl) });
  if (error) throw error;
  return venueRequestOutcome(data);
}
