import { describe, expect, it } from 'vitest';
import { rowOf, type HomeSeriesRow } from '../../data/home';
import { EDIT_COPY, r4EditOf } from '../r4EditModel';
import { CANCEL_R4_COPY } from '../r4NightModel';

const TODAY = '2026-11-18';
type Shape = { lifecycle: string; format: string; dates: readonly string[]; status?: string; start?: string | null };

/** home_v1 rows in the prod shapes surveyed 2026-11-18 (event_series_p5 lifecycle x format, prices, sales). */
function rowFor(s: Shape) {
  const start = s.start === undefined ? '21:00' : s.start;
  return rowOf({
    id: 's1', name: 'Friday Social', lifecycle_status: s.lifecycle, format: s.format, category: null,
    default_venue_name: 'Soho', default_cover_image_url: null, default_local_start_time: start ? `${start}:00` : null, upcoming_count: s.dates.length,
    next_dates: s.dates.map((d) => ({ occurrence_date: d, lifecycle_status: s.status ?? 'scheduled', status: s.status ?? 'scheduled', starts_at: start ? `${d}T${start}:00Z` : null, materialised_start_utc: start ? `${d}T${start}:00Z` : null, start_time: start, venue_name: null })),
  } as unknown as HomeSeriesRow, TODAY);
}

describe('R4 Edit night: every prod shape gets an honest form', () => {
  it.each([
    // [case, shape, repeatWords, prices, lock, expect date, starts shown, price shown, locked, repeat words, on]
    ['live weekly, no prices (40 of 43 live recurring)', { lifecycle: 'live', format: 'recurring', dates: ['2026-11-20'] }, 'Every Friday.', [], null, 'Friday 20 November 2026', true, null, null, 'Repeats every Friday', true],
    ['live weekly with a team-set price list (3 on prod)', { lifecycle: 'live', format: 'recurring', dates: ['2026-11-20'] }, 'Every Friday.', ['£12'], 'Set up by the team', 'Friday 20 November 2026', true, '£12', 'Set up by the team', 'Repeats every Friday', true],
    ['live festival, two prices, editable', { lifecycle: 'live', format: 'festival', dates: ['2027-02-10'] }, null, ['£40', '£60'], null, 'Wednesday 10 February 2027', true, '£40, £60', null, 'Repeats', false],
    ['live one-off, nothing coming up', { lifecycle: 'live', format: 'one_off', dates: [] }, null, [], null, null, false, null, null, 'Repeats', false],
    ['draft weekly, no time yet', { lifecycle: 'draft', format: 'recurring', dates: ['2026-11-21'], start: null }, 'Every Saturday.', [], null, 'Saturday 21 November 2026', false, null, null, 'Repeats every Saturday', true],
    ['next night cancelled', { lifecycle: 'live', format: 'recurring', dates: ['2026-11-20'], status: 'cancelled' }, 'Every Friday.', [], null, null, false, null, null, 'Repeats every Friday', true],
    ['loose dates (no pattern saved)', { lifecycle: 'live', format: 'recurring', dates: ['2026-11-20'] }, 'No pattern is saved, so each date is set on its own.', [], null, 'Friday 20 November 2026', true, null, null, 'No pattern is saved, so each date is set on its own', true],
    ['ended, nothing coming', { lifecycle: 'ended', format: 'recurring', dates: [] }, 'Every Friday.', [], null, null, false, null, null, 'Repeats every Friday', true],
    ['course, team pattern', { lifecycle: 'live', format: 'course', dates: ['2026-11-24'] }, 'A pattern set by the Bachata Calendar team.', [], null, 'Tuesday 24 November 2026', true, null, null, 'A pattern set by the Bachata Calendar team', true],
  ] as const)('%s', (_c, shape, rw, prices, lock, date, starts, price, locked, words, on) => {
    const m = r4EditOf({ row: rowFor(shape as Shape), repeatWords: rw, wsNext: '2026-11-20', prices, pricesLock: lock });
    expect(m.date).toBe(date);
    expect(m.starts !== null).toBe(starts);
    expect(m.price?.value ?? null).toBe(price);
    expect(m.price?.locked ?? null).toBe(locked);
    expect(m.repeat).toEqual({ words, on });
  });

  it('no home_v1 row (loading or failed): the date comes from the workspace, the time is unknown, never "No time yet"', () => {
    const m = r4EditOf({ row: null, repeatWords: null, wsNext: '2026-11-20', prices: [], pricesLock: null });
    expect([m.date, m.starts, m.startsKnown, m.price]).toEqual(['Friday 20 November 2026', null, false, null]);
    const none = r4EditOf({ row: null, repeatWords: null, wsNext: null, prices: [], pricesLock: null });
    expect(none.date).toBeNull();
    expect(EDIT_COPY.noDate).toBe('No date yet');
  });

  it('a home row wins over the workspace date (the row is the night in focus)', () => {
    const m = r4EditOf({ row: rowFor({ lifecycle: 'live', format: 'recurring', dates: [] }), repeatWords: null, wsNext: '2026-11-20', prices: [], pricesLock: null });
    expect(m.date).toBeNull();
    expect(m.startsKnown).toBe(true);
  });
});

describe('R4 Cancel: the sheet never promises what does not happen', () => {
  it('title is the board’s; no told / refunded line exists', () => {
    expect(CANCEL_R4_COPY.title('Friday Social')).toBe('Cancel Friday Social?');
    expect(CANCEL_R4_COPY.title('  ')).toBe('Cancel No name yet?');
    expect(JSON.stringify(Object.values(CANCEL_R4_COPY).map((v) => (typeof v === 'function' ? v('x') : v)))).not.toMatch(/refund|told/i);
  });
});
