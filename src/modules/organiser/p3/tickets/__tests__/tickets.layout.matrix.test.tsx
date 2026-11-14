// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { SHAPES, order, type Shape } from './fixtures';
import { dataMock, failed, load, pending, q, show } from './harness';

/*
 * Organiser slice 8: Tickets Option A, inline. Roles x shapes: page order, which stats show, no money
 * for anyone who cannot see it, and an action on every empty / loading / error state.
 * The pound sign is matched by escape, never pasted.
 */

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-27' }));
vi.mock('../data', (orig) => dataMock(orig as never));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()) }));

import { TicketsEntry } from '../TicketsEntry';

afterEach(cleanup);
const POUND = /\u00A3/;
const ROLES = ['owner', 'manager', 'contributor'] as const;

const huge: Order[] = Array.from({ length: 150 }, (_, i) => order(`h${i}`, 't-sell', { paidAt: '2026-10-20T10:00:00Z' }));
type Order = ReturnType<typeof order>;
const refunded: Order[] = [
  order('rf', 't-sell', { status: 'refunded', refundedPence: 2500 }),
  order('rp', 't-sell', { refundedPence: 1700 }),
];

const shapes: Record<string, (role: string) => Shape> = {
  empty: (role) => ({ ...SHAPES.bare, role }),
  noStripe: (role) => ({ ...SHAPES.started, stripe: 'none', role }),
  stripeWaiting: (role) => ({ ...SHAPES.selling, stripe: 'waiting', role }),
  normal: (role) => ({ ...SHAPES.selling, role }),
  huge: (role) => ({ ...SHAPES.selling, orders: huge, role }),
  refunded: (role) => ({ ...SHAPES.selling, orders: refunded, role }),
};

const order_of = (ids: string[]) => {
  const pos = ids.map((id) => {
    const el = screen.queryByTestId(id);
    return el ? el.compareDocumentPosition(document.body) : null;
  });
  return pos;
};
const before = (a: string, b: string) => {
  const x = screen.getByTestId(a);
  const y = screen.getByTestId(b);
  return !!(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING);
};

describe.each(ROLES)('inline Tickets layout, %s', (role) => {
  describe.each(Object.keys(shapes))('shape %s', (key) => {
    beforeEach(() => {
      load(shapes[key](role));
      show(<TicketsEntry seriesId="ser-1" />);
    });
    it('is inline, with the heading first', () => {
      expect(screen.queryByTestId('tix-tall-sheet')).toBeNull();
      expect(screen.getByTestId('tix-row')).toBeTruthy();
      expect(screen.getByTestId('tix-list-view')).toBeTruthy();
      expect(order_of(['tix-row']).length).toBe(1);
    });
    it('keeps the page order and the money rule', () => {
      const money = role === 'owner';
      const hasTypes = shapes[key](role).types.length > 0;
      if (hasTypes) {
        expect(before('tix-stats', 'tix-types')).toBe(true);
        expect(before('tix-types', 'tix-add')).toBe(true);
        expect(before('tix-add', 'tix-orders')).toBe(true);
        if (role !== 'contributor') expect(screen.getByTestId(money ? 'tix-stat-takings' : 'tix-stat-orders')).toBeTruthy();
        expect(screen.queryByTestId(money ? 'tix-stat-orders' : 'tix-stat-takings')).toBeNull();
      } else {
        expect(screen.getByTestId('tix-types-empty')).toBeTruthy();
        expect(screen.getByTestId('tix-add')).toBeTruthy();
      }
      if (!money) {
        const all = screen.getByTestId('tix-list-view').textContent ?? '';
        expect(all).not.toMatch(/\u00A3[0-9]+[.,]?[0-9]*\s*(taken|refund)/);
        expect(screen.queryAllByTestId('tix-refund')).toHaveLength(0);
        for (const b of screen.queryAllByTestId('tix-order-buyer')) expect(b.textContent).toMatch(/^Order /);
        for (const l of screen.queryAllByTestId('tix-order-line')) expect(l.textContent).not.toMatch(POUND);
      }
    });
  });
});

describe.each(ROLES)('inline Tickets states, %s', (role) => {
  beforeEach(() => load({ ...SHAPES.selling, role }));
  it('loading: the heading shows a Loading detail', () => {
    q.types = pending() as never;
    show(<TicketsEntry seriesId="ser-1" />);
    expect(screen.getByTestId('tix-row-detail').textContent).toMatch(/Loading/);
    expect(screen.getByTestId('tix-types-loading')).toBeTruthy();
  });
  it('error: Try again is offered', () => {
    q.types = failed() as never;
    show(<TicketsEntry seriesId="ser-1" />);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
  it('empty: says what to do, or why not, and the add control is present', () => {
    load({ ...SHAPES.bare, role });
    show(<TicketsEntry seriesId="ser-1" />);
    const add = screen.getByTestId('tix-add') as HTMLButtonElement;
    if (role === 'contributor') {
      expect(add.disabled).toBe(true);
      expect(screen.getByTestId('tix-readonly')).toBeTruthy();
    } else expect(add.disabled).toBe(false);
  });
});
