import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { quietBarButton, siteBarState } from '../ticketCheckoutApi';
import type { PublicTicketType } from '../ticketCheckoutModel';
import { TicketGlyph } from '../TicketGlyph';
import type { TicketSymbol } from '../ticketSymbol';

const now = new Date('2026-11-08T12:00:00Z');
const base: PublicTicketType = {
  id: 't', seriesId: 's', occurrenceId: null, name: 'Party', pricePence: 1200, remaining: 50, status: 'on_sale',
  salesOpenAt: null, salesCloseAt: null,
} as unknown as PublicTicketType;
const mk = (o: Partial<PublicTicketType>): PublicTicketType => ({ ...base, ...o });
const soldOut = mk({ status: 'sold_out', remaining: 0 });
const buyable = mk({});
const notYet = mk({ salesOpenAt: '2026-12-01T00:00:00Z' });
const closed = mk({ salesCloseAt: '2026-11-01T00:00:00Z' });

describe('sticky bar state x ticket shapes', () => {
  const rows: Array<[string, PublicTicketType[] | undefined, string, string?]> = [
    ['undefined', undefined, 'none'],
    ['no types', [], 'none'],
    ['one buyable', [buyable], 'buy'],
    ['sold out + buyable', [soldOut, buyable], 'buy'],
    ['one sold out', [soldOut], 'quiet', 'Sold out'],
    ['all sold out', [soldOut, soldOut], 'quiet', 'Sold out'],
    ['only not yet', [notYet], 'quiet', 'Not yet'],
    ['only closed', [closed], 'quiet', 'Closed'],
    ['sold out + closed', [soldOut, closed], 'quiet', 'Closed'],
  ];
  it.each(rows)('%s', (_n, types, state, label) => {
    expect(siteBarState(types, now)).toBe(state);
    if (label) expect(quietBarButton(types!, now)).toBe(label);
  });
});

describe('ticket tile glyphs', () => {
  const syms: TicketSymbol[] = ['party', 'class', 'both', 'vip', 'free', 'early', 'generic'];
  it.each(syms)('%s draws shapes', (s) => {
    const html = renderToStaticMarkup(<TicketGlyph symbol={s} />);
    expect(html).toContain(`data-glyph="${s}"`);
    expect(html).toMatch(/<(path|circle|ellipse)/);
  });
});
