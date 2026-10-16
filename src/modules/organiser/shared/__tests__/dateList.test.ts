import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';
import type { HomeDate, HomeSeriesFull } from '../homeModel';
import { comingDates, comingDays, moreDatesCount } from '../dateList';

// Frozen five days before the clocks go back (2026-10-25, R3-18), so every
// fixture straddles that night; dates are derived from the clock.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
});
afterAll(() => vi.useRealTimers());

const today = () => londonTodayKey();
const day = (n: number) => addDaysToKey(today(), n);
const date = (n: number, status = 'scheduled', time = '20:00'): HomeDate => ({
  occurrence_id: `o${n}`, occurrence_date: day(n), lifecycle_status: status,
  materialised_start_utc: `${day(n)}T${time}:00+00:00`, has_own_changes: false,
});
const series = (next_dates: HomeDate[], upcoming_count = next_dates.length): HomeSeriesFull => ({
  id: 's1', name: 'Fridays', slug: null, format: 'recurring', category: 'class', lifecycle_status: 'live',
  default_local_start_time: '20:00:00', default_cover_image_url: null, created_at: `${day(-40)}T09:00:00Z`,
  upcoming_count, cancelled_upcoming_count: 0, next_dates, latest_decision: null,
});

describe('comingDates', () => {
  it('lists scheduled dates from today, in order, with the wall-clock time unshifted across 25 October', () => {
    const rows = comingDates(series([date(10), date(0), date(3)]), today());
    expect(rows.map((r) => [r.occurrenceId, r.date, r.time])).toEqual([
      ['o0', day(0), '20:00'],
      ['o3', day(3), '20:00'],
      ['o10', day(10), '20:00'],
    ]);
    expect(rows[2].label).toBe('Friday 30 October');
    expect(rows[0].label).toBe('Tuesday 20 October');
  });

  it('drops past and cancelled dates and stops at the limit', () => {
    const rows = comingDates(series([date(-1), date(1, 'cancelled'), date(2), date(4), date(6)]), today(), 2);
    expect(rows.map((r) => r.date)).toEqual([day(2), day(4)]);
  });

  it('"N more" is the scheduled count past what the list shows', () => {
    const s = series([date(1), date(8), date(15)], 13);
    expect(moreDatesCount(s, comingDates(s, today()))).toBe(10);
    expect(moreDatesCount(series([date(1)]), comingDates(series([date(1)]), today()))).toBe(0);
  });
});

describe('comingDays', () => {
  it('is the next 30 days minus the days already holding a date of this series', () => {
    const rows = comingDays(series([date(0), date(5), date(12)]), today());
    expect(rows).toHaveLength(27);
    expect(rows.map((r) => r.date)).not.toContain(day(5));
    expect(rows.map((r) => r.date)).not.toContain(day(0));
    expect(rows[0]).toEqual({ date: day(1), label: 'Wednesday 21 October', weekday: 3 });
    expect(rows.map((r) => r.date)).toContain(day(5 + 1));
    expect(rows[rows.length - 1].date).toBe(day(29));
  });

  it('a cancelled date still holds its day (it can be put back, not re-added)', () => {
    const rows = comingDays(series([date(3, 'cancelled')], 0), today(), 7);
    expect(rows.map((r) => r.date)).toEqual([day(0), day(1), day(2), day(4), day(5), day(6)]);
  });

  it('also skips the days the workspace holds past the first three (heldDates)', () => {
    const rows = comingDays(series([date(0), date(7), date(14)], 5), today(), 30, [day(21), day(28)]);
    expect(rows.map((r) => r.date).filter((d) => [day(0), day(7), day(14), day(21), day(28)].includes(d))).toEqual([]);
    expect(rows).toHaveLength(25);
  });

  it('crosses 25 October as a plain calendar day, none skipped or doubled', () => {
    const rows = comingDays(series([]), today(), 10);
    expect(rows.map((r) => r.date)).toEqual(Array.from({ length: 10 }, (_, i) => day(i)));
    expect(rows.map((r) => r.label)).toContain('Sunday 25 October');
  });
});
