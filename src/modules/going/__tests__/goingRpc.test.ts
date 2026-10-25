/** The hand-typed going RPCs: names, argument shapes, the 200-id chunking and the parsers. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: h.rpc }));

import {
  GoingRpcError,
  fetchMyGoing,
  fetchNightsGoing,
  nightGoingKnown,
  parseGoingNext,
  parseNightGoing,
  setMyGoing,
} from '@/modules/going';

beforeEach(() => h.rpc.mockReset());
// Other modules on the import graph may call rpcLoose too: count only the going RPCs.
const callsOf = (fn: string) => h.rpc.mock.calls.filter(([name]) => name === fn);

const ids = (n: number) => Array.from({ length: n }, (_, i) => `occ-${String(i).padStart(3, '0')}`);

describe('fetchNightsGoing', () => {
  it('one request for up to 200 ids, then one per further 200; every id gets an entry', async () => {
    h.rpc.mockImplementation(async (fn: string, args: { p_occurrence_ids: string[] }) => ({
      data:
        fn === 'get_nights_going_v1'
          ? args.p_occurrence_ids.slice(0, 1).map((id) => ({ occurrence_id: id, going_count: 3, people: [] }))
          : null,
      error: null,
    }));
    const one = await fetchNightsGoing(ids(200));
    expect(callsOf('get_nights_going_v1')).toHaveLength(1);
    expect(h.rpc).toHaveBeenCalledWith('get_nights_going_v1', { p_occurrence_ids: ids(200), p_limit: 8 });
    expect(Object.keys(one)).toHaveLength(200);
    expect(one['occ-000'].going_count).toBe(3);
    // Left out of the reply = not a P5 night: a stand-in marked unknown, never a real "0 going".
    expect(one['occ-199']).toEqual({ occurrence_id: 'occ-199', going_count: 0, people: [], unknown: true });
    expect(nightGoingKnown(one['occ-199'])).toBe(false);
    expect(nightGoingKnown(one['occ-000'])).toBe(true);
    expect(nightGoingKnown(undefined)).toBe(false);

    h.rpc.mockClear();
    await fetchNightsGoing([...ids(401), 'occ-000']);
    expect(callsOf('get_nights_going_v1')).toHaveLength(3);
    expect(callsOf('get_nights_going_v1').map(([, a]) => a.p_occurrence_ids.length)).toEqual([200, 200, 1]);
  });

  it('no ids, no request', async () => {
    expect(await fetchNightsGoing([])).toEqual({});
    expect(callsOf('get_nights_going_v1')).toHaveLength(0);
  });

  it('a refusal is thrown with its code', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'invalid_argument' } });
    await expect(fetchNightsGoing(['a'])).rejects.toMatchObject({ code: 'invalid_argument' });
  });

  it('a thrown fetch is a network error', async () => {
    h.rpc.mockImplementation(async (fn: string) => {
      if (fn === 'get_nights_going_v1') throw new TypeError('Failed to fetch');
      return { data: null, error: null };
    });
    const err = await fetchNightsGoing(['a']).catch((e) => e);
    expect(err).toBeInstanceOf(GoingRpcError);
    expect(err.code).toBe('network');
  });
});

describe('setMyGoing', () => {
  it('sends the occurrence and the boolean, parses the echo', async () => {
    h.rpc.mockResolvedValue({ data: { occurrence_id: 'o1', going: true, changed: true, going_count: 4 }, error: null });
    expect(await setMyGoing('o1', true)).toEqual({ occurrence_id: 'o1', going: true, changed: true, going_count: 4 });
    expect(h.rpc).toHaveBeenCalledWith('set_my_going_v1', { p_occurrence_id: 'o1', p_going: true });
  });
  it.each(['profile_incomplete', 'rate_limited', 'night_ended'])('refusal %s keeps its code', async (code) => {
    h.rpc.mockResolvedValue({ data: null, error: { message: code } });
    await expect(setMyGoing('o1', true)).rejects.toMatchObject({ code });
  });
});

describe('parsers', () => {
  it('a person needs a first name; ids and photos may be null; the count never undercuts the people', () => {
    expect(
      parseNightGoing({
        occurrence_id: 'o',
        going_count: 1,
        people: [
          { dancer_profile_id: null, first_name: 'Ana', photo_url: null },
          { dancer_profile_id: 'd2', first_name: 'Leo', photo_url: 'https://x/y.jpg' },
          { dancer_profile_id: 'd3', first_name: '  ', photo_url: null },
        ],
      }),
    ).toEqual({
      occurrence_id: 'o',
      going_count: 2,
      people: [
        { dancer_profile_id: null, first_name: 'Ana', photo_url: null },
        { dancer_profile_id: 'd2', first_name: 'Leo', photo_url: 'https://x/y.jpg' },
      ],
    });
  });
  it('get_my_going_v1: both lists, never null', async () => {
    h.rpc.mockResolvedValue({ data: { upcoming: [{ occurrence_id: 'o1', is_cancelled: true }], past: null }, error: null });
    const mine = await fetchMyGoing();
    expect(mine.past).toEqual([]);
    expect(mine.upcoming[0]).toMatchObject({ occurrence_id: 'o1', is_cancelled: true, event_title: null });
    expect(h.rpc).toHaveBeenCalledWith('get_my_going_v1', undefined);
  });
  it.each([0, 1, 2, 3])('going_next with %i nights', (n) => {
    const extras = { bio: null, going_next: ids(n).map((id) => ({ occurrence_id: id, starts_at_local: '2026-10-29 21:00:00' })) };
    expect(parseGoingNext(extras)).toHaveLength(n);
  });
  it('hidden page (NULL extras) = no going next', () => expect(parseGoingNext(null)).toEqual([]));
});
