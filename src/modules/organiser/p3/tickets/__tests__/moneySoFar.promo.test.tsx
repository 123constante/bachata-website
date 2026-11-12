// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { parseSummary } from '../../../tickets/ticketsApi';
import { totalsOf } from '../../../tickets/ticketModel';
import { MoneySoFar } from '../GetPaid';

afterEach(cleanup);

const wire = (extra: Record<string, unknown>) =>
  parseSummary({
    ok: true, money_visible: true,
    ticket_types: [{
      id: 't1', name: 'Early', status: 'on_sale', event_series_id: 's1', price_pence: 1000, capacity: 50, reserved_count: 4,
      tickets_sold: 3, orders_paid: 2, orders_pending: 0, orders_refunded: 0, orders_disputed: 0,
      gross_pence: 3000, booking_fees_pence: 0, refunded_pence: 0, ...extra,
    }],
  }).types;

describe('parser: discounts_pence', () => {
  it.each([
    ['present', { discounts_pence: 450 }, 450],
    ['zero', { discounts_pence: 0 }, 0],
    ['missing key', {}, 0],
    ['non-number', { discounts_pence: 'lots' }, 0],
    ['null', { discounts_pence: null }, 0],
  ])('%s -> %s', (_n, extra, want) => {
    const t = wire(extra);
    expect((t[0] as { discountsPence?: number }).discountsPence).toBe(want);
    expect((totalsOf(t) as { discountsPence?: number }).discountsPence).toBe(want);
  });
});

const NOTE = 'Ticket money before Stripe’s fees.';
describe.each([
  ['missing', undefined, 0],
  ['non-number', 'x', 0],
  ['zero', 0, 0],
  ['positive', 450, 450],
] as const)('Money so far: discounts %s', (_n, raw, pence) => {
  describe.each([0, 1050])('refunded %i', (refunded) => {
    describe.each([0, 2])('disputed %i', (disputed) => {
      it('words appear only when discounts > 0; base sentence unchanged', () => {
        const extra: Record<string, unknown> = { refunded_pence: refunded, orders_disputed: disputed };
        if (raw !== undefined) extra.discounts_pence = raw;
        render(<MoneySoFar types={wire(extra)} />);
        const note = screen.getByTestId('tix-money-note').textContent ?? '';
        expect(note.startsWith(NOTE)).toBe(true);
        expect(note.includes('off with promo codes')).toBe(pence > 0);
        if (pence > 0) expect(note).toContain('£4.50 off with promo codes');
        expect(note.includes('refunded')).toBe(refunded > 0);
        expect(note.includes('disputed')).toBe(disputed > 0);
        // Sales tile is still gross (charged before fee), not gross + discounts.
        expect(screen.getByTestId('tix-money-gross').textContent).toBe('Sales£30.00');
        // the note points at no control
        expect(screen.queryAllByRole('button')).toHaveLength(0);
        expect(screen.queryAllByRole('link')).toHaveLength(0);
      });
    });
  });
});
