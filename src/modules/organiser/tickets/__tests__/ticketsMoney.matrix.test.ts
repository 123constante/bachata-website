import { describe, expect, it, vi } from 'vitest';
import {
  NOT_OWNER_REFUND,
  PAYOUTS_ASK_OWNER,
  buyerFirstAndCode,
  canRefund,
  orderCountLine,
  orderLineFor,
  reasonMessage,
  refundQuestion,
  seesMoney,
  type Order,
} from '../ticketModel';

/*
 * Organiser area v2 slice 2 (contract 6.4): money for the owner, counts for everyone else.
 * Cells ORG-6.4-r01/r02/r06/r07 at the model layer. The pound sign is matched by escape (£).
 */

const POUND = /£/;
const order = (over: Partial<Order> = {}): Order => ({
  id: '3f2a9c10-0000-4000-8000-000000000001',
  typeId: 't1',
  buyerName: 'Ana Maria Lopez',
  quantity: 2,
  subtotalPence: 2000,
  bookingFeePence: 0,
  totalPence: 2000,
  refundedPence: 0,
  status: 'paid',
  paidAt: '2026-11-09T20:00:00Z',
  ...over,
});
// The prod order shapes (2026-11-10 read: 2 paid, 1 of them partly refunded, 1 refunded in full).
const SHAPES: Record<string, Order> = {
  paid: order(),
  partial: order({ refundedPence: 700 }),
  full: order({ status: 'refunded', refundedPence: 2000 }),
  free: order({ subtotalPence: 0, totalPence: 0 }),
};
const ROLES = [
  ['owner', true],
  ['manager', false],
  ['contributor', false], // legacy row only (A1, OPEN:8)
  [null, false],
] as const;

describe.each(ROLES)('role %s', (role, owner) => {
  it(`refund ${owner ? 'is' : 'is not'} theirs, money ${owner ? 'is' : 'is not'} shown (r02, r07)`, () => {
    expect(canRefund(role)).toBe(owner);
    expect(seesMoney(role)).toBe(owner);
  });
  it.each(Object.entries(SHAPES))('order line, %s: amounts for the owner only (r01, r02)', (_k, o) => {
    const line = orderLineFor(role, o, '2026-11-09');
    if (owner) expect(line).toMatch(o.totalPence === 0 ? /Free/ : POUND);
    else {
      expect(line).not.toMatch(POUND);
      expect(line).not.toMatch(/Free/);
      expect(line).toBe(orderCountLine(o, '2026-11-09'));
    }
  });
});

describe('buyer label (r06, Q14): first name plus short code, one mapping', () => {
  it.each([
    ['Ana Maria Lopez', 'Ana'],
    ['  Jo  ', 'Jo'],
    [null, 'Buyer'],
    ['', 'Buyer'],
  ])('%j shows as first name %s and the code', (name, first) => {
    const label = buyerFirstAndCode(order({ buyerName: name }));
    expect(label).toBe(`${first} · 3F2A`);
    expect(label).not.toMatch(/@/);
    expect(label).not.toMatch(/Lopez|Maria/);
  });
  it('the Refund sheet reads the same mapping', () => {
    expect(refundQuestion(SHAPES.paid).title).toBe(`Refund ${buyerFirstAndCode(SHAPES.paid)}?`);
  });
});

describe('counts line', () => {
  it('one ticket, many tickets, and the day', () => {
    expect(orderCountLine(order({ quantity: 1 }), '2026-11-09')).toBe('1 ticket · today');
    expect(orderCountLine(order({ quantity: 3, paidAt: null }), '2026-11-09')).toBe('3 tickets');
  });
});

describe('refusal copy (r03, r07)', () => {
  it('a not_allowed refund reply says to ask the owner, with no amount', () => {
    expect(reasonMessage('not_allowed')).toBe(NOT_OWNER_REFUND);
    expect(NOT_OWNER_REFUND).not.toMatch(POUND);
    expect(PAYOUTS_ASK_OWNER).toBe('Ask the owner to set up payouts.');
  });
});

describe('orders read for anyone but the owner asks for no money column (r02 payload)', () => {
  it('fetchOrders(money: false) selects no *_pence column', async () => {
    const select = vi.fn();
    const chain: Record<string, unknown> = {};
    const rows = [{ id: 'o1', ticket_type_id: 't1', buyer_name: 'Ana', quantity: 1, status: 'paid', paid_at: null }];
    Object.assign(chain, {
      select: (s: string) => (select(s), chain),
      in: () => chain,
      order: () => chain,
      range: async () => ({ data: rows, error: null }),
    });
    vi.resetModules();
    vi.doMock('@/integrations/supabase/client', () => ({ supabase: { from: () => chain } }));
    const api = await import('../ticketsApi');
    expect(api.ORDER_SELECT_COUNTS).not.toMatch(/pence/);
    expect(api.ORDER_SELECT_MONEY).toMatch(/total_pence/);
    const out = await api.fetchOrders(['t1'], { money: false });
    expect(select).toHaveBeenCalledWith(api.ORDER_SELECT_COUNTS);
    expect(out[0].totalPence).toBe(0);
    vi.doUnmock('@/integrations/supabase/client');
  });
});
