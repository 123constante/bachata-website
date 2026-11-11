import { describe, expect, it, vi } from 'vitest';
import { endsRefundPress } from '../ticketModel';
import { parseOrderRow, parseSummary, parseTypeRow, refundOrder, upsertPayload } from '../ticketsApi';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));

/** Server rows exactly as ticket_sales_summary_v1 / the RLS reads answer them (keys read from the live bodies). */
describe('ticketing wire', () => {
  it('parses the sales summary, and a refusal', () => {
    const s = parseSummary({
      ok: true,
      ticket_types: [
        {
          id: 't1', name: 'Early', status: 'on_sale', manual_sold_out: false, event_series_id: 's1', occurrence_id: null,
          price_pence: 1000, capacity: 50, reserved_count: 4, tickets_sold: 3, orders_paid: 2, orders_pending: 1,
          orders_refunded: 0, orders_disputed: 0, gross_pence: 3000, booking_fees_pence: 150, refunded_pence: 0,
        },
      ],
    });
    expect(s.ok).toBe(true);
    expect(s.types[0]).toMatchObject({ id: 't1', seriesId: 's1', status: 'on_sale', ticketsSold: 3, grossPence: 3000, bookingFeesPence: 150, reserved: 4 });
    expect(parseSummary({ ok: false, reason: 'not_authorised' })).toEqual({ ok: false, reason: 'not_authorised', types: [], moneyVisible: null });
    expect(parseSummary(null).ok).toBe(false);
  });
  it('an unknown status reads as closed (no write offered)', () => {
    expect(parseTypeRow({ id: 'x', event_series_id: 's', status: 'weird' }).status).toBe('closed');
  });
  it('orders carry no email and no Stripe id', () => {
    const o = parseOrderRow({ id: 'o', ticket_type_id: 't', buyer_name: null, quantity: 2, total_pence: 2100, booking_fee_pence: 100, status: 'paid' });
    expect(o).toMatchObject({ buyerName: null, quantity: 2, totalPence: 2100, refundedPence: 0 });
    expect(Object.keys(o).some((k) => /email|stripe/i.test(k))).toBe(false);
  });
  it('the upsert payload uses ticket_type_upsert_v1 keys, with id only on an edit', () => {
    const base = { organiserId: 'o1', seriesId: 's1', occurrenceId: null, name: 'Door', pricePence: 0, capacity: 10, salesOpenAt: null, salesCloseAt: null };
    expect(upsertPayload({ ...base, id: null })).toEqual({
      organiser_id: 'o1', event_series_id: 's1', occurrence_id: null, name: 'Door', price_pence: 0, capacity: 10, sales_open_at: null, sales_close_at: null,
    });
    expect(upsertPayload({ ...base, id: 't1' }).id).toBe('t1');
  });
});

// ---- ticket-refund body (brief ticket-partial-refund-ui) --------------------------------

describe('refundOrder wire', () => {
  it('no opts -> exactly { order_id } (today\u2019s whole refund, unchanged)', async () => {
    invoke.mockReset().mockResolvedValue({ data: { ok: true, refunded: true }, error: null });
    expect(await refundOrder('o1')).toEqual({ kind: 'ok', value: null });
    expect(invoke).toHaveBeenCalledWith('ticket-refund', { body: { order_id: 'o1' } });
    expect(Object.keys(invoke.mock.calls[0][1].body)).toEqual(['order_id']);
  });
  it('opts -> exactly the three fields, and the partial reply comes back camelCase', async () => {
    invoke.mockReset().mockResolvedValue({ data: { ok: true, refunded: false, partial: true, amount_pence: 300, remaining_pence: 500, clears_balance: false }, error: null });
    const out = await refundOrder('o1', { amountPence: 300, requestId: 'key-12345678' });
    expect(invoke.mock.calls[0][1].body).toEqual({ order_id: 'o1', amount_pence: 300, request_id: 'key-12345678' });
    expect(out).toEqual({ kind: 'ok', value: { amountPence: 300, remainingPence: 500, clearsBalance: false } });
  });
  it('a refusal carries its reason', async () => {
    invoke.mockReset().mockResolvedValue({ data: { ok: false, reason: 'refund_exceeds_balance', message: 'x' }, error: null });
    expect(await refundOrder('o1', { amountPence: 300, requestId: 'key-12345678' })).toEqual({ kind: 'failed', reason: 'refund_exceeds_balance' });
  });
  it('a partial reply missing remaining_pence reads it as unknown (null), never a number it was not told', async () => {
    invoke.mockReset().mockResolvedValue({ data: { ok: true, refunded: false, partial: true, amount_pence: 300 }, error: null });
    expect(await refundOrder('o1', { amountPence: 300, requestId: 'key-12345678' })).toEqual({ kind: 'ok', value: { amountPence: 300, remainingPence: null, clearsBalance: false } });
  });
  it('odd numbers in a partial reply are never shown: the sent amount stands, an odd remainder reads unknown', async () => {
    invoke.mockReset().mockResolvedValue({ data: { ok: true, partial: true, amount_pence: 2.5, remaining_pence: Number.NaN, clears_balance: 'yes' }, error: null });
    expect(await refundOrder('o1', { amountPence: 300, requestId: 'key-12345678' })).toEqual({ kind: 'ok', value: { amountPence: 300, remainingPence: null, clearsBalance: false } });
  });


  // The key is dropped (the press ends) only on a definite answer. A gateway 503 or a platform 404 with no
  // body can come after the function already reached Stripe, so it keeps the key like any unclear error.
  const http = (status: number, body: unknown) => ({ data: null, error: { context: new Response(body === null ? null : JSON.stringify(body), { status }) } });
  it.each([
    ['success', { data: { ok: true, partial: true, amount_pence: 300 }, error: null }, false],
    ['503 no body', http(503, null), true],
    ['503 not_configured body', http(503, { error: 'not_configured' }), false],
    ['404 no body', http(404, null), true],
    ['404 not_configured body', http(404, { error: 'not_configured' }), false],
    ['network error', { data: null, error: new Error('Failed to fetch') }, true],
    ['unknown code', http(500, { error: 'weird_new_code' }), true],
    ['refund_exceeds_balance', { data: { ok: false, reason: 'refund_exceeds_balance' }, error: null }, false],
    ['request_id_reused', http(409, { error: 'request_id_reused' }), false],
  ] as const)('key kept? %s -> %s', async (_n, reply, kept) => {
    invoke.mockReset().mockResolvedValue(reply);
    const out = await refundOrder('o1', { amountPence: 300, requestId: 'key-12345678' });
    expect(!endsRefundPress(out.kind, out.kind === 'failed' ? out.reason : null)).toBe(kept);
  });
});
