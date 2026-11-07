import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
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
    expect(r.totals.netPence).toBe(r.totals.grossPence - r.totals.refundedPence - r.totals.disputedPence);
    expect(r.rows[0]).toMatchObject({ sold: 4, disputedTickets: 1, disputedPence: 1200, refundedTickets: 2, remaining: 45, grossPence: 8400 });
    expect(r.rows[1]).toMatchObject({ sold: 2, grossPence: 0, remaining: 8 });
  });
  it('CSV row count equals paid + refunded + disputed orders; no email column', () => {
    const { csv, rows } = guestListCsv([T1, T2], orders);
    expect(rows).toBe(5);
    expect(csv.trim().split('\r\n')).toHaveLength(6);
    expect(CSV_COLUMNS.join(' ').toLowerCase()).not.toMatch(/mail|stripe/);
    expect(csv).not.toMatch(/@/);
  });
});

describe('csvCell: one test per escaping rule', () => {
  it.each([
    ['=', '=1+1', "'=1+1"],
    ['+', '+1', "'+1"],
    ['-', '-1', "'-1"],
    ['@', '@x', "'@x"],
    ['tab', '\tx', "'\tx"],
    ['CR', '\rx', "'\rx"],
  ])('formula neutraliser: a cell starting with %s gets a leading apostrophe', (_label, v, want) => {
    // the outer quotes belong to the quoting rules (a CR cell is also quoted); strip them here
    expect(csvCell(v).replace(/^"([\s\S]*)"$/, '$1')).toBe(want);
  });
  it('a plain cell is left alone', () => {
    expect(csvCell('Ana 1')).toBe('Ana 1');
  });
  it('quote doubling: a double quote is doubled and the cell quoted', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });
  it('comma quoting: a comma wraps the cell in quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
  });
  it('CR / LF quoting: a line break mid-cell wraps it in quotes', () => {
    expect(csvCell('a\nb')).toBe('"a\nb"');
    expect(csvCell('a\rb')).toBe('"a\rb"');
  });
  it('buyer-name formula through guestListCsv is neutralised and quoted', () => {
    const { csv } = guestListCsv([T1], [order('x1', 't1', { buyerName: '=HYPERLINK("x")' })]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('sales report shapes', () => {
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

describe('lost dispute: the organiser keeps nothing', () => {
  it.each([
    ['lost 12 pound order, nothing refunded', { status: 'disputed', quantity: 1, totalPence: 1200, refundedPence: 0 }, { sold: 0, disputedTickets: 1, disputedPence: 1200, grossPence: 1200, netPence: 0 }],
    ['disputed after a part refund: only the unrefunded part is lost', { status: 'disputed', quantity: 1, totalPence: 1200, refundedPence: 500 }, { sold: 0, disputedTickets: 1, disputedPence: 700, grossPence: 1200, netPence: 0 }],
    ['paid order is unaffected', { status: 'paid', quantity: 1, totalPence: 1200, refundedPence: 0 }, { sold: 1, disputedTickets: 0, disputedPence: 0, grossPence: 1200, netPence: 1200 }],
  ])('%s', (_l, over, want) => {
    const r = buildReport([T1], [order('d1', 't1', over as never)]);
    expect(r.rows[0]).toMatchObject(want);
    expect(r.totals.netPence).toBe(want.netPence);
    expect(r.totals.disputedPence).toBe(want.disputedPence);
  });
});

describe('csvCell: leading line breaks, zeros and unicode', () => {
  it.each([
    ['LF', '\nx', "\"'\nx\""],
    ['CR', '\rx', "\"'\rx\""],
    ['CRLF', '\r\nx', "\"'\r\nx\""],
  ])('a cell starting with %s is apostrophe-led and quoted', (_l, v, want) => {
    expect(csvCell(v)).toBe(want);
  });
  it.each(['007', '0044 7700 900123', '00123456'])('leading zeros survive untouched: %s', (v) => {
    expect(csvCell(v)).toBe(v);
  });
  it.each(['Zo\u00eb Mu\u00f1oz', '\u674e\u96f7', 'Ana \u{1F483}', 'Caf\u00e9, bar'])('unicode is kept: %s', (v) => {
    expect(csvCell(v).replace(/^"([\s\S]*)"$/, '$1')).toBe(v);
  });
  it('through guestListCsv: leading-zero ref buyer and unicode name', () => {
    const { csv } = guestListCsv([T1], [order('x1', 't1', { buyerName: '007' }), order('x2', 't1', { buyerName: 'Zo\u00eb \u674e' })]);
    expect(csv).toContain(',007,');
    expect(csv).toContain('Zo\u00eb \u674e');
  });
});

describe('no raw U+FEFF in the sales report sources', () => {
  const here = __dirname;
  const dir = join(here, '..');
  const files = [...readdirSync(dir), ...readdirSync(here).map((f) => `__tests__/${f}`)].filter((f) => /^(?:__tests__\/)?salesReport|^SalesReport/.test(f) && /\.tsx?$/.test(f));
  it('finds the files to scan', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });
  it.each(files)('%s has no raw BOM', (f) => {
    expect(readFileSync(join(dir, f), 'utf8').includes('\uFEFF')).toBe(false);
  });
});
