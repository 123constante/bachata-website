// @vitest-environment jsdom
/**
 * useNightGoing / useNightsGoing / useMyGoing: many rows share ONE nights
 * request; the switch off runs no RPC; the write invalidates exactly the reads
 * that show that night (and the viewer's list), and nothing else.
 */
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ on: true, rpc: vi.fn(), user: { id: 'u1' } as null | { id: string; is_anonymous?: boolean } }));
vi.mock('@/lib/goingCheckin', () => ({
  get GOING_CHECKIN_ENABLED() {
    return h.on;
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (fn: string, a?: unknown) => h.rpc(fn, a) }));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: false }),
}));

import { GOING_COPY, goingKeys, invalidateGoing, useMyGoing, useNightGoing } from '@/modules/going';

let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);
const callsOf = (fn: string) => h.rpc.mock.calls.filter(([n]) => n === fn);

beforeEach(() => {
  h.on = true;
  h.user = { id: 'u1' };
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  h.rpc.mockReset();
  h.rpc.mockImplementation(async (fn: string, a: { p_occurrence_ids?: string[] }) => {
    if (fn === 'get_nights_going_v1') return { data: (a.p_occurrence_ids ?? []).map((id) => ({ occurrence_id: id, going_count: 1, people: [] })), error: null };
    if (fn === 'get_my_going_v1') return { data: { upcoming: [], past: [] }, error: null };
    return { data: null, error: null };
  });
});
afterEach(cleanup);

const finished = { kind: 'finished' } as const;

describe('batching', () => {
  it('three rows on one screen share ONE nights request', async () => {
    const batch = ['c', 'a', 'b'];
    renderHook(
      () => [
        useNightGoing({ occurrenceId: 'a', night: 'live', batchIds: batch, viewer: finished }),
        useNightGoing({ occurrenceId: 'b', night: 'live', batchIds: batch, viewer: finished }),
        useNightGoing({ occurrenceId: 'c', night: 'live', batchIds: batch, viewer: finished }),
      ],
      { wrapper },
    );
    await waitFor(() => expect(callsOf('get_nights_going_v1')).toHaveLength(1));
    expect(callsOf('get_nights_going_v1')[0][1]).toEqual({ p_occurrence_ids: ['a', 'b', 'c'], p_limit: 8 });
    await waitFor(() => expect(callsOf('get_my_going_v1')).toHaveLength(1));
  });

  it('switch off: no going RPC at all', async () => {
    h.on = false;
    const { result } = renderHook(() => useNightGoing({ occurrenceId: 'a', night: 'live', viewer: finished }), { wrapper });
    renderHook(() => useMyGoing(), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    const going = h.rpc.mock.calls.filter(([n]) => /going/.test(n));
    expect(going).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('anonymous viewer: no own-list read', async () => {
    h.user = { id: 'anon', is_anonymous: true };
    renderHook(() => useNightGoing({ occurrenceId: 'a', night: 'live', viewer: { kind: 'anonymous' } }), { wrapper });
    await waitFor(() => expect(callsOf('get_nights_going_v1')).toHaveLength(1));
    expect(callsOf('get_my_going_v1')).toHaveLength(0);
  });
});

describe('a count the database did not give is never claimed', () => {
  it.each([
    ['the nights read failed', async () => ({ data: null, error: { message: 'boom' } })],
    ['the id was dropped (unknown night)', async () => ({ data: [], error: null })],
  ])('%s: no "Be the first" line, the button still taps', async (_n, nightsReply) => {
    h.rpc.mockImplementation(async (fn: string) => {
      if (fn === 'get_nights_going_v1') return nightsReply();
      if (fn === 'get_my_going_v1') return { data: { upcoming: [], past: [] }, error: null };
      return { data: null, error: null };
    });
    const { result } = renderHook(() => useNightGoing({ occurrenceId: 'a', night: 'live', viewer: finished }), { wrapper });
    await waitFor(() => expect(result.current.view.state).toBe('can_tap'));
    await waitFor(() => expect(result.current.peopleLoading).toBe(false));
    expect(result.current.countKnown).toBe(false);
    expect(result.current.view.words).toBeNull();
    expect(result.current.view.control.enabled).toBe(true);
  });
  it('a save in flight bumps the count but keeps peopleCount at what the list was read with', async () => {
    h.rpc.mockImplementation(async (fn: string, a: { p_occurrence_ids?: string[] }) => {
      if (fn === 'get_nights_going_v1') return { data: (a.p_occurrence_ids ?? []).map((id) => ({ occurrence_id: id, going_count: 3, people: [] })), error: null };
      if (fn === 'get_my_going_v1') return { data: { upcoming: [], past: [] }, error: null };
      if (fn === 'set_my_going_v1') return new Promise(() => {});
      return { data: null, error: null };
    });
    const { result } = renderHook(() => useNightGoing({ occurrenceId: 'a', night: 'live', viewer: finished }), { wrapper });
    await waitFor(() => expect(result.current.view.state).toBe('can_tap'));
    await waitFor(() => expect(result.current.count).toBe(3));
    act(() => result.current.tap());
    await waitFor(() => expect(result.current.count).toBe(4));
    expect(result.current.peopleCount).toBe(3);
  });
  it('a known 0 still invites', async () => {
    h.rpc.mockImplementation(async (fn: string, a: { p_occurrence_ids?: string[] }) => {
      if (fn === 'get_nights_going_v1') return { data: (a.p_occurrence_ids ?? []).map((id) => ({ occurrence_id: id, going_count: 0, people: [] })), error: null };
      if (fn === 'get_my_going_v1') return { data: { upcoming: [], past: [] }, error: null };
      return { data: null, error: null };
    });
    const { result } = renderHook(() => useNightGoing({ occurrenceId: 'a', night: 'live', viewer: finished }), { wrapper });
    await waitFor(() => expect(result.current.countKnown).toBe(true));
    expect(result.current.view.words).toBe(GOING_COPY.beFirst);
  });
});

describe('keys and invalidation', () => {
  it('a nights key is the sorted, de-duplicated id set', () => {
    expect(goingKeys.nights(['b', 'a', 'b'])).toEqual(['going', 'nights', 8, 'a', 'b']);
    expect(goingKeys.mine('u1')).toEqual(['going', 'mine', 'u1']);
  });

  it('invalidateGoing hits every nights read holding that night and the own list, nothing else', async () => {
    qc.setQueryData(goingKeys.nights(['a', 'b']), {});
    qc.setQueryData(goingKeys.nights(['x']), {});
    qc.setQueryData(goingKeys.mine('u1'), { upcoming: [], past: [] });
    qc.setQueryData(['event-page', 'p'], {});
    await invalidateGoing(qc, 'a');
    const stale = (k: readonly unknown[]) => qc.getQueryState(k)?.isInvalidated;
    expect(stale(goingKeys.nights(['a', 'b']))).toBe(true);
    expect(stale(goingKeys.mine('u1'))).toBe(true);
    expect(stale(goingKeys.nights(['x']))).toBe(false);
    expect(stale(['event-page', 'p'])).toBe(false);
  });

  it('the write updates every list holding that night, then rolls back on a refusal', async () => {
    h.rpc.mockImplementation(async (fn: string, a: { p_occurrence_ids?: string[] }) => {
      if (fn === 'get_nights_going_v1') return { data: (a.p_occurrence_ids ?? []).map((id) => ({ occurrence_id: id, going_count: 1, people: [] })), error: null };
      if (fn === 'get_my_going_v1') return { data: { upcoming: [], past: [] }, error: null };
      if (fn === 'set_my_going_v1') return { data: null, error: { message: 'rate_limited' } };
      return { data: null, error: null };
    });
    const { result } = renderHook(() => useNightGoing({ occurrenceId: 'a', night: 'live', viewer: finished }), { wrapper });
    await waitFor(() => expect(result.current.view.state).toBe('can_tap'));
    expect(result.current.count).toBe(1);
    act(() => result.current.tap());
    await waitFor(() => expect(result.current.view.state).toBe('rate_limited'));
    expect(result.current.count).toBe(1);
    expect(result.current.view.going).toBe(false);
  });
});
