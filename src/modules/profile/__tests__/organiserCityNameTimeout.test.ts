// The city NAME is garnish on the organiser entity: if its lookup is slow or fails, the entity still resolves
// (cities: null) after CITY_NAME_TIMEOUT_MS instead of holding every screen that waits for it.
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ cityLookup: 'hang' as 'hang' | 'throw' | 'ok' }));
vi.mock('@/integrations/supabase/client', () => {
  const chain = (table: string) => {
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.eq = () => q;
    q.not = () => q;
    q.maybeSingle = () => {
      if (table === 'organiser_profiles') return Promise.resolve({ data: { id: 'o1', city_id: 'c1' }, error: null });
      if (state.cityLookup === 'hang') return new Promise(() => {});
      if (state.cityLookup === 'throw') return Promise.reject(new Error('boom'));
      return Promise.resolve({ data: { name: 'London', slug: 'london' }, error: null });
    };
    return q;
  };
  return { supabase: { from: chain, rpc: vi.fn() } };
});

import { CITY_NAME_TIMEOUT_MS, fetchOwnOrganiserEntity } from '../organiserPublicProfile';

afterEach(() => vi.useRealTimers());

describe('organiser entity city name lookup', () => {
  it('a lookup that never answers resolves with cities: null after the timeout', async () => {
    vi.useFakeTimers();
    state.cityLookup = 'hang';
    const p = fetchOwnOrganiserEntity('o1');
    await vi.advanceTimersByTimeAsync(CITY_NAME_TIMEOUT_MS + 10);
    await expect(p).resolves.toMatchObject({ id: 'o1', city_id: 'c1', cities: null });
  });
  it('a lookup that fails resolves with cities: null at once', async () => {
    state.cityLookup = 'throw';
    await expect(fetchOwnOrganiserEntity('o1')).resolves.toMatchObject({ cities: null });
  });
  it('a lookup that answers is used', async () => {
    state.cityLookup = 'ok';
    await expect(fetchOwnOrganiserEntity('o1')).resolves.toMatchObject({ cities: { name: 'London' } });
  });
});
