// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { formatPence, orderTagFor, partRefundedNote } from '../../../tickets/ticketModel';
import { SHAPES, order, type, type Shape } from './fixtures';
import { countsOnlyOrder, dataMock, load, ok, q, show } from './harness';

/*
 * #1452: Manager x tickets screen x order shape. One money formatter (no ".00", no raw minor units),
 * one Going wording (goingCopy), a visible note on a part-refunded order, empty states that say what to do.
 * Prod shapes (survey 2026-10-27): free paid order qty > 1, one refunded; part refunds not reached yet.
 */

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-27' }));
vi.mock('../data', (orig) => dataMock(orig as never));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), setTicketStatus: vi.fn(), upsertTicketType: vi.fn(), refundOrder: vi.fn() }));

import { TicketsEntry } from '../TicketsEntry';

afterEach(cleanup);

const T = 't-sell';
const selling = type(T, { status: 'on_sale', pricePence: 1200 });
const SHAPE_ORDERS = {
  paid: [order('o1', T, { totalPence: 2500, subtotalPence: 2400, bookingFeePence: 100 })],
  partRefunded: [order('o2', T, { totalPence: 2500, refundedPence: 1050 })],
  free: [order('o3', T, { totalPence: 0, subtotalPence: 0, bookingFeePence: 0, quantity: 3 })],
  huge: [order('o4', T, { quantity: 12000, totalPence: 30_000_000, subtotalPence: 29_000_000 })],
  empty: [],
} as const;
type ShapeName = keyof typeof SHAPE_ORDERS;
const ROLES = ['owner', 'manager'] as const;

const open = (role: (typeof ROLES)[number], shape: ShapeName) => {
  const rows = [...SHAPE_ORDERS[shape]];
  load({ ...SHAPES.selling, types: [selling], sales: SHAPES.selling.sales.slice(0, 1), orders: rows, role } as Shape);
  q.orders = ok(role === 'owner' ? rows : rows.map(countsOnlyOrder));
  show(<TicketsEntry seriesId="ser-1" />);
  fireEvent.click(screen.getByTestId('tix-row'));
  return screen.getByTestId('tix-tall').textContent ?? '';
};

describe.each(ROLES)('%s', (role) => {
  it.each(Object.keys(SHAPE_ORDERS) as ShapeName[])('order shape %s: no pence figure, no raw minor units', (shape) => {
    const text = open(role, shape);
    expect(text).not.toMatch(/\.00\b/);
    expect(text).not.toMatch(/\bpence\b/i);
    // A manager's orders card is counts only (the type row's own price is the ticket's price, not takings).
    if (role === 'manager') expect(screen.getByTestId('tix-orders').textContent).not.toMatch(/\u00A3/);
    if (shape !== 'empty') expect(screen.getAllByTestId('tix-order-tag').length).toBeGreaterThan(0);
  });

  it('empty orders: says what the person can do', () => {
    open(role, 'empty');
    const t = screen.getByTestId('tix-orders-empty').textContent ?? '';
    expect(t).toMatch(/No orders yet\./);
    expect(t.length).toBeGreaterThan('No orders yet.'.length + 10);
  });
});

describe('part-refunded order', () => {
  it('owner: tag and note say so, from one shared mapping', () => {
    open('owner', 'partRefunded');
    const o = SHAPE_ORDERS.partRefunded[0];
    expect(screen.getByTestId('tix-order-tag').textContent).toBe('Part refunded');
    expect(screen.getByTestId('tix-order-tag').textContent).toBe(orderTagFor(o).label);
    expect(screen.getByTestId('tix-order-part-refunded').textContent).toBe(partRefundedNote(o));
    expect(partRefundedNote(o)).toBe(`${formatPence(1050)} of ${formatPence(2500)} has been refunded. The tickets still work.`);
  });
  it.each(['paid', 'free', 'huge'] as const)('%s order: no part-refunded note', (shape) => {
    open('owner', shape);
    expect(screen.queryByTestId('tix-order-part-refunded')).toBeNull();
    expect(screen.getByTestId('tix-order-tag').textContent).toBe('Paid');
  });
  it('a fully refunded or free-zero order is never "Part refunded"', () => {
    expect(orderTagFor({ status: 'refunded', totalPence: 2500, refundedPence: 2500 }).label).toBe('Refunded');
    expect(orderTagFor({ status: 'paid', totalPence: 0, refundedPence: 0 }).label).toBe('Paid');
    expect(partRefundedNote({ status: 'paid', totalPence: 2500, refundedPence: 2500 })).toBeNull();
  });
});

describe('formatPence: one formatter, whole pounds as whole pounds', () => {
  it.each([
    [0, '£0'],
    [1200, '£12'],
    [1050, '£10.50'],
    [30_000_000, '£300,000'],
  ])('%i -> %s', (p, s) => expect(formatPence(p)).toBe(s));
});

describe('literal money in the orders card (not just "no .00")', () => {
  it.each([
    ['paid', '2 \u00D7 \u00A312.50'],
    ['huge', '12000 \u00D7 \u00A325'],
  ] as const)('owner, %s order: the card shows %s', (shape, money) => {
    open('owner', shape);
    expect(screen.getByTestId('tix-orders').textContent).toContain(money);
  });
  it('owner, part-refunded order: the note carries the literal figures', () => {
    open('owner', 'partRefunded');
    expect(screen.getByTestId('tix-order-part-refunded').textContent).toBe('\u00A310.50 of \u00A325 has been refunded. The tickets still work.');
  });
});

describe('Going wording comes from goingCopy', () => {
  it.each(ROLES)('%s: free event line is the shared organiser total, never "people"', (role) => {
    load({ ...SHAPES.bare, role } as Shape);
    q.going = [{ is_cancelled: false, going_count: 4 }, { is_cancelled: false, going_count: 3 }];
    show(<TicketsEntry seriesId="ser-1" />);
    fireEvent.click(screen.getByTestId('tix-row'));
    const t = screen.getByTestId('tix-going-count').textContent ?? '';
    expect(t).toBe('7 going across 2 nights. Free event: no money is taken here.');
    expect(t).not.toMatch(/people|Going:/);
  });
});
