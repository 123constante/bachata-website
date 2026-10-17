import { afterAll, describe, expect, it, vi } from 'vitest';
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import type { HomeDate, HomeSeriesFull } from '@/modules/organiser/shared/homeModel';
import type { IncomingAccessRequest } from '@/modules/organiser/shared/teamModel';
import { homeJobs, seriesChip, type Job } from '../homeJobs';

// Plan 4.5 Home matrix (S0b), over the prod shapes of 2.4 + 4.12. The clock is
// frozen (at load: the it.each tables below are built at collection time);
// every date is derived from it, never written down.
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
afterAll(() => {
  vi.useRealTimers();
});

const today = () => londonTodayKey();
const daysAgoIso = (n: number) => `${addDaysToKey(today(), -n)}T09:00:00+00:00`;

const date = (offset: number, status = 'scheduled'): HomeDate => {
  const d = addDaysToKey(today(), offset);
  return { occurrence_id: `o-${d}`, occurrence_date: d, lifecycle_status: status, materialised_start_utc: `${d}T20:00:00+00:00`, has_own_changes: false };
};

let seq = 0;
const series = (over: Partial<HomeSeriesFull> = {}): HomeSeriesFull => {
  seq += 1;
  return {
    id: `s${seq}`,
    name: `Event ${seq}`,
    slug: null,
    format: 'recurring',
    category: 'class',
    lifecycle_status: 'live',
    default_local_start_time: '20:00:00',
    default_cover_image_url: 'https://img.example/cover.jpg',
    created_at: daysAgoIso(60),
    upcoming_count: 2,
    cancelled_upcoming_count: 0,
    next_dates: [date(1), date(8)],
    latest_decision: null,
    ...over,
  };
};

const page = (s: HomeSeriesFull[], over: Partial<HomeOrganiser> = {}): HomeOrganiser => ({
  id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: 'c1',
  lifecycle_status: 'live', role: 'owner', latest_decision: null, series: s, team: [], ...over,
});

const request: IncomingAccessRequest = { requestId: 'r1', userId: 'u2', requesterEmail: 'maya@example.com', message: null, createdAt: daysAgoIso(1) };

const kinds = (jobs: Job[]) => jobs.map((j) => j.kind);

describe('homeJobs: the Home matrix (4.5)', () => {
  it('0 series -> the four first steps, in order, and no change/add/cancel', () => {
    const jobs = homeJobs(page([]), [], today());
    expect(kinds(jobs)).toEqual(['create_first_event', 'add_cover', 'show_whatsapp', 'add_manager']);
    expect(jobs.map((j) => [j.n, j.title, j.to, j.tone])).toEqual([
      [1, 'New event', ORG_PATHS.newWhat, 'gold'],
      [2, 'Add a photo', ORG_PATHS.page, 'plain'],
      [3, 'Show your WhatsApp', ORG_PATHS.page, 'plain'],
      [4, 'Add a manager', ORG_PATHS.teamAdd, 'plain'],
    ]);
  });

  it('first steps drop off once true (photo, WhatsApp, a second team member)', () => {
    const done = page([], { avatar_url: 'https://img.example/a.jpg', team: [{ user_id: 'u1', member_role: 'owner' }, { user_id: 'u2', member_role: 'manager' }] });
    expect(kinds(homeJobs({ ...done, whatsapp_url: 'https://wa.me/1' } as HomeOrganiser, [], today()))).toEqual(['create_first_event']);
  });

  it('1 live series with upcoming dates -> jobs 1-3 and nothing else', () => {
    const jobs = homeJobs(page([series()]), [], today());
    expect(jobs.map((j) => [j.n, j.kind, j.title, j.to, j.tone])).toEqual([
      [1, 'change', 'Change a date', ORG_PATHS.change, 'plain'],
      [2, 'add', 'Add a date', ORG_PATHS.add, 'plain'],
      [3, 'cancel', 'Cancel a date', ORG_PATHS.cancel, 'plain'],
    ]);
  });

  it('live with 0 scheduled upcoming -> no_dates_left, and no cancel job', () => {
    const s = series({ name: 'Fridays', upcoming_count: 0, next_dates: [] });
    const jobs = homeJobs(page([s]), [], today());
    expect(jobs.map((j) => [j.n, j.kind, j.title, j.sub, j.to, j.tone])).toEqual([
      [1, 'change', 'Change a date', undefined, ORG_PATHS.change, 'plain'],
      [2, 'add', 'Add a date', undefined, ORG_PATHS.add, 'plain'],
      [3, 'no_dates_left', 'Fridays', 'Needs dates', ORG_PATHS.addEvent(s.id), 'problem'],
    ]);
  });

  it('all upcoming cancelled -> no_dates_left (R3-3: counts are scheduled-only)', () => {
    const s = series({ name: 'Sundays', upcoming_count: 0, cancelled_upcoming_count: 2, next_dates: [] });
    const jobs = homeJobs(page([s]), [], today());
    expect(kinds(jobs)).toEqual(['change', 'add', 'no_dates_left']);
    expect(jobs[2]).toMatchObject({ n: 3, title: 'Sundays', sub: 'Needs dates', to: ORG_PATHS.addEvent(s.id) });
  });

  it('draft 9 days old -> stale_draft; draft 2 days old -> none', () => {
    const old = series({ name: 'Old draft', lifecycle_status: 'draft', created_at: daysAgoIso(9), upcoming_count: 0, next_dates: [] });
    const fresh = series({ name: 'New draft', lifecycle_status: 'draft', created_at: daysAgoIso(2), upcoming_count: 0, next_dates: [] });
    const jobs = homeJobs(page([series(), old, fresh]), [], today());
    expect(kinds(jobs)).toEqual(['change', 'add', 'cancel', 'stale_draft']);
    expect(jobs[3]).toEqual({ kind: 'stale_draft', n: 4, title: 'Old draft', sub: 'Draft, 9 days', to: ORG_PATHS.event(old.id), tone: 'problem' });
  });

  it('a draft exactly 7 days old is not stale yet (older than 7 days)', () => {
    const s = series({ lifecycle_status: 'draft', created_at: daysAgoIso(7), upcoming_count: 0, next_dates: [] });
    expect(kinds(homeJobs(page([series(), s]), [], today()))).toEqual(['change', 'add', 'cancel']);
  });

  it('live with no cover -> no_cover', () => {
    const s = series({ name: 'Bare', default_cover_image_url: null });
    const jobs = homeJobs(page([s]), [], today());
    expect(jobs[3]).toEqual({ kind: 'no_cover', n: 4, title: 'Bare', sub: 'Needs a cover', to: ORG_PATHS.cover(s.id), tone: 'problem' });
  });

  it('an open join request -> join_request', () => {
    const jobs = homeJobs(page([series()]), [request], today());
    expect(jobs[3]).toEqual({ kind: 'join_request', n: 4, title: 'Wants to join', sub: 'maya@example.com', to: ORG_PATHS.team, tone: 'problem' });
  });

  it('problems come in D37 order after jobs 1-3', () => {
    const jobs = homeJobs(
      page([
        series({ name: 'A', default_cover_image_url: null }),
        series({ name: 'B', lifecycle_status: 'draft', created_at: daysAgoIso(30), upcoming_count: 0, next_dates: [] }),
        series({ name: 'C', upcoming_count: 0, next_dates: [] }),
      ]),
      [request],
      today(),
    );
    expect(jobs.map((j) => `${j.n}:${j.kind}`)).toEqual(['1:change', '2:add', '3:cancel', '4:no_dates_left', '5:join_request', '6:stale_draft', '7:no_cover']);
  });

  it('45 series of which 40 archived -> 5 listed (R3-4), archived never a row', () => {
    const live = Array.from({ length: 5 }, () => series({ default_cover_image_url: null }));
    const archived = Array.from({ length: 40 }, () => series({ lifecycle_status: 'archived', upcoming_count: 0, next_dates: [], default_cover_image_url: null }));
    const jobs = homeJobs(page([...archived, ...live]), [], today());
    expect(jobs.filter((j) => j.kind === 'no_cover').map((j) => j.title)).toEqual(live.map((s) => s.name));
  });

  it('paused and ended series are never listed as problems (D6)', () => {
    const paused = series({ lifecycle_status: 'paused', upcoming_count: 0, next_dates: [], default_cover_image_url: null });
    const ended = series({ lifecycle_status: 'ended', upcoming_count: 0, next_dates: [], default_cover_image_url: null });
    expect(kinds(homeJobs(page([paused, ended]), [], today()))).toEqual(['change', 'add']);
  });

  it('a page holding only archived series gets the first steps', () => {
    const jobs = homeJobs(page([series({ lifecycle_status: 'archived' })]), [], today());
    expect(kinds(jobs)[0]).toBe('create_first_event');
  });
});

describe('seriesChip: the same fact as the Home row (one mapping)', () => {
  const shapes: Array<[string, Partial<HomeSeriesFull>, { label: string; tone: 'ok' | 'bad' | 'n' }]> = [
    ['live with dates', {}, { label: 'Live', tone: 'ok' }],
    ['live, 0 scheduled', { upcoming_count: 0, next_dates: [] }, { label: 'Needs dates', tone: 'bad' }],
    ['live, all cancelled', { upcoming_count: 0, cancelled_upcoming_count: 3, next_dates: [] }, { label: 'Needs dates', tone: 'bad' }],
    ['live, no cover', { default_cover_image_url: null }, { label: 'Needs a cover', tone: 'bad' }],
    ['draft 9 days', { lifecycle_status: 'draft', created_at: daysAgoIso(9) }, { label: 'Draft, 9 days', tone: 'bad' }],
    ['draft 2 days', { lifecycle_status: 'draft', created_at: daysAgoIso(2) }, { label: 'Draft, 2 days', tone: 'n' }],
    ['draft today', { lifecycle_status: 'draft', created_at: daysAgoIso(0) }, { label: 'Draft', tone: 'n' }],
    ['draft 1 day', { lifecycle_status: 'draft', created_at: daysAgoIso(1) }, { label: 'Draft, 1 day', tone: 'n' }],
    ['paused', { lifecycle_status: 'paused' }, { label: 'Paused', tone: 'n' }],
    ['ended', { lifecycle_status: 'ended' }, { label: 'Ended', tone: 'n' }],
  ];

  it.each(shapes)('%s', (_name, over, chip) => {
    expect(seriesChip(series(over), today())).toEqual(chip);
  });

  it.each(shapes)('Home side agrees for %s: a bad chip IS a Home problem row with the chip label, and back', (_name, over) => {
    const s = series(over);
    const chip = seriesChip(s, today());
    const rows = homeJobs(page([s, series()]), [], today()).filter((j) => j.tone === 'problem' && j.title === s.name);
    if (chip.tone === 'bad') {
      expect(rows.map((r) => r.sub)).toEqual([chip.label]);
    } else {
      expect(rows).toEqual([]);
    }
  });

  it('a live series with no dates AND no cover: the chip shows the first Home row', () => {
    const s = series({ upcoming_count: 0, next_dates: [], default_cover_image_url: null });
    const rows = homeJobs(page([s]), [], today()).filter((j) => j.tone === 'problem');
    expect(rows.map((r) => r.sub)).toEqual(['Needs dates', 'Needs a cover']);
    expect(seriesChip(s, today()).label).toBe(rows[0].sub);
  });
});
