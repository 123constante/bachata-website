import { describe, expect, it } from 'vitest';
import { buildReport, csvCell, csvFileName, downloadWhy, guestListCsv, shortRef, CSV_COLUMNS } from '../salesReportModel';
import { order, type } from './fixtures';

const T1 = type('t1', { name: 'General', capacity: 50, reserved: 5 });
const T2 = type('t2', { name: 'Free', pricePence: 0, capacity: 10, reserved: 2 });
const orders = [
  order('aaaaaaaa-1', 't1', { quantity: 3, totalPence: 3600, paidAt: '2026-10-01T10:00:00Z' }),
  order('bbbbbbbb-2', 't1', { quantity: 2, totalPence: 2400, refundedPence: 2400, status: 'refunded' }),
  order('cccccccc-3', 't1', { quantity: 1, totalPence: 1200, refundedPence: 500, status: 'paid' }),
  order('dddddddd-4', 't2', { quantity: 2, totalPence: 0, subtotalPence: 0, bookingFeePence: 0 }),
  order('eeeeeeee-5', 't1', { status: 'pending', paidAt: null }),
  order('ffffffff-6', 't1', { status: 'expired', paidAt: null }),
  order('11111111-7', 't1', { status: 'disputed', quantity: 1, totalPence: 1200 }),
];

describe('sales report model', () => {
  it('totals equal the sum of the rows; pending / expired are left out', () => {
    const r = buildReport([T1, T2], orders);
    expect(r.countedOrders).toBe(5);
    expect(r.notPaidOrders).toBe(2);
    expect(r.totals.grossPence).toBe(r.rows.reduce((a, x) => a + x.grossPence, 0));
    expect(r.totals.refundedPence).toBe(2900);
    expect(r.totals.netPence).toBe(r.totals.grossPence - r.totals.refundedPence);
    expect(r.rows[0]).toMatchObject({ sold: 5, refundedTickets: 2, remaining: 45, grossPence: 8400 });
    expect(r.rows[1]).toMatchObject({ sold: 2, grossPence: 0, remaining: 8 });
  });
  it('CSV row count equals paid + refunded + disputed orders; no email column', () => {
    const { csv, rows } = guestListCsv([T1, T2], orders);
    expect(rows).toBe(5);
    expect(csv.trim().split('\r\n')).toHaveLength(6);
    expect(CSV_COLUMNS.join(' ').toLowerCase()).not.toMatch(/mail|stripe/);
    expect(csv).not.toMatch(/@/);
  });
  it('escapes injection and quoting', () => {
    for (const c of ['=1+1', '+1', '-1', '@x', '\tx']) expect(csvCell(c).replace(/^"/, '')).toMatch(/^'/);
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    const { csv } = guestListCsv([T1], [order('x1', 't1', { buyerName: '=HYPERLINK("x")' })]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
  it('shape: no orders, free ticket, file name, short ref', () => {
    const empty = buildReport([T1], []);
    expect(downloadWhy(empty)).toMatch(/No paid orders/);
    expect(guestListCsv([T1], []).rows).toBe(0);
    expect(downloadWhy(buildReport([T2], [orders[3]]))).toBeNull();
    expect(csvFileName('Sunday Social!', '2026-10-27')).toBe('guests-sunday-social-2026-10-27.csv');
    expect(shortRef('aaaaaaaa-1')).toBe('AAAAAAAA');
  });
  it('100+ orders: every one counted', () => {
    const many = Array.from({ length: 230 }, (_, i) => order(`o${i}`, 't1', { quantity: 1, totalPence: 100 }));
    const r = buildReport([T1], many);
    expect(r.totals.sold).toBe(230);
    expect(guestListCsv([T1], many).rows).toBe(230);
  });
});
