import { describe, expect, it, vi } from 'vitest';
import { resolveCreateCityId } from '../createCity';

// The default resolver is never reached here (every case injects one or has no venue city);
// the mock keeps the Supabase client, which needs env, out of this pure test.
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: vi.fn() }));

describe('resolveCreateCityId (Lever 2 B1)', () => {
  it('uses the venue city, resolved to an id, ahead of the organiser city', async () => {
    const resolveCity = vi.fn().mockResolvedValue({ cityId: 'city-venue' });
    expect(await resolveCreateCityId({ venueCityName: 'London', organiserCityId: 'city-org', resolveCity })).toBe('city-venue');
    expect(resolveCity).toHaveBeenCalledWith('London');
  });

  it('uses the organiser city when the venue has no city, without calling the resolver', async () => {
    const resolveCity = vi.fn();
    expect(await resolveCreateCityId({ venueCityName: null, organiserCityId: 'city-org', resolveCity })).toBe('city-org');
    expect(await resolveCreateCityId({ venueCityName: '  ', organiserCityId: 'city-org', resolveCity })).toBe('city-org');
    expect(resolveCity).not.toHaveBeenCalled();
  });

  it('falls back to the organiser city when the venue city does not resolve or the resolver throws', async () => {
    expect(await resolveCreateCityId({ venueCityName: 'Atlantis', organiserCityId: 'city-org', resolveCity: async () => null })).toBe('city-org');
    expect(
      await resolveCreateCityId({ venueCityName: 'London', organiserCityId: 'city-org', resolveCity: async () => { throw new Error('x'); } }),
    ).toBe('city-org');
  });

  it('returns null when neither exists, so the key is omitted', async () => {
    expect(await resolveCreateCityId({ venueCityName: null, organiserCityId: null })).toBeNull();
    expect(await resolveCreateCityId({ venueCityName: 'Atlantis', organiserCityId: null, resolveCity: async () => null })).toBeNull();
  });
});
