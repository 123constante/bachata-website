import { describe, expect, it } from 'vitest';
import { totalsOf, type Order, type TicketType, type TypeSales } from '../../../tickets/ticketModel';
import { buildReport } from '../salesReportModel';
import { order, sales, type } from './fixtures';

/*
 * The sales report card (from the loaded orders) against the server's ticket_sales_summary_v1
 * shape (admin 20270314170000_ticket_promo_codes_v1.sql, read 2026-11-06). The server's
 * gross_pence = sum(subtotal - discount) over PAID orders only; refunded_pence sums every
 * status; discounts / booking fees are paid only. The card's gross = sum(totalPence) over paid,
 * refunded and disputed orders (booking fee included). So refunded must agree, and gross differs
 * by exactly the paid booking fees plus the totals of the refunded and disputed orders.
 * serverRow below mirrors those SQL rules for THIS test only; no screen uses it.
 */

const T1 = type('t1', { name: 'General', capacity: 50, reserved: 9 });
const T2 = type('t2', { name: 'Free', pricePence: 0, capacity: 10, reserved: 2 });

/** Promo discounts by order id (Order does not carry discount; totalPence is already net of it). */
const DISCOUNT: Record<string, number> = { 'dddddddd-4': 400 };

const ORDERS: Order[] = [
  // paid, with a booking fee
  order('aaaaaaaa-1', 't1', { quantity: 2, subtotalPence: 2400, bookingFeePence: 100, totalPence: 2500 }),
  // paid, part refunded
  order('bbbbbbbb-2', 't1', { quantity: 1, subtotalPence: 1200, bookingFeePence: 0, totalPence: 1200, refundedPence: 500 }),
  // fully refunded
  order('cccccccc-3', 't1', { quantity: 2, subtotalPence: 2400, bookingFeePence: 0, totalPence: 2400, refundedPence: 2400, status: 'refunded' }),
  // paid, with a promo discount (2400 - 400)
  order('dddddddd-4', 't1', { quantity: 2, subtotalPence: 2400, bookingFeePence: 0, totalPence: 2000 }),
  // disputed
  order('eeeeeeee-5', 't1', { quantity: 1, subtotalPence: 1200, bookingFeePence: 0, totalPence: 1200, status: 'disputed' }),
  // free
  order('ffffffff-6', 't2', { quantity: 2, subtotalPence: 0, bookingFeePence: 0, totalPence: 0 }),
  // pending and expired: never money on either side
  order('11111111-7', 't1', { quantity: 1, subtotalPence: 1200, bookingFeePence: 0, totalPence: 1200, status: 'pending', paidAt: null }),
  order('22222222-8', 't1', { quantity: 1, subtotalPence: 1200, bookingFeePence: 0, totalPence: 1200, status: 'expired', paidAt: null }),
];

const serverRow = (t: TicketType, all: readonly Order[]): TypeSales => {
  const os = all.filter((o) => o.typeId === t.id);
  const paid = os.filter((o) => o.status === 'paid');
  const sum = (xs: readonly Order[], f: (o: Order) => number) => xs.reduce((a, o) => a + f(o), 0);
  const count = (s: string) => os.filter((o) => o.status === s).length;
  return sales(t, {
    ticketsSold: sum(paid, (o) => o.quantity),
    ordersPaid: paid.length,
    ordersPending: count('pending'),
    ordersRefunded: count('refunded'),
    ordersDisputed: count('disputed'),
    grossPence: sum(paid, (o) => o.subtotalPence - (DISCOUNT[o.id] ?? 0)),
    discountsPence: sum(paid, (o) => DISCOUNT[o.id] ?? 0),
    bookingFeesPence: sum(paid, (o) => o.bookingFeePence),
    refundedPence: sum(os, (o) => o.refundedPence),
  });
};

describe('sales report agrees with the server summary (documented difference)', () => {
  const report = buildReport([T1, T2], ORDERS);
  const server = totalsOf([T1, T2].map((t) => serverRow(t, ORDERS)));
  const refundedOrDisputedTotal = ORDERS.filter((o) => o.status === 'refunded' || o.status === 'disputed').reduce((a, o) => a + o.totalPence, 0);

  it('the fixture has every shape the brief names', () => {
    const statuses = new Set(ORDERS.map((o) => o.status));
    for (const s of ['paid', 'refunded', 'disputed', 'pending', 'expired']) expect(statuses.has(s)).toBe(true);
    expect(ORDERS.some((o) => o.status === 'paid' && o.refundedPence > 0 && o.refundedPence < o.totalPence)).toBe(true);
    expect(ORDERS.some((o) => o.totalPence === 0)).toBe(true);
    expect(server.bookingFeesPence).toBeGreaterThan(0);
    expect(server.discountsPence).toBeGreaterThan(0);
  });
  it('refunded agrees with the server', () => {
    expect(report.totals.refundedPence).toBe(server.refundedPence);
  });
  it('gross = server gross + paid booking fees + refunded and disputed order totals', () => {
    expect(report.totals.grossPence).toBe(server.grossPence + server.bookingFeesPence + refundedOrDisputedTotal);
    expect(report.totals.grossPence).not.toBe(server.grossPence);
  });
  it('net = gross - refunded - disputed', () => {
    expect(report.totals.netPence).toBe(report.totals.grossPence - report.totals.refundedPence - report.totals.disputedPence);
  });
});
