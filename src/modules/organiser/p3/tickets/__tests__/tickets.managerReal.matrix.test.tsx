// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  NOT_MANAGER_REFUND,
  NOT_OWNER_REFUND,
  buyerFirstAndCode,
  refundQuestion,
  refundable,
  refundableByStatus,
  shortRef,
  type Order,
} from '../../../tickets/ticketModel';
import { ORDER_SELECT_COUNTS, parseOrderRow, parseSummary } from '../../../tickets/ticketsApi';
import { shortRef as reportShortRef } from '../salesReportModel';
import { SHAPES, type Shape } from './fixtures';
import { dataMock, load, ok, q, show } from './harness';

/*
 * Fix round 1 (review 1520-r1). The manager cells on the payload the screen REALLY gets:
 * F1 a non-owner's orders are parseOrderRow of rows shaped by ORDER_SELECT_COUNTS (no pence key), so
 *    the ask-the-owner notes must hang off the order status, never off pence the read never fetched;
 * F3 a non-owner's sales summary keeps no pence once parsed, so none reaches the query cache;
 * F4 one order code (shortRef, 8 characters) on the list, the Refund sheet and the guest list.
 * Prod (2026-11-10): entity_members organiser rows are owner 21, manager 43, contributor 0, so the
 * contributor cells are the legacy row (A1), kept but unreachable today. Non-ASCII by escape only.
 */

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-27' }));
vi.mock('../data', (orig) => dataMock(orig as never));
const api = vi.hoisted(() => ({ setTicketStatus: vi.fn(), upsertTicketType: vi.fn(), refundOrder: vi.fn() }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), ...api }));

import { TicketsEntry } from '../TicketsEntry';

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const POUND = /\u00A3/;
const COLS = ORDER_SELECT_COUNTS.split(',').map((c) => c.trim());
/** A raw ticket_orders row as PostgREST answers ORDER_SELECT_COUNTS: only those columns. */
const countsRow = (r: Record<string, unknown>) => Object.fromEntries(COLS.map((c) => [c, r[c] ?? null]));
// Prod order shapes: paid, partly refunded (still paid), refunded in full, disputed, expired (not shown).
const RAW = [
  { id: '3f2a9c1e-0000-4000-8000-000000000001', ticket_type_id: 't-sell', buyer_name: 'Ana Maria', quantity: 2, status: 'paid', paid_at: '2026-10-27T10:00:00Z' },
  { id: '7b11d2aa-0000-4000-8000-000000000002', ticket_type_id: 't-sell', buyer_name: 'Jo', quantity: 1, status: 'paid', paid_at: '2026-10-26T10:00:00Z' },
  { id: 'c0ffee00-0000-4000-8000-000000000003', ticket_type_id: 't-sell', buyer_name: null, quantity: 1, status: 'refunded', paid_at: '2026-10-25T10:00:00Z' },
  { id: 'd15b0000-0000-4000-8000-000000000004', ticket_type_id: 't-sell', buyer_name: 'Lu', quantity: 1, status: 'disputed', paid_at: '2026-10-24T10:00:00Z' },
  { id: 'e0e0e0e0-0000-4000-8000-000000000005', ticket_type_id: 't-sell', buyer_name: 'Ex', quantity: 1, status: 'expired', paid_at: null },
].map(countsRow);
const REAL: Order[] = RAW.map(parseOrderRow);
const PAID = REAL.filter((o) => o.status === 'paid');

const realShape = (role: string): Shape => ({ ...SHAPES.selling, orders: REAL, role });
const openOrders = () => {
  fireEvent.click(screen.getByTestId('tix-row'));
  const all = screen.queryByTestId('tix-see-all');
  if (all) fireEvent.click(all);
};
const row = (id: string) => screen.queryByTestId(`tix-order-${id}`);

describe('the counts read really carries no pence (why F1 was dead)', () => {
  it('ORDER_SELECT_COUNTS names no pence column, so every parsed amount is 0', () => {
    expect(COLS.some((c) => /pence/.test(c))).toBe(false);
    for (const o of REAL) expect([o.totalPence, o.refundedPence, o.subtotalPence, o.bookingFeePence]).toEqual([0, 0, 0, 0]);
  });
  it.each(['paid', 'refunded', 'disputed', 'pending', 'expired', ''])('status %j: refundableByStatus is status === paid', (status) => {
    const o = parseOrderRow(countsRow({ id: 'x', ticket_type_id: 't', status }));
    expect(refundableByStatus(o)).toBe(status === 'paid');
    // The pence gate can never be true on this read: it stays the owner's (money) read only.
    expect(refundable(o)).toBe(false);
  });
});

describe.each([
  ['manager', 'per-row'],
  ['contributor', 'once'],
] as const)('Tickets orders, %s on the real counts read', (role, note) => {
  beforeEach(() => {
    load(realShape(role));
    q.orders = ok(REAL);
    show(<TicketsEntry seriesId="ser-1" />);
    openOrders();
  });
  it('asks the owner to refund every paid order, and nothing else (F1)', () => {
    for (const o of REAL) {
      const r = row(o.id);
      if (o.status === 'expired') {
        expect(r).toBeNull();
        continue;
      }
      expect(within(r as HTMLElement).queryByTestId('tix-refund')).toBeNull();
      const ask = within(r as HTMLElement).queryByTestId('tix-refund-ask-owner');
      expect(ask?.textContent ?? null).toBe(note === 'per-row' && o.status === 'paid' ? NOT_OWNER_REFUND : null);
    }
    const reason = screen.queryAllByTestId('tix-refund-reason');
    expect(reason.map((n) => n.textContent)).toEqual(note === 'once' ? [NOT_MANAGER_REFUND] : []);
  });
  it('the note sits under the tags inside the buyer column, not beside it (F5)', () => {
    if (note !== 'per-row') return;
    for (const o of PAID) {
      const ask = within(row(o.id) as HTMLElement).getByTestId('tix-refund-ask-owner');
      expect(ask.parentElement?.classList.contains('p3-grow')).toBe(true);
      expect(ask.previousElementSibling?.classList.contains('p3-row-tags')).toBe(true);
    }
  });
  it('no amount anywhere, and the read asked for none', () => {
    expect(screen.getByTestId('tix-orders-view').textContent).not.toMatch(POUND);
    expect(q.ordersMoney).toBe(false);
    expect(q.summaryMoney).toBe(false);
  });
  it('a counts-only reader gets "Order" plus the 8-character order code, never a name (F4)', () => {
    const first = REAL[0];
    expect(within(row(first.id) as HTMLElement).getByTestId('tix-order-buyer').textContent).toBe('Order 3F2A9C1E');
    expect(within(row(REAL[2].id) as HTMLElement).getByTestId('tix-order-buyer').textContent).toBe(`Order ${shortRef(REAL[2].id)}`);
  });
});

describe('a paid order with no money left still asks the owner (manager)', () => {
  it('status alone decides: totalPence 0 on the counts read never hides the note', () => {
    const o = { ...PAID[0], totalPence: 0, refundedPence: 0 };
    load(realShape('manager'));
    q.orders = ok([o]);
    show(<TicketsEntry seriesId="ser-1" />);
    openOrders();
    expect(within(row(o.id) as HTMLElement).getByTestId('tix-refund-ask-owner').textContent).toBe(NOT_OWNER_REFUND);
  });
});

describe('one order code (F4)', () => {
  it.each([
    ['3f2a9c1e-0000-4000-8000-000000000001', '3F2A9C1E'],
    ['abc', 'ABC'],
    ['ab-cd-ef-gh-ij', 'ABCDEFGH'],
  ])('shortRef(%j) = %s', (id, code) => {
    expect(shortRef(id)).toBe(code);
  });
  it('the list label, the Refund sheet title and the guest list read the same mapping', () => {
    const o: Order = { ...PAID[0], buyerName: 'Ana Maria', totalPence: 2500 };
    expect(reportShortRef).toBe(shortRef);
    expect(buyerFirstAndCode(o)).toBe(`Ana \u00B7 ${shortRef(o.id)}`);
    expect(refundQuestion(o).title).toBe(`Refund Ana \u00B7 ${shortRef(o.id)}?`);
  });
});

// F3: ticket_sales_summary_v1 still answers pence to a manager until Part B. The client drops them in the parse.
const SUMMARY_RAW = {
  ok: true,
  ticket_types: [
    {
      id: 't-sell', event_series_id: 'ser-1', name: 'Standard', status: 'on_sale', price_pence: 1200, capacity: 40, reserved_count: 14,
      tickets_sold: 14, orders_paid: 7, orders_pending: 1, orders_refunded: 1, orders_disputed: 0,
      gross_pence: 16800, discounts_pence: 300, booking_fees_pence: 700, refunded_pence: 1200,
    },
  ],
};
const pence = (v: unknown): number[] =>
  JSON.stringify(v).match(/"\w*[Pp]ence\w*":-?\d+/g)?.map((m) => Number(m.split(':')[1])) ?? [];

describe('a non-owner summary keeps no pence (F3)', () => {
  it('parseSummary without money: every pence field 0, every count kept', () => {
    const counts = parseSummary(SUMMARY_RAW, { money: false });
    expect(pence(counts).every((n) => n === 0)).toBe(true);
    expect(counts.types[0]).toMatchObject({ ticketsSold: 14, ordersPaid: 7, ordersPending: 1, ordersRefunded: 1, capacity: 40, reserved: 14, status: 'on_sale' });
    const money = parseSummary(SUMMARY_RAW, { money: true });
    expect(money.types[0]).toMatchObject({ grossPence: 16800, discountsPence: 300, bookingFeesPence: 700, refundedPence: 1200, pricePence: 1200 });
    expect(parseSummary(SUMMARY_RAW).types[0].grossPence).toBe(16800);
  });
  it('a refusal parses the same for every role', () => {
    expect(parseSummary({ ok: false, reason: 'not_authorised' }, { money: false })).toEqual({ ok: false, reason: 'not_authorised', types: [], moneyVisible: null });
  });
  it.each([
    [false, 'counts'],
    [true, 'money'],
  ] as const)('useSummary(money %s): what reaches the cache, under its own key', async (money, tail) => {
    const rpc = vi.spyOn(supabase as unknown as { rpc: (...a: unknown[]) => unknown }, 'rpc').mockResolvedValue({ data: SUMMARY_RAW, error: null } as never);
    const real = await vi.importActual<typeof import('../data')>('../data');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => real.useSummary('org-1', money), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpc).toHaveBeenCalledWith('ticket_sales_summary_v1', { p_organiser_id: 'org-1' });
    const cached = client.getQueryCache().getAll();
    expect(cached.map((c) => c.queryKey)).toEqual([['org-tickets', 'summary', 'org-1', tail]]);
    const all = pence(cached.map((c) => c.state.data));
    if (money) expect(all.some((n) => n > 0)).toBe(true);
    else expect(all.every((n) => n === 0)).toBe(true);
  });
});
