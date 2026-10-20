import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';
import type { OrganiserHome } from '@/modules/organiser/shared/selfServeApi';
import type { HomeSeriesFull } from '@/modules/organiser/shared/homeModel';
import type { SeriesWorkspace, WorkspaceDate } from '@/modules/organiser/shared/seriesModel';
import { dateLock } from '@/modules/organiser/shared/eventState';
import { changeableSeries, changeDates, dateGate } from '../changeModel';

// Prod shapes, 2026-10-16 (counts only): 67 live series; 16 with no coming
// date, 16 with 1-3, 35 with more than 3 (home_v1 lists only 3), 30 with
// more than 14; 2 live series hold a cancelled coming date.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

const today = () => londonTodayKey();
const day = (n: number) => addDaysToKey(today(), n);

const wsDate = (id: string, n: number, status = 'scheduled'): WorkspaceDate => ({
  id, occurrence_date: day(n), lifecycle_status: status, version: 1, has_override: false,
  session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: `${day(n)}T20:00:00Z`,
});
const series = (id: string, over: Partial<HomeSeriesFull> = {}): HomeSeriesFull => ({
  id, name: id, slug: null, format: 'recurring', category: null, lifecycle_status: 'live', default_local_start_time: '20:00',
  default_cover_image_url: null, created_at: '2026-01-01T00:00:00Z', upcoming_count: 1, cancelled_upcoming_count: 0,
  next_dates: [{ occurrence_id: `${id}-1`, occurrence_date: day(2), lifecycle_status: 'scheduled', materialised_start_utc: `${day(2)}T20:00:00Z`, has_own_changes: false }],
  latest_decision: null, ...over,
});
const ws = (dates: WorkspaceDate[], status = 'live'): SeriesWorkspace =>
  ({ series: { id: 's', lifecycle_status: status, default_venue_id: null }, hasSessions: true, dates } as unknown as SeriesWorkspace);
const home = (...pages: HomeSeriesFull[][]): OrganiserHome =>
  ({ today: today(), organisers: pages.map((s, i) => ({ id: `o${i}`, series: s })) } as unknown as OrganiserHome);

describe('changeableSeries (C2)', () => {
  it.each([
    ['live with a coming date', () => series('a'), true],
    ['live, no coming date (16 in prod)', () => series('b', { upcoming_count: 0, next_dates: [] }), false],
    ['draft', () => series('c', { lifecycle_status: 'draft' }), false],
    ['paused', () => series('d', { lifecycle_status: 'paused' }), false],
    ['ended', () => series('e', { lifecycle_status: 'ended' }), false],
    ['archived', () => series('f', { lifecycle_status: 'archived' }), false],
  ] as const)('%s', (_name, make, listed) => {
    const s = make();
    expect(changeableSeries(home([s])).map((x) => x.id)).toEqual(listed ? [s.id] : []);
  });

  it('a series shared by two pages of the login is listed once', () => {
    expect(changeableSeries(home([series('a')], [series('a')])).map((s) => s.id)).toEqual(['a']);
  });
});

describe('changeDates (C3) over the full workspace list', () => {
  it('shows dates past the 3 home_v1 lists, soonest first, at most 14; never past or cancelled', () => {
    const dates = [wsDate('past', -7), wsDate('c', 1, 'cancelled'), ...Array.from({ length: 20 }, (_, i) => wsDate(`d${i}`, 20 - i))];
    const rows = changeDates(series('a'), ws(dates), today());
    expect(rows).toHaveLength(14);
    expect(rows.map((r) => r.date)).toEqual(Array.from({ length: 14 }, (_, i) => day(i + 1)));
    expect(rows.map((r) => r.occurrenceId)).not.toContain('past');
    expect(rows.map((r) => r.occurrenceId)).not.toContain('c');
    expect(rows[0].time).toBe('20:00');
  });

  it('falls back to home_v1 next_dates while the workspace loads', () => {
    expect(changeDates(series('a'), undefined, today()).map((r) => r.occurrenceId)).toEqual(['a-1']);
  });
});

describe('dateGate (C4/C5)', () => {
  it('a past date is refused with the dateLock text verbatim', () => {
    expect(dateGate(ws([wsDate('p', -1)]), 'p', today())).toEqual({ kind: 'refused', text: dateLock('live', day(-1), today()) });
  });
  it('a date of an ended event is refused with its dateLock text', () => {
    expect(dateGate(ws([wsDate('f', 3)], 'ended'), 'f', today())).toEqual({ kind: 'refused', text: dateLock('ended', day(3), today()) });
  });
  it('a cancelled date is not changed here', () => {
    expect(dateGate(ws([wsDate('c', 3, 'cancelled')]), 'c', today()).kind).toBe('refused');
  });
  it('a date that is not this series is missing', () => {
    expect(dateGate(ws([wsDate('a', 3)]), 'other', today())).toEqual({ kind: 'missing' });
  });
  it('a coming scheduled date is open', () => {
    expect(dateGate(ws([wsDate('a', 3)]), 'a', today()).kind).toBe('ok');
  });
});
