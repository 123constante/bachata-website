import { describe, expect, it, vi } from 'vitest';

// publicVenues and venueRequest import the Supabase client; the client calls are mocked per test.
const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import { loadVenueOptions, venueName, type VenueOption } from '../components/publicVenues';
import { emptyVenueRequest, submitVenueRequest, venueRequestOutcome, venueRequestPayload, venueRequestProblems } from '../venueRequest';

const draftVenue: VenueOption = { id: 'v-draft', name: 'New Studio', neighbourhood: null, city_name: 'London', address: null, postcode: 'E1 6AN' };
const listed: VenueOption = { id: 'v-listed', name: 'Pura', neighbourhood: 'Soho', city_name: 'London', address: null, postcode: null };

describe('venue options: the organiser RPC, with the public list as the fallback (Lever 2 B2)', () => {
  it('reads every venue through get_organiser_venue_options_v1', async () => {
    rpc.mockResolvedValueOnce({ data: [draftVenue, listed], error: null });
    const fallback = vi.fn();
    await expect(loadVenueOptions(undefined, fallback)).resolves.toEqual([draftVenue, listed]);
    expect(rpc).toHaveBeenCalledWith('get_organiser_venue_options_v1');
    expect(fallback).not.toHaveBeenCalled();
  });

  it('falls back to the public list when the new RPC errors (not deployed yet, or refused)', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    const fallback = vi.fn().mockResolvedValue([listed]);
    await expect(loadVenueOptions(undefined, fallback)).resolves.toEqual([listed]);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('falls back when the new RPC throws, and fails only when both fail', async () => {
    const boom = () => Promise.reject(new Error('network'));
    await expect(loadVenueOptions(boom, async () => [listed])).resolves.toEqual([listed]);
    await expect(loadVenueOptions(boom, () => Promise.reject(new Error('public down')))).rejects.toThrow('public down');
  });

  it('names a venue from the options, null for none or unknown', () => {
    expect(venueName([draftVenue, listed], 'v-draft')).toBe('New Studio');
    expect(venueName([draftVenue], 'v-missing')).toBeNull();
    expect(venueName(undefined, 'v-draft')).toBeNull();
    expect(venueName([draftVenue], null)).toBeNull();
  });
});

describe('"my venue is missing": a request to the Listing requests queue', () => {
  const ready = { venueName: ' New Studio ', link: ' https://maps.app.goo.gl/abc ', phone: ' +44 7700 900123 ' };

  it('needs a name, an http(s) link and a phone, in form order', () => {
    expect(venueRequestProblems(emptyVenueRequest())).toEqual(['the venue name', 'a link starting with https://', 'a phone number']);
    expect(emptyVenueRequest('New Stu').venueName).toBe('New Stu');
    expect(venueRequestProblems({ ...ready, link: 'maps.google.com/x' })).toEqual(['a link starting with https://']);
    expect(venueRequestProblems({ ...ready, phone: 'call me' })).toEqual(['a phone number']);
    expect(venueRequestProblems(ready)).toEqual([]);
  });

  it('sends section venue_detail, trimmed, with who asked in the name', () => {
    expect(venueRequestPayload(ready, 'Ritmo Socials', 'https://site.example/account/new')).toEqual({
      section: 'venue_detail',
      name: 'New Studio (venue for Ritmo Socials)',
      phone: '+44 7700 900123',
      event_link: 'https://maps.app.goo.gl/abc',
      source_url: 'https://site.example/account/new',
    });
    expect(venueRequestPayload(ready, null, null).name).toBe('New Studio');
  });

  it('reads the RPC answer: ok, a known refusal, anything else', () => {
    expect(venueRequestOutcome({ ok: true, id: 'r1' })).toEqual({ ok: true, message: null });
    // The honeypot path answers ok with no id; still ok to the caller.
    expect(venueRequestOutcome({ ok: true, id: null })).toEqual({ ok: true, message: null });
    expect(venueRequestOutcome({ ok: false, error: 'rate_limited' })).toEqual({ ok: false, message: 'Too many requests from this connection. Try again in an hour.' });
    expect(venueRequestOutcome({ ok: false, error: 'something_new' })).toEqual({ ok: false, message: 'The request did not go through. Try again.' });
    expect(venueRequestOutcome(null)).toEqual({ ok: false, message: 'The request did not go through. Try again.' });
  });

  it('calls submit_listing_request_v1 and throws on a transport error', async () => {
    rpc.mockResolvedValueOnce({ data: { ok: true, id: 'r1' }, error: null });
    await expect(submitVenueRequest(ready, 'Ritmo Socials')).resolves.toEqual({ ok: true, message: null });
    expect(rpc).toHaveBeenLastCalledWith('submit_listing_request_v1', {
      p_payload: expect.objectContaining({ section: 'venue_detail', name: 'New Studio (venue for Ritmo Socials)' }),
    });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(submitVenueRequest(ready, null)).rejects.toEqual({ message: 'boom' });
  });
});
