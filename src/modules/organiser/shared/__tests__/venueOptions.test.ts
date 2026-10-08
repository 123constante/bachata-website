import { describe, expect, it, vi } from 'vitest';

// publicVenues imports the Supabase client; the client calls are mocked per test.
const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import { loadVenueOptions, venueName, type VenueOption } from '../publicVenues';

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
