import { afterAll, describe, expect, it, vi } from 'vitest';
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';
import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import type { HomeDate, HomeSeriesFull } from '@/modules/organiser/shared/homeModel';
import { homeJobs, seriesChip } from '../homeJobs';

// F4 (owner default, 2026-10-17): a live FESTIVAL whose coming dates are all
// gone gets no `no_dates_left` row. That row opens Add a date, where a
// festival that already holds any date (past included) has every day disabled
// ("A festival has one date"), so the row would be a dead end. Every other
// format keeps the row. The home payload carries no past dates, so the
// past-date column must not change the outcome.
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
afterAll(() => {
  vi.useRealTimers();
});

const today = () => londonTodayKey();

const date = (offset: number): HomeDate => {
  const d = addDaysToKey(today(), offset);
  return { occurrence_id: `o-${d}`, occurrence_date: d, lifecycle_status: 'scheduled', materialised_start_utc: `${d}T20:00:00+00:00`, has_own_changes: false };
};

const series = (format: string, coming: number): HomeSeriesFull => ({
  id: `s-${format}-${coming}`,
  name: 'Event',
  slug: null,
  format,
  category: 'party',
  lifecycle_status: 'live',
  default_local_start_time: '20:00:00',
  default_cover_image_url: 'https://img.example/cover.jpg',
  created_at: `${addDaysToKey(today(), -60)}T09:00:00+00:00`,
  upcoming_count: coming,
  cancelled_upcoming_count: 0,
  next_dates: Array.from({ length: Math.min(coming, 3) }, (_, i) => date(1 + i * 7)),
  latest_decision: null,
});

const page = (s: HomeSeriesFull[]): HomeOrganiser => ({
  id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: 'c1',
  lifecycle_status: 'live', role: 'owner', latest_decision: null, series: s, team: [],
});

describe('homeJobs: a festival with no dates left is not a Home row (F4)', () => {
  it.each([
    // format, coming dates, has past dates, expect a no_dates_left row
    ['festival', 0, true, false],
    ['festival', 0, false, false],
    ['festival', 1, true, false],
    ['festival', 1, false, false],
    ['recurring', 0, true, true],
    ['recurring', 0, false, true],
    ['recurring', 2, true, false],
    ['one_off', 0, true, true],
    ['one_off', 1, false, false],
    ['course', 0, true, true],
    ['course', 3, false, false],
  ] as const)('%s, %i coming, past dates %s -> row %s', (format, coming, _past, row) => {
    const s = series(format, coming);
    const jobs = homeJobs(page([s]), [], today());
    expect(jobs.some((j) => j.kind === 'no_dates_left')).toBe(row);
    expect(seriesChip(s, today()).label === 'Needs dates').toBe(row);
  });

  it('a finished festival still shows Live on My events, not a problem chip', () => {
    expect(seriesChip(series('festival', 0), today())).toEqual({ label: 'Live', tone: 'ok' });
  });
});
