// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { COUNTS_ONLY_NOTE, NOT_MANAGER_REFUND, NOT_OWNER_REFUND, buyerFirstAndCode, shortRef } from '../../../tickets/ticketModel';
import { SHAPES, order, type Shape } from './fixtures';
import { dataMock, load, q, show } from './harness';

/*
 * Organiser area v2 slice 2 (contract 6.4, PQ1, Q15): Tickets by role. Owner: amounts, Refund.
 * Manager: counts only, no Refund, "Ask the owner" on a refundable row. Legacy contributor row (A1):
 * no Refund, no amounts. Cells ORG-6.4-r01, r02, r06, r07 at the screen layer.
 * Fix round 1 (review 1520-r1 F1): the harness hands a non-owner the counts-only read (parseOrderRow of
 * a row with no pence column), so these cells run on the payload the screen really gets.
 * The pound sign is matched by escape (£), never pasted.
 */

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-27' }));
vi.mock('../data', (orig) => dataMock(orig as never));
const api = vi.hoisted(() => ({ setTicketStatus: vi.fn(), upsertTicketType: vi.fn(), refundOrder: vi.fn() }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), ...api }));

import { TicketsEntry } from '../TicketsEntry';

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));
afterEach(cleanup);

const POUND = /£/;
// Prod order shapes (2026-11-10): paid, partly refunded, refunded in full.
const ORDERS = [
  order('opaid', 't-sell', { buyerName: 'Ana Maria' }),
  order('opart', 't-sell', { refundedPence: 1700 }),
  order('ofull', 't-sell', { status: 'refunded', refundedPence: 2500 }),
];
const shape = (role: string): Shape => ({ ...SHAPES.selling, orders: ORDERS, role });
const openOrders = () => {
  fireEvent.click(screen.getByTestId('tix-row'));
  const all = screen.queryByTestId('tix-see-all');
  if (all) fireEvent.click(all);
};
const row = (id: string) => screen.getByTestId(`tix-order-${id}`);

describe.each([
  ['owner', true],
  ['manager', false],
  ['contributor', false],
] as const)('Tickets orders, %s', (role, owner) => {
  beforeEach(() => {
    load(shape(role));
    show(<TicketsEntry seriesId="ser-1" />);
    openOrders();
  });
  it(`order lines ${owner ? 'carry' : 'carry no'} amounts (r01, r02)`, () => {
    for (const o of ORDERS) {
      const line = within(row(o.id)).getByTestId('tix-order-line').textContent ?? '';
      if (owner) expect(line).toMatch(POUND);
      else expect(line).not.toMatch(POUND);
    }
    if (owner) expect(screen.queryByTestId('tix-counts-only')).toBeNull();
    else expect(screen.getByTestId('tix-counts-only').textContent).toBe(COUNTS_ONLY_NOTE);
  });
  it('buyer is first name plus short code for the owner; "Order CODE" for counts-only readers (r06)', () => {
    const label = within(row('opaid')).getByTestId('tix-order-buyer').textContent;
    if (owner) expect(label).toBe(buyerFirstAndCode(ORDERS[0]));
    else expect(label).toBe(`Order ${shortRef(ORDERS[0].id)}`);
    expect(row('opaid').textContent).not.toMatch(/Maria/);
  });
  it(`Refund ${owner ? 'shows on refundable rows only' : 'never shows'} (r07)`, () => {
    for (const o of ORDERS) {
      const btn = within(row(o.id)).queryByTestId('tix-refund');
      expect(!!btn).toBe(owner && o.status === 'paid');
      const ask = within(row(o.id)).queryByTestId('tix-refund-ask-owner');
      expect(ask?.textContent ?? null).toBe(role === 'manager' && o.status === 'paid' ? NOT_OWNER_REFUND : null);
    }
    // The legacy row's once-per-list note: a contributor only, and only with a paid order shown.
    expect(screen.queryByTestId('tix-refund-reason')?.textContent ?? null).toBe(role === 'contributor' ? NOT_MANAGER_REFUND : null);
  });
  it(`orders and summary reads ${owner ? 'ask for' : 'never ask for'} money (r02, F3)`, () => {
    expect(q.ordersMoney).toBe(owner);
    expect(q.summaryMoney).toBe(owner);
  });
  it(`sales report ${owner ? 'shows' : 'hides'} money and the download (r01, r02)`, async () => {
    await screen.findByTestId('tix-report');
    const report = screen.getByTestId('tix-report');
    expect(!!within(report).queryByTestId('tix-report-total-money')).toBe(owner);
    expect(!!within(report).queryByTestId('tix-report-download')).toBe(owner);
    if (!owner) expect(report.textContent).not.toMatch(POUND);
  });
  if (!owner) {
    it('no amount anywhere on the orders view (r02)', () => {
      expect(screen.getByTestId('tix-orders-view').textContent).not.toMatch(POUND);
    });
  }
});

describe('stale state (r07)', () => {
  it('the owner’s Refund pressed twice sends one request', async () => {
    api.refundOrder.mockReturnValue(new Promise(() => {}));
    load(shape('owner'));
    show(<TicketsEntry seriesId="ser-1" />);
    openOrders();
    fireEvent.click(within(row('opaid')).getByTestId('tix-refund'));
    const confirm = screen.getByTestId('tix-refund-confirm') as HTMLButtonElement;
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(api.refundOrder).toHaveBeenCalledTimes(1);
  });
});
