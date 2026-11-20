import { describe, expect, it } from 'vitest';
import { nightDoneText, refundBlockOf } from '../r4RefundModel';

const row = (orderId: string, refunded: boolean) => ({ orderId, firstName: 'Ana', tickets: 1, remainingPence: 0, refunded, mixedNights: false });
const summary = (orders: ReturnType<typeof row>[]) =>
  ({ kind: 'ok', nightCancelled: true, ordersToRefund: 0, penceToRefund: 0, freeOrdersToEnd: 0, orders }) as unknown as Parameters<typeof refundBlockOf>[0];

describe('R4 refund follow-up wording', () => {
  it('nothing to refund and every order refunded: Nothing left to refund', () => {
    expect(refundBlockOf(summary([row('o1', true)]))?.line).toBe('Nothing left to refund.');
  });
  it('nothing to refund but some order was never paid money: No paid tickets to refund', () => {
    expect(refundBlockOf(summary([row('o1', true), row('o2', false)]))?.line).toBe('No paid tickets to refund.');
  });
  it('ok with nothing refunded and nothing failed: never says 0 refunded', () => {
    const t = nightDoneText({ refunded: 0, failed: [], freeFailed: false } as never, []);
    expect(t.text).toBe('Done. Refresh to check the list.');
    expect(t.text).not.toMatch(/^0 /);
  });
  it('a normal result still says how many were refunded', () => {
    expect(nightDoneText({ refunded: 2, failed: [], freeFailed: false } as never, []).text).toBe('2 orders refunded.');
  });
});
