// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { parseSummary, parseTypeRow, TYPE_COLS, withReserved, type SummaryResult } from '../ticketsApi';
import { moveBlock, RESERVED_LOADING, type TicketType } from '../ticketModel';

/**
 * Admin review 1793 R3: ticket_types.reserved_count drops on a refund, so a seat without money could see a
 * refund happened. The Website never selects it; `reserved` comes from ticket_sales_summary_v1, which adds
 * refunded_qty back for a non-money caller. Anything not known from an ok summary fails closed.
 */

const calls = vi.hoisted(() => ({ from: [] as string[], select: [] as string[], rpc: [] as string[] }));
vi.mock('@/integrations/supabase/client', () => {
  const chain: Record<string, unknown> = {};
  for (const k of ['eq', 'order', 'in']) chain[k] = () => chain;
  chain.range = () => Promise.resolve({ data: [{ id: 't1', event_series_id: 's1', name: 'Early', capacity: 50, reserved_count: 4, status: 'on_sale' }], error: null });
  return {
    supabase: {
      from: (t: string) => {
        calls.from.push(t);
        return { select: (cols: string) => { calls.select.push(cols); return chain; } };
      },
      rpc: (fn: string) => { calls.rpc.push(fn); return Promise.resolve({ data: { ok: false, reason: 'x' }, error: null }); },
    },
  };
});

// The real reader (the module is mocked below for the hook tests).
const { fetchSeriesTypes } = await vi.importActual<typeof import('../ticketsApi')>('../ticketsApi');

const typeRow = (id: string, capacity = 50): TicketType => ({ ...parseTypeRow({ id, event_series_id: 's1', name: id, capacity, status: 'on_sale' }) });

/** The summary JSON as the live RPC answers it; `reserved_count` here is the compensated value. */
const summaryJson = (moneyVisible: boolean, rows: { id: string; reserved: number }[]) => ({
  ok: true,
  money_visible: moneyVisible,
  ticket_types: rows.map((r) => ({ id: r.id, event_series_id: 's1', name: r.id, status: 'on_sale', price_pence: 1000, capacity: 50, reserved_count: r.reserved, tickets_sold: r.reserved, gross_pence: 9000 })),
});

describe('ticket_types reads never select reserved_count', () => {
  it('the select string', async () => {
    expect(TYPE_COLS).not.toMatch(/reserved_count/);
    expect(TYPE_COLS).not.toMatch(/\*/);
    calls.select.length = 0;
    await fetchSeriesTypes('o1', 's1');
    expect(calls.from).toContain('ticket_types');
    expect(calls.select.length).toBeGreaterThan(0);
    for (const s of calls.select) {
      expect(s).not.toMatch(/reserved_count/);
      expect(s).not.toMatch(/\*/);
    }
  });
  it('a row that still carries reserved_count is not read for it: unknown until the summary says', async () => {
    const [t] = await fetchSeriesTypes('o1', 's1');
    expect(t).toMatchObject({ reserved: 0, reservedKnown: false });
  });
});

type Seat = 'money seat' | 'non-money seat';
type Sum = 'ok' | 'not ok' | 'missing (error / not loaded)' | 'type missing';
const SEATS: Seat[] = ['money seat', 'non-money seat'];
const SUMS: Sum[] = ['ok', 'not ok', 'missing (error / not loaded)', 'type missing'];

const summaryFor = (seat: Seat, s: Sum): SummaryResult | undefined => {
  const money = seat === 'money seat';
  if (s === 'not ok') return parseSummary({ ok: false, reason: 'not_authorised' }, { money });
  if (s === 'missing (error / not loaded)') return undefined;
  // A non-money seat's server value already has refunded tickets added back (7 = 5 held + 2 refunded).
  const reserved = money ? 5 : 7;
  return parseSummary(summaryJson(money, s === 'type missing' ? [{ id: 'other', reserved }] : [{ id: 't1', reserved }]), { money });
};

describe('withReserved: seat x summary', () => {
  for (const seat of SEATS) {
    for (const s of SUMS) {
      it(`${seat}, summary ${s}`, () => {
        const [t] = withReserved([typeRow('t1')], summaryFor(seat, s));
        if (s === 'ok') {
          expect(t).toMatchObject({ reserved: seat === 'money seat' ? 5 : 7, reservedKnown: true });
          expect(moveBlock(t, 'on_sale', { role: 'owner', stripe: 'connected', seriesLive: true })).toBeNull();
        } else {
          // Fail closed: never a guessed 0 that a decision runs on.
          expect(t).toMatchObject({ reserved: 0, reservedKnown: false });
          expect(moveBlock(t, 'on_sale', { role: 'owner', stripe: 'connected', seriesLive: true })).toBe(RESERVED_LOADING);
        }
      });
    }
  }
  it('every reserved count taken = the old "every ticket is taken" block, unchanged', () => {
    const [t] = withReserved([typeRow('t1', 5)], summaryFor('money seat', 'ok'));
    expect(moveBlock(t, 'on_sale', { role: 'owner', stripe: 'connected', seriesLive: true })).toBe('Every ticket is taken. Raise the number of tickets first.');
  });
  it('a move that is not to on_sale does not wait on the count (pausing stays possible)', () => {
    const [t] = withReserved([typeRow('t1')], undefined);
    expect(moveBlock(t, 'paused', { role: 'owner', stripe: 'connected', seriesLive: true })).toBeNull();
  });
});

// ---- useSeriesTypes: the summary is the shared query, and the types wait for it -------------------

const api = vi.hoisted(() => ({ fetchSeriesTypes: vi.fn(), fetchSalesSummary: vi.fn() }));
vi.mock('../ticketsApi', async (orig) => ({ ...(await orig<typeof import('../ticketsApi')>()), ...api }));
// Imported after the mock so data.ts sees the mocked fetchers.
const { useSeriesTypes, useSummary } = await import('../../p3/tickets/data');

const wrap = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('useSeriesTypes', () => {
  beforeEach(() => {
    api.fetchSeriesTypes.mockReset().mockResolvedValue([typeRow('t1')]);
    api.fetchSalesSummary.mockReset();
  });
  it('not loaded while the summary is pending; filled once it lands', async () => {
    let land: (v: SummaryResult) => void = () => undefined;
    api.fetchSalesSummary.mockReturnValue(new Promise<SummaryResult>((r) => { land = r; }));
    const { result } = renderHook(() => useSeriesTypes('o1', 's1', true), { wrapper: wrap() });
    await waitFor(() => expect(api.fetchSeriesTypes).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
    land(summaryFor('money seat', 'ok') as SummaryResult);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({ reserved: 5, reservedKnown: true });
  });
  it('a failed summary: loaded, but every type unknown (fail closed)', async () => {
    api.fetchSalesSummary.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useSeriesTypes('o1', 's1', false), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({ reserved: 0, reservedKnown: false });
  });
  it('shares the summary query with useSummary: one request, same money flag', async () => {
    api.fetchSalesSummary.mockResolvedValue(summaryFor('non-money seat', 'ok'));
    const { result } = renderHook(() => ({ s: useSummary('o1', false), t: useSeriesTypes('o1', 's1', false) }), { wrapper: wrap() });
    await waitFor(() => expect(result.current.t.isSuccess).toBe(true));
    expect(api.fetchSalesSummary).toHaveBeenCalledTimes(1);
    expect(api.fetchSalesSummary).toHaveBeenCalledWith('o1', { money: false });
    expect(result.current.t.data?.[0]).toMatchObject({ reserved: 7, reservedKnown: true });
  });
});
