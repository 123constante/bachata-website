// Unit tests -- the /raffles query functions (src/hooks/useOpenRaffles.ts).
//
// Added with the supabase-defer P1 conversion. This module was one of the two
// module-scope `supabase.rpc.bind(supabase)` blockers and had no test at all,
// while its sibling blocker (raffleWaVerify) did -- so the sibling's conversion
// was checked and this one was not. That asymmetry matters here more than most:
// the page's documented behaviour when the RPCs are missing is an EMPTY list,
// so a wrong RPC name or a dropped await looks exactly like "no raffles today".
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpcMock = vi.fn();

vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: (...args: unknown[]) => rpcMock(...args),
}));

import { fetchOpenRaffles, fetchRaffleStats } from '../useOpenRaffles';

beforeEach(() => {
  rpcMock.mockReset();
});

describe('fetchOpenRaffles', () => {
  it('calls the RPC by the name the admin repo ships', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await fetchOpenRaffles();
    expect(rpcMock).toHaveBeenCalledWith('list_open_raffles_v1');
  });

  it('coerces entry_count from the bigint-as-string the RPC returns', async () => {
    rpcMock.mockResolvedValue({
      data: [{ event_id: 'e1', entry_count: '42' }],
      error: null,
    });
    const [row] = await fetchOpenRaffles();
    expect(row.entry_count).toBe(42);
    expect(typeof row.entry_count).toBe('number');
  });

  it('defaults a missing title and preserves explicit nulls', async () => {
    rpcMock.mockResolvedValue({
      data: [{ event_id: 'e1', venue_name: null, cutoff_offset_minutes: null }],
      error: null,
    });
    const [row] = await fetchOpenRaffles();
    expect(row.title).toBe('Bachata raffle');
    expect(row.venue_name).toBeNull();
    expect(row.cutoff_offset_minutes).toBeNull();
    expect(row.entry_count).toBe(0);
  });

  it('returns an empty list when the RPC hands back a non-array', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    await expect(fetchOpenRaffles()).resolves.toEqual([]);
  });

  it('throws on an RPC error rather than reporting an empty page', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchOpenRaffles()).rejects.toThrow('boom');
  });
});

describe('fetchRaffleStats', () => {
  it('calls its RPC by name and coerces every counter', async () => {
    rpcMock.mockResolvedValue({
      data: { entries_this_month: '7', winners_this_month: 2, total_winners: '13' },
      error: null,
    });
    const stats = await fetchRaffleStats();
    expect(rpcMock).toHaveBeenCalledWith('get_raffle_community_stats_v1');
    expect(stats).toEqual({
      entries_this_month: 7,
      winners_this_month: 2,
      total_winners: 13,
    });
  });

  it('zeroes the counters when the RPC returns nothing usable', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    await expect(fetchRaffleStats()).resolves.toEqual({
      entries_this_month: 0,
      winners_this_month: 0,
      total_winners: 0,
    });
  });

  it('throws on an RPC error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'nope' } });
    await expect(fetchRaffleStats()).rejects.toThrow('nope');
  });
});
