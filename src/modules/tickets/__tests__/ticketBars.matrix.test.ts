import { describe, expect, it } from 'vitest';
import { quietBar, barSummary } from '../ticketBars';
import type { PublicTicketType } from '../ticketCheckoutModel';

const NOW = new Date('2026-11-10T12:00:00Z');
const mk = (p: Partial<PublicTicketType> = {}): PublicTicketType => ({
  id: 't', name: 'Entry', pricePence: 1000, remaining: 10, status: 'active', salesOpenAt: null, salesCloseAt: null, occurrenceId: null, ...p,
} as PublicTicketType);

const cases: Array<[string, PublicTicketType[], string | null]> = [
  ['buyable -> amber, no quiet bar', [mk()], null],
  ['sold out one + buyable other -> amber', [mk({ remaining: 0 }), mk({ id: 'b' })], null],
  ['none (paused/hidden) -> unavailable', [], 'Unavailable'],
  ['all sold out', [mk({ remaining: 0 }), mk({ id: 'b', status: 'sold_out' })], 'Sold out'],
  ['not open yet', [mk({ salesOpenAt: '2026-11-12T12:00:00Z' })], 'Not yet'],
  ['closed', [mk({ salesCloseAt: '2026-11-09T12:00:00Z' })], 'Closed'],
];

describe('quiet bar x shape', () => {
  it.each(cases)('%s', (_n, list, button) => {
    expect(quietBar(list, NOW)?.button ?? null).toBe(button);
  });
  it('door ticked + all sold out -> sold out online, pay at the door', () => {
    const list = [mk({ remaining: 0 }), mk({ id: 'b', status: 'sold_out' })];
    expect(quietBar(list, NOW, { door: true })).toEqual({ title: 'Sold out online', sub: 'Pay at the door.', button: 'Sold out online' });
  });
  it('all sold out, door off or absent -> plain Sold out', () => {
    const list = [mk({ remaining: 0 })];
    expect(quietBar(list, NOW, { door: false })?.button).toBe('Sold out');
    expect(quietBar(list, NOW)?.button).toBe('Sold out');
  });
  it('door ticked leaves every other shape unchanged', () => {
    expect(quietBar([mk()], NOW, { door: true })).toBeNull();
    expect(quietBar([mk({ remaining: 0 }), mk({ id: 'b' })], NOW, { door: true })).toBeNull();
    expect(quietBar([], NOW, { door: true })?.button).toBe('Unavailable');
    expect(quietBar([mk({ salesOpenAt: '2026-11-12T12:00:00Z' })], NOW, { door: true })?.button).toBe('Not yet');
    expect(quietBar([mk({ salesCloseAt: '2026-11-09T12:00:00Z' })], NOW, { door: true })?.button).toBe('Closed');
  });
  it('summary', () => {
    expect(barSummary(2, 'Early bird', false)).toBe('2 × Early bird');
    expect(barSummary(1, 'Free entry', true)).toBe('1 ticket');
  });
});
