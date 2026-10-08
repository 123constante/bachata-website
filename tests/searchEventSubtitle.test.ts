/**
 * Event search rows (owner walk 2026-10-08): a one-date organiser party with a
 * venue and a date read only "london-gb". The /search page rendered city_slug
 * as the whole subtitle (every event, admin-made too); it now uses
 * eventResultSubtitle. (The header overlay is untouched: wiring it pulled two
 * chunks into every page's first load.) Rows below are prod-shaped
 * search_public_v6 / v4 event rows (2026-10-08, read-only); v4-v6 return NO venue.
 */
import { describe, expect, it } from 'vitest';
import { cityFromSlug, eventResultSubtitle } from '@/lib/searchEventSubtitle';

const DOT = ' \u00b7 ';
const ROWS = {
  // admin-made recurring party (v6 row)
  adminRecurring: { id: 'a', name: 'Monthly', poster_url: null, format: 'recurring', category: 'party', is_ended: false, city_slug: 'london-gb', event_type: 'party', start_time: '2026-10-30T20:00:00+00:00' },
  // organiser one-date party: recurring, rule NULL, no series items, sessions per date (v6 row)
  organiserOneDate: { id: 'o', name: 'Party', poster_url: null, format: 'recurring', category: 'party', is_ended: false, city_slug: 'london-gb', event_type: 'party', start_time: '2026-10-15T21:00:00+00:00' },
  // half-hour start
  halfHour: { id: 'h', name: 'Krazy', poster_url: null, format: 'recurring', category: 'party', is_ended: false, city_slug: 'london-gb', event_type: 'party', start_time: '2026-10-08T19:30:00+00:00' },
  // ended series: v6 sends start_time null + is_ended
  ended: { id: 'e', name: 'Old', poster_url: null, format: 'recurring', category: 'party', is_ended: true, city_slug: 'london-gb', event_type: 'party', start_time: null },
  // v4 row: no is_ended key
  v4: { id: 'v', name: 'Monthly', poster_url: null, format: 'recurring', category: 'party', city_slug: 'london-gb', event_type: 'party', start_time: '2026-10-30T20:00:00+00:00' },
  // no city, no date
  bare: { id: 'b', name: 'Bare', poster_url: null, city_slug: null, event_type: 'party', start_time: null },
} as const;

describe('eventResultSubtitle', () => {
  it.each([
    ['adminRecurring', `Fri 30 Oct, 8 PM${DOT}London`],
    ['organiserOneDate', `Thu 15 Oct, 9 PM${DOT}London`],
    ['halfHour', `Thu 8 Oct, 7:30 PM${DOT}London`],
    ['ended', `No longer running${DOT}London`],
    ['v4', `Fri 30 Oct, 8 PM${DOT}London`],
    ['bare', null],
  ] as const)('%s -> %s', (key, text) => {
    expect(eventResultSubtitle(ROWS[key])).toBe(text);
  });

  it('never shows the raw slug', () => {
    for (const row of Object.values(ROWS)) expect(eventResultSubtitle(row) ?? '').not.toMatch(/london-gb/);
  });

  it.each([
    ['london-gb', 'London'], ['san-sebastian-es', 'San Sebastian'], ['london', 'London'], [null, null], ['', null],
  ] as const)('cityFromSlug(%s) = %s', (slug, name) => {
    expect(cityFromSlug(slug)).toBe(name);
  });
});
