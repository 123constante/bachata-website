// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  actionLabel, cardMetaLine, countdownChip, daysBetweenKeys, fallbackInitials, pastCounts, venueLine, yearChips, CHIP_MAX_CHARS,
} from '../nightsCardModel';
import NightsCard from '../NightsCard';
import PastHighlights from '../PastHighlights';

const TODAY = '2026-11-06';
const plus = (days: number) => {
  const d = new Date(Date.UTC(2026, 10, 6 + days));
  return d.toISOString().slice(0, 10);
};

describe('countdownChip', () => {
  const rows: [number, string, boolean][] = [
    [0, 'Tonight', true], [1, 'Tomorrow', true], [2, 'in 2 days', true], [6, 'in 6 days', true],
    [7, 'next week', true], [8, 'next week', false], [15, 'in 2 weeks', false], [97, 'in 14 weeks', false],
    [182, 'in 6 months', false], [270, 'in 9 months', false], [400, 'Dec 2027', false],
  ];
  it.each(rows)('%i days -> %s (soon=%s)', (n, text, soon) => {
    expect(countdownChip(plus(n), TODAY)).toEqual({ text, soon });
  });
  it('never exceeds 11 characters for any day count', () => {
    for (let n = 0; n < 1500; n++) expect(countdownChip(plus(n), TODAY)!.text.length).toBeLessThanOrEqual(CHIP_MAX_CHARS);
  });
  it('no chip for past, missing or malformed dates', () => {
    expect(countdownChip(plus(-1), TODAY)).toBeNull();
    expect(countdownChip(null, TODAY)).toBeNull();
    expect(countdownChip('soon', TODAY)).toBeNull();
  });
  it('diff is DST-safe', () => expect(daysBetweenKeys('2026-03-28', '2026-03-30')).toBe(2));
});

describe('venue / meta / action', () => {
  it.each([
    ['The Forge', 'London', 'The Forge'], ['  ', 'Leeds', 'Leeds'], [null, ' Leeds ', 'Leeds'], [null, null, null], ['', '', null],
  ])('venueLine(%j,%j)', (l, c, want) => expect(venueLine(l, c)).toBe(want));
  it.each([
    ['Forge', '7:30pm', 'Forge \u00b7 7:30pm'], ['Forge', null, 'Forge'], [null, '7:30pm', '7:30pm'], [null, null, null],
  ])('cardMetaLine(%j,%j)', (v, t, want) => expect(cardMetaLine(v, t)).toBe(want));
  it('separator is U+00B7 at runtime', () => expect(cardMetaLine('A', 'B')).toContain('\u00b7'));
  it('model source is pure ASCII (separator written as an escape)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/modules/profile/nightsCardModel.ts'));
    expect([...src].filter((byte) => byte > 0x7f)).toEqual([]);
  });
  it('never prints undefined', () => expect(String(cardMetaLine(venueLine(undefined, undefined), null))).not.toMatch(/undefined/));
  it('action labels', () => {
    expect(actionLabel('single', 1)).toBe('View event');
    expect(actionLabel('series', 13)).toBe('See all 13 dates');
  });
  it('initials fall back', () => {
    expect(fallbackInitials('Salsa Night')).toBe('SN');
    expect(fallbackInitials('', 'Bachata Club')).toBe('BC');
    expect(fallbackInitials(null, null)).toBe('?');
  });
});

describe('pastCounts', () => {
  const mk = (n: number, key = '2026-05-01') => Array.from({ length: n }, () => ({ dateKey: key }));
  it.each([[0, 0, false], [1, 1, false], [5, 5, false], [6, 6, false], [8, 6, true], [33, 6, true]])(
    '%i nights -> strip %i, see-all %s', (n, strip, see) => {
      const c = pastCounts(mk(n), TODAY);
      expect(c).toMatchObject({ total: n, stripCount: strip, showSeeAll: see });
    });
  it('cancelled are excluded', () => {
    expect(pastCounts([...mk(3), { dateKey: '2026-01-01', cancelled: true }], TODAY).total).toBe(3);
  });
  it('year boundary uses the London today key', () => {
    const nights = [{ dateKey: '2025-12-31' }, { dateKey: '2026-01-01' }];
    expect(pastCounts(nights, '2026-01-01').thisYear).toBe(1);
    expect(pastCounts(nights, '2025-12-31').thisYear).toBe(1);
  });
  it('year chips label with counts', () => {
    expect(yearChips([{ year: '2026', count: 12 }])).toEqual([{ year: '2026', label: '2026 (12)' }]);
  });
});

const base = { href: '/event/1', name: 'A', posterUrl: null, weekday: 'Friday', day: '13', month: 'NOV', chipText: 'Tonight', chipSoon: true, metaLine: null, actionLabel: 'View event', initials: 'AB' };
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);
afterEach(cleanup);

describe('NightsCard', () => {
  it('single night is a link with the action row and chip', () => {
    wrap(<NightsCard {...base} name={'x'.repeat(300)} />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/event/1');
    expect(screen.getByTestId('nights-card-action').textContent).toBe('View event');
    expect(screen.getByTestId('nights-card-chip').dataset.soon).toBe('true');
    expect(screen.getByText('AB')).toBeTruthy();
  });
  it('series is a button, no link; no meta line when none', () => {
    wrap(<NightsCard {...base} onClick={() => {}} actionLabel="See all 5 dates" chipText={null} chipSoon={false} />);
    expect(screen.getByRole('button')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByTestId('nights-card-chip')).toBeNull();
  });
});

describe('PastHighlights', () => {
  const night = (i: number) => ({ key: `k${i}`, href: `/event/${i}`, name: `N${i}`, posterUrl: null, caption: '1 Jan' });
  const props = (n: number, extra = {}) => ({
    total: n, thisYear: 1, latest: Array.from({ length: n }, (_, i) => night(i)), showSeeAll: n > 6, listOpen: false,
    onToggleList: () => {}, onYear: () => {}, years: [{ year: '2026', count: n }], organiserName: 'Org', ...extra,
  });
  it('renders nothing with 0 nights', () => {
    wrap(<PastHighlights {...props(0)} />);
    expect(screen.queryByTestId('past-highlights-strip')).toBeNull();
  });
  it.each([[1, 1], [5, 5], [6, 6], [33, 6]])('%i nights shows %i tiles', (n, tiles) => {
    wrap(<PastHighlights {...props(n)} />);
    expect(screen.getAllByRole('link')).toHaveLength(tiles);
    expect(screen.queryByText(`See all ${n} nights`) !== null).toBe(n > 6);
  });
  it('year chip present', () => {
    wrap(<PastHighlights {...props(8)} />);
    expect(screen.getByText('2026 (8)')).toBeTruthy();
  });
  it('5 nights: no year chips, no list toggle', () => {
    wrap(<PastHighlights {...props(5)} />);
    expect(screen.queryByTestId('past-year-shortcuts')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('8 nights: year chips + See all; open list shows Hide', () => {
    wrap(<PastHighlights {...props(8)} />);
    expect(screen.getByTestId('past-year-shortcuts')).toBeTruthy();
    expect(screen.getByText('See all 8 nights')).toBeTruthy();
    cleanup();
    wrap(<PastHighlights {...props(8, { listOpen: true })} />);
    expect(screen.getByText('Hide the full list')).toBeTruthy();
  });
  it.each([1, 5, 6, 8, 33])('%i nights with the list open always has a close button', (n) => {
    wrap(<PastHighlights {...props(n, { listOpen: true })} />);
    expect(screen.getByText('Hide the full list')).toBeTruthy();
  });
});
