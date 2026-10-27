import { describe, expect, it } from 'vitest';
import { parseOrderRow, parseSummary, parseTypeRow, upsertPayload } from '../ticketsApi';

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
    expect(parseSummary({ ok: false, reason: 'not_authorised' })).toEqual({ ok: false, reason: 'not_authorised', types: [] });
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
