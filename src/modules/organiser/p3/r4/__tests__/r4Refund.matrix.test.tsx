// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.fn();
const invoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import { R4NightRefund } from '../R4NightRefund';
import { cancelledNightsOf, refundBlockOf, refundNightsOf } from '../r4RefundModel';
import { parseRefundSummary } from '../../door/refundData';
import type { WorkspaceDate } from '../../../shared/seriesModel';

afterEach(() => { cleanup(); rpc.mockReset(); invoke.mockReset(); });
beforeEach(() => { rpc.mockReset(); invoke.mockReset(); });

const order = (id: string, name: string | null, pence: number, extra: Partial<{ refunded: boolean; mixed_nights: boolean; tickets: number }> = {}) =>
  ({ order_id: id, first_name: name, tickets: extra.tickets ?? 1, remaining_pence: pence, refunded: extra.refunded ?? false, mixed_nights: extra.mixed_nights ?? false });
/** Prod shapes of organiser_night_refund_summary_v1 (migration 20261119160159). */
const plan = (o: ReturnType<typeof order>[], over: Record<string, unknown> = {}) => {
  const open = o.filter((x) => !x.refunded && !x.mixed_nights && x.remaining_pence > 0);
  return { ok: true, night_cancelled: true, orders_to_refund: open.length, pence_to_refund: open.reduce((s, x) => s + x.remaining_pence, 0), free_orders_to_end: 0, orders: o, ...over };
};
const TWO = plan([order('o1', 'Ana', 1200, { tickets: 2 }), order('o2', 'Ben', 600)]);

const mount = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><R4NightRefund seriesId="s1" occurrenceId="n1" date="2026-11-20" /></QueryClientProvider>);
};
const ok = (data: unknown) => Promise.resolve({ data, error: null });
const http = (status: number, body: unknown) => Promise.resolve({ data: null, error: { context: new Response(JSON.stringify(body), { status }) } });

describe('R4 cancel refund: who sees what', () => {
  it('owner / admin on a cancelled night: the line, Refund all and a Refund per order', async () => {
    rpc.mockReturnValue(ok(TWO));
    mount();
    expect((await screen.findByTestId('r4-refund-line')).textContent).toBe('2 orders to refund, \u00a318');
    expect(screen.getByTestId('r4-refund-all')).toBeTruthy();
    expect(screen.getAllByTestId('r4-refund-one')).toHaveLength(2);
    expect(rpc).toHaveBeenCalledWith('organiser_night_refund_summary_v1', { p_event_series_id: 's1', p_occurrence_id: 'n1' });
    // the brief: never say fees are kept apart
    expect(document.body.textContent).not.toMatch(/fee/i);
  });
  it.each([['manager'], ['door staff']])('%s: the server says not_allowed, nothing is drawn', async () => {
    rpc.mockReturnValue(ok({ ok: false, reason: 'not_allowed' }));
    mount();
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('r4-refund')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('night not cancelled (server answers night_cancelled false): nothing', async () => {
    rpc.mockReturnValue(ok({ ok: true, night_cancelled: false, orders_to_refund: 0, pence_to_refund: 0, free_orders_to_end: 0, orders: [] }));
    mount();
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('r4-refund')).toBeNull();
  });
  it('everything refunded: says so, no Refund all, rows say Refunded', async () => {
    rpc.mockReturnValue(ok(plan([order('o1', 'Ana', 0, { refunded: true })])));
    mount();
    expect((await screen.findByTestId('r4-refund-line')).textContent).toBe('Nothing left to refund.');
    expect(screen.queryByTestId('r4-refund-all')).toBeNull();
    expect(screen.getByTestId('r4-refund-done').textContent).toBe('Refunded');
  });
  it('the read fails: says so with Try again (never a blank)', async () => {
    rpc.mockReturnValue(Promise.resolve({ data: null, error: { message: 'x' } }));
    mount();
    // the screen retries once (about a second) before it says so
    expect(await screen.findByTestId('r4-refund-error', undefined, { timeout: 4000 })).toBeTruthy();
  });
});

describe('R4 cancel refund: the model', () => {
  it('free orders are not listed: a free-only (or empty) cancelled night draws no block at all', () => {
    expect(refundBlockOf(parseRefundSummary(plan([], { free_orders_to_end: 3 })))).toBeNull();
  });
  it('an order with no readable amount is never called Refunded: it keeps its Refund, no amount shown', () => {
    const b = refundBlockOf(parseRefundSummary(plan([{ ...order('o1', 'Ana', 0), remaining_pence: null as unknown as number }])));
    expect(b?.rows[0]).toMatchObject({ canRefund: true, amount: '' });
  });
  it('a mixed-night order is listed with its own Refund and a note, never in the total', () => {
    const b = refundBlockOf(parseRefundSummary(plan([order('o1', 'Ana', 1000, { mixed_nights: true }), order('o2', null, 500)])));
    expect(b?.line).toBe('1 order to refund, \u00a35');
    expect(b?.rows[0]).toMatchObject({ canRefund: true, note: expect.stringMatching(/other nights/) });
    expect(b?.rows[1]).toMatchObject({ name: 'No name', canRefund: true, note: null });
  });
  it('slice B fields the screen does not know are ignored (no row for them)', () => {
    const s = parseRefundSummary(plan([order('o1', 'Ana', 100)], { no_stripe_record: 1, orders_without_stripe: ['o1'] }));
    expect(refundBlockOf(s)?.rows).toHaveLength(1);
  });
  it('an unknown answer is a load problem, not a permissions answer', () => {
    expect(() => parseRefundSummary(null)).toThrow();
    expect(() => parseRefundSummary({ ok: true })).toThrow();
  });
  const d = (id: string, date: string, status: string) => ({ id, occurrence_date: date, lifecycle_status: status } as WorkspaceDate);
  it('flag off: no nights, so no block and no refund read', () => {
    expect(refundNightsOf(false, [d('a', '2026-11-20', 'cancelled')], '2026-11-19')).toEqual([]);
    expect(refundNightsOf(true, [d('a', '2026-11-20', 'cancelled')], '2026-11-19')).toEqual([{ occurrenceId: 'a', date: '2026-11-20' }]);
  });
  it.each([
    ['next date cancelled', [d('a', '2026-11-20', 'cancelled'), d('b', '2026-11-27', 'scheduled')], ['a']],
    ['next date on, a later one cancelled', [d('a', '2026-11-20', 'scheduled'), d('b', '2026-11-27', 'cancelled')], ['b']],
    ['cancelled last week, not refunded before it passed', [d('a', '2026-11-12', 'cancelled'), d('b', '2026-11-26', 'scheduled')], ['a']],
    ['cancelled more than 28 days ago', [d('a', '2026-10-01', 'cancelled')], []],
    ['cancelled one-off tonight', [d('a', '2026-11-19', 'cancelled')], ['a']],
    ['five cancelled: the three nearest today', ['2026-10-29', '2026-11-05', '2026-11-12', '2026-11-26', '2026-12-24'].map((x, i) => d(String(i), x, 'cancelled')), ['2', '3', '1']],
    ['no dates', [], []],
  ] as const)('cancelled nights: %s', (_c, dates, want) => {
    expect(cancelledNightsOf(dates as unknown as WorkspaceDate[], '2026-11-19').map((n) => n.occurrenceId)).toEqual(want);
  });
});

describe('R4 cancel refund: the confirm sheet', () => {
  it('Refund all asks first with the amount, then sends the expected totals', async () => {
    rpc.mockReturnValue(ok(TWO));
    invoke.mockReturnValue(ok({ ok: true, refunded_count: 2, failed_count: 0, free_ended: 0, free_failed: false, results: [{ order_id: 'o1', ok: true }, { order_id: 'o2', ok: true }] }));
    mount();
    fireEvent.click(await screen.findByTestId('r4-refund-all'));
    expect(screen.getByRole('dialog').textContent).toContain('Refund 2 orders, \u00a318?');
    expect(invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('r4-refund-go'));
    await waitFor(() => expect(screen.getByTestId('r4-refund-said').textContent).toBe('2 orders refunded.'));
    expect(invoke).toHaveBeenCalledWith('ticket-refund-night', { body: { series: 's1', occurrence: 'n1', expected_pence: 1800, expected_orders: 2 } });
  });
  it('Keep closes the sheet and sends nothing', async () => {
    rpc.mockReturnValue(ok(TWO));
    mount();
    fireEvent.click(await screen.findByTestId('r4-refund-all'));
    fireEvent.click(screen.getByTestId('r4-refund-keep'));
    expect(screen.queryByTestId('r4-refund-sheet')).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });
  it('409 changed: re-reads the summary and asks again with the new amount', async () => {
    rpc.mockReturnValueOnce(ok(TWO)).mockReturnValue(ok(plan([order('o1', 'Ana', 1200, { tickets: 2 }), order('o2', 'Ben', 600), order('o3', 'Cy', 900)])));
    invoke.mockReturnValue(http(409, { ok: false, reason: 'changed', night_cancelled: true, orders_to_refund: 3, pence_to_refund: 2700 }));
    mount();
    fireEvent.click(await screen.findByTestId('r4-refund-all'));
    fireEvent.click(screen.getByTestId('r4-refund-go'));
    await waitFor(() => expect(screen.getByRole('dialog').textContent).toContain('Refund 3 orders, \u00a327?'));
    expect(screen.getByTestId('r4-refund-sheet-error').textContent).toMatch(/amount changed/);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('partial failure: names the orders that failed and keeps Refund all for the retry', async () => {
    rpc.mockReturnValueOnce(ok(TWO)).mockReturnValue(ok(plan([order('o1', 'Ana', 0, { refunded: true, tickets: 2 }), order('o2', 'Ben', 600)])));
    invoke.mockReturnValue(ok({ ok: true, refunded_count: 1, failed_count: 1, free_ended: 0, free_failed: false, results: [{ order_id: 'o1', ok: true }, { order_id: 'o2', ok: false, reason: 'stripe_error' }] }));
    mount();
    fireEvent.click(await screen.findByTestId('r4-refund-all'));
    fireEvent.click(screen.getByTestId('r4-refund-go'));
    await waitFor(() => expect(screen.getByTestId('r4-refund-said').textContent).toMatch(/^1 order refunded\. Not refunded yet: Ben\./));
    await waitFor(() => expect(screen.getByTestId('r4-refund-line').textContent).toBe('1 order to refund, \u00a36'));
    expect(screen.getByTestId('r4-refund-all')).toBeTruthy();
  });
  it('one order: Refund asks with its amount and uses ticket-refund', async () => {
    rpc.mockReturnValue(ok(TWO));
    invoke.mockReturnValue(ok({ ok: true, refunded: true }));
    mount();
    fireEvent.click((await screen.findAllByTestId('r4-refund-one'))[1]);
    expect(screen.getByRole('dialog').textContent).toContain('Refund Ben, \u00a36?');
    fireEvent.click(screen.getByTestId('r4-refund-go'));
    await waitFor(() => expect(screen.getByTestId('r4-refund-said').textContent).toBe('Ben refunded.'));
    expect(invoke).toHaveBeenCalledWith('ticket-refund', { body: { order_id: 'o2' } });
  });
  it('no answer at all (network): never says nothing happened; closes, says it could not confirm, re-reads', async () => {
    rpc.mockReturnValue(ok(TWO));
    invoke.mockReturnValue(Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }));
    mount();
    fireEvent.click(await screen.findByTestId('r4-refund-all'));
    fireEvent.click(screen.getByTestId('r4-refund-go'));
    await waitFor(() => expect(screen.getByTestId('r4-refund-said').textContent).toMatch(/couldn\u2019t confirm/));
    expect(screen.queryByTestId('r4-refund-sheet')).toBeNull();
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
  });
  it('409 changed and the re-read fails: does not re-ask with the old numbers', async () => {
    rpc.mockReturnValueOnce(ok(TWO)).mockReturnValue(Promise.resolve({ data: null, error: { message: 'x' } }));
    invoke.mockReturnValue(http(409, { ok: false, reason: 'changed' }));
    mount();
    fireEvent.click(await screen.findByTestId('r4-refund-all'));
    fireEvent.click(screen.getByTestId('r4-refund-go'));
    await waitFor(() => expect(screen.queryByTestId('r4-refund-sheet')).toBeNull(), { timeout: 4000 });
    expect(screen.getByTestId('r4-refund-said').textContent).toMatch(/amount changed/);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
  it('free tickets not closed: the result says so, not as a plain success', async () => {
    rpc.mockReturnValue(ok(TWO));
    invoke.mockReturnValue(ok({ ok: true, refunded_count: 2, failed_count: 0, free_ended: 0, free_failed: true, results: [{ order_id: 'o1', ok: true }, { order_id: 'o2', ok: true }] }));
    mount();
    fireEvent.click(await screen.findByTestId('r4-refund-all'));
    fireEvent.click(screen.getByTestId('r4-refund-go'));
    await waitFor(() => expect(screen.getByTestId('r4-refund-said').textContent).toMatch(/^2 orders refunded\. Free tickets/));
    expect(screen.getByTestId('r4-refund-said').className).toBe('r4-err');
  });
  it('a failed send keeps the sheet open with the reason, nothing claimed', async () => {
    rpc.mockReturnValue(ok(TWO));
    invoke.mockReturnValue(http(502, { ok: false, reason: 'stripe_error' }));
    mount();
    fireEvent.click(await screen.findByTestId('r4-refund-all'));
    fireEvent.click(screen.getByTestId('r4-refund-go'));
    await waitFor(() => expect(screen.getByTestId('r4-refund-sheet-error').textContent).toMatch(/didn\u2019t go through/));
    expect(screen.queryByTestId('r4-refund-said')).toBeNull();
  });
});
