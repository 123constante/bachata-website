import { beforeEach, describe, expect, it, vi } from 'vitest';

// The exact RPC name and argument keys of the line-up picker
// (organiser_search_people_v1: p_query, p_role, p_limit). A renamed key would
// reach PostgREST as "function not found".

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));

import { searchPeople } from '../selfServeApi';

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [], error: null });
});

describe('searchPeople', () => {
  it('calls organiser_search_people_v1 with p_query (trimmed), p_role and p_limit only', async () => {
    await searchPeople('  ana  ', 'teaching');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]).toEqual(['organiser_search_people_v1', { p_query: 'ana', p_role: 'teaching', p_limit: 20 }]);
  });

  it('never calls the server for under 2 characters (it refuses them)', async () => {
    expect(await searchPeople(' a ', 'djing')).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps rows, preferring the DJ name for a DJ and the public name for a teacher', async () => {
    const row = { id: 'p1', display_name: 'Ana Ruiz', dj_name: 'DJ Ana', photo_url: null, city_name: 'Leeds', country_code: 'GB', roles: ['djing', 'teaching'] };
    rpc.mockResolvedValue({ data: [row, { ...row, id: null }], error: null });
    expect(await searchPeople('ana', 'djing')).toEqual([{ id: 'p1', name: 'DJ Ana', photoUrl: null, place: 'Leeds, GB' }]);
    expect((await searchPeople('ana', 'teaching'))[0].name).toBe('Ana Ruiz');
  });

  it('throws the PostgREST error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'permission_denied: x', code: 'P0001' } });
    await expect(searchPeople('ana', 'teaching')).rejects.toMatchObject({ message: 'permission_denied: x' });
  });
});
