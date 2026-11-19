import { describe, expect, it } from 'vitest';
import { basketSummaryLines, basketTotals, buildPickerBody, cleanBasket, isFreeOnly } from '../pickerModel';
import { MAX_PER_ORDER, formatPence, type PublicTicketType } from '../ticketCheckoutModel';

const mk = (id: string, pricePence: number): PublicTicketType => ({ id, occurrenceId: null, name: id, pricePence, status: 'on_sale', remaining: 100, salesOpenAt: null, salesCloseAt: null });
const NOW = new Date('2026-11-19T12:00:00Z');
const PAID = mk('class', 1000), FREE = mk('party', 0);

describe('free row: shapes x model', () => {
  it('label: a free type prices as Free, never 0', () => {
    expect(formatPence(FREE.pricePence)).toBe('Free');
  });
  it('free only: no payment, no fee, total 0', () => {
    expect(isFreeOnly({ party: 3 }, [FREE])).toBe(true);
    expect(basketTotals({ party: 3 }, [FREE])).toMatchObject({ count: 3, feePence: 0, totalPence: 0 });
  });
  it('mixed: not free-only, free line adds nothing to the paid total', () => {
    const t = [PAID, FREE];
    expect(isFreeOnly({ class: 1, party: 2 }, t)).toBe(false);
    expect(basketTotals({ class: 1, party: 2 }, t).count).toBe(3);
    expect(basketTotals({ class: 1, party: 2 }, t).totalPence).toBe(1000 + basketTotals({ class: 1, party: 2 }, [PAID, FREE]).feePence);
  });
  it('empty basket is not free-only', () => {
    expect(isFreeOnly({}, [PAID, FREE])).toBe(false);
  });
  it('cap: free + paid share the one order cap', () => {
    const c = cleanBasket({ class: 15, party: 15 }, [PAID, FREE], NOW);
    expect(basketTotals(c, [PAID, FREE]).count).toBeLessThanOrEqual(MAX_PER_ORDER);
  });
  it('summary lists free and paid lines in row order', () => {
    expect(basketSummaryLines({ class: 2, party: 1 }, [PAID, FREE])).toEqual([
      { id: 'class', name: 'class', quantity: 2, free: false, priceLabel: '£20' },
      { id: 'party', name: 'party', quantity: 1, free: true, priceLabel: 'Free' },
    ]);
    expect(basketSummaryLines({}, [PAID, FREE])).toEqual([]);
  });
  it('checkout body carries the free line at unit price 0 beside the paid line', () => {
    const b = buildPickerBody({ basket: { class: 1, party: 2 }, types: [PAID, FREE], email: 'a@b.co', occurrenceId: null, origin: 'https://x.test', pathname: '/e', search: '' });
    expect(b.lines).toEqual([
      { ticket_type_id: 'class', quantity: 1, expected_unit_price_pence: 1000 },
      { ticket_type_id: 'party', quantity: 2, expected_unit_price_pence: 0 },
    ]);
  });
});
