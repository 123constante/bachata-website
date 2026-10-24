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

/** D83: the short chip each Home problem row stands for (the long Home words live in PROBLEM_COPY). */
const CHIP_OF: Record<string, string> = { no_dates_left: 'Needs dates', no_cover: 'Needs a flyer', go_live: 'Not live yet' };

const kinds = (jobs: Job[]) => jobs.map((j) => j.kind);

describe('homeJobs: the Home matrix (4.5)', () => {
  it('0 series -> the two first steps, in order, and no change/add/cancel; no profile checklist job (C15)', () => {
    const jobs = homeJobs(page([]), [], today());
    expect(kinds(jobs)).toEqual(['create_first_event', 'add_manager']);
    expect(jobs.map((j) => [j.n, j.title, j.to, j.tone])).toEqual([
      [1, 'Create your first event', ORG_PATHS.newWhat, 'gold'],
      [2, 'Add a manager', ORG_PATHS.teamAdd, 'plain'],
    ]);
  });

  it('first steps drop off once true (a second team member); no WhatsApp step (C69)', () => {
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

  it('live with 0 scheduled upcoming -> add + no_dates_left, and no change/cancel job (nothing to change)', () => {
    const s = series({ name: 'Fridays', upcoming_count: 0, next_dates: [] });
    const jobs = homeJobs(page([s]), [], today());
    expect(jobs.map((j) => [j.n, j.kind, j.title, j.sub, j.to, j.tone])).toEqual([
      [1, 'add', 'Add a date', undefined, ORG_PATHS.add, 'plain'],
      [2, 'no_dates_left', 'Add dates: Fridays', 'No coming dates, so dancers see nothing', ORG_PATHS.addEvent(s.id), 'problem'],
    ]);
  });

  it('all upcoming cancelled -> no_dates_left (R3-3: counts are scheduled-only)', () => {
    const s = series({ name: 'Sundays', upcoming_count: 0, cancelled_upcoming_count: 2, next_dates: [] });
    const jobs = homeJobs(page([s]), [], today());
    expect(kinds(jobs)).toEqual(['add', 'no_dates_left']);
    expect(jobs[1]).toMatchObject({ n: 2, title: 'Add dates: Sundays', sub: 'No coming dates, so dancers see nothing', to: ORG_PATHS.addEvent(s.id) });
  });

  // W2 walk fix 4: every draft gets ONE go_live row (stale or not); only a stale one is a problem until its check loads.
  it('draft 9 days old -> go_live problem; draft 2 days old -> plain go_live', () => {
    const old = series({ name: 'Old draft', lifecycle_status: 'draft', created_at: daysAgoIso(9), upcoming_count: 0, next_dates: [] });
    const fresh = series({ name: 'New draft', lifecycle_status: 'draft', created_at: daysAgoIso(2), upcoming_count: 0, next_dates: [] });
    const jobs = homeJobs(page([series(), old, fresh]), [], today());
    expect(kinds(jobs)).toEqual(['change', 'add', 'cancel', 'go_live', 'go_live']);
    expect(jobs[3]).toEqual({ kind: 'go_live', n: 4, title: 'Finish and go live: Old draft', sub: 'Not live yet, started 9 days ago', to: ORG_PATHS.event(old.id), tone: 'problem' });
    expect(jobs[4]).toEqual({ kind: 'go_live', n: 5, title: 'Finish and go live: New draft', sub: 'Not live yet', to: ORG_PATHS.event(fresh.id), tone: 'plain' });
  });

  it('a draft exactly 7 days old is not stale yet (older than 7 days)', () => {
    const s = series({ lifecycle_status: 'draft', created_at: daysAgoIso(7), upcoming_count: 0, next_dates: [] });
    const jobs = homeJobs(page([series(), s]), [], today());
    expect(kinds(jobs)).toEqual(['change', 'add', 'cancel', 'go_live']);
    expect(jobs[3]).toMatchObject({ sub: 'Not live yet', tone: 'plain' });
  });

  it('live with no cover -> no_cover', () => {
    const s = series({ name: 'Bare', default_cover_image_url: null });
    const jobs = homeJobs(page([s]), [], today());
    expect(jobs[3]).toEqual({ kind: 'no_cover', n: 4, title: 'Add a flyer: Bare', sub: 'Events with a flyer get more clicks', to: ORG_PATHS.cover(s.id), tone: 'problem' });
  });

  it('an open join request -> join_request', () => {
    const jobs = homeJobs(page([series()]), [request], today());
    expect(jobs[3]).toEqual({ kind: 'join_request', n: 4, title: 'Answer a request to join', sub: 'maya@example.com', to: ORG_PATHS.team, tone: 'problem' });
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
    expect(jobs.map((j) => `${j.n}:${j.kind}`)).toEqual(['1:change', '2:add', '3:cancel', '4:no_dates_left', '5:join_request', '6:go_live', '7:no_cover']);
  });

  it('45 series of which 40 archived -> 5 listed (R3-4), archived never a row', () => {
    const live = Array.from({ length: 5 }, () => series({ default_cover_image_url: null }));
    const archived = Array.from({ length: 40 }, () => series({ lifecycle_status: 'archived', upcoming_count: 0, next_dates: [], default_cover_image_url: null }));
    const jobs = homeJobs(page([...archived, ...live]), [], today());
    expect(jobs.filter((j) => j.kind === 'no_cover').map((j) => j.title)).toEqual(live.map((s) => `Add a flyer: ${s.name}`));
  });

  it('paused and ended series are never listed as problems (D6)', () => {
    const paused = series({ lifecycle_status: 'paused', upcoming_count: 0, next_dates: [], default_cover_image_url: null });
    const ended = series({ lifecycle_status: 'ended', upcoming_count: 0, next_dates: [], default_cover_image_url: null });
    expect(kinds(homeJobs(page([paused, ended]), [], today())).filter((k) => k === 'no_dates_left' || k === 'no_cover')).toEqual([]);
  });

  // F-S0b (REVIEW-S0b SHOULD-1/2): `change` only when a live series has a
  // scheduled coming date (as `cancel`), `add` only when a live or draft
  // series exists, else the first steps. Prod: 2 pages are paused/ended
  // only, 1 page has drafts and no live series.
  const chipAgreesWithHome = (jobs: Job[], all: HomeSeriesFull[]) => {
    for (const s of all) {
      const chip = seriesChip(s, today());
      const rows = jobs.filter((j) => j.tone === 'problem' && j.title.endsWith(`: ${s.name}`));
      expect(rows.map((r) => CHIP_OF[r.kind])).toEqual(chip.tone === 'bad' ? [chip.label] : []);
    }
  };

  it('drafts only (one 9 days, one 2 days) -> add + a go_live row each; no change/cancel, no first steps', () => {
    const old = series({ name: 'Old draft', lifecycle_status: 'draft', created_at: daysAgoIso(9), upcoming_count: 0, next_dates: [] });
    const fresh = series({ name: 'New draft', lifecycle_status: 'draft', created_at: daysAgoIso(2), upcoming_count: 0, next_dates: [] });
    const jobs = homeJobs(page([old, fresh]), [], today());
    expect(jobs.map((j) => [j.n, j.kind, j.title, j.sub, j.to, j.tone])).toEqual([
      [1, 'add', 'Add a date', undefined, ORG_PATHS.add, 'plain'],
      [2, 'go_live', 'Finish and go live: Old draft', 'Not live yet, started 9 days ago', ORG_PATHS.event(old.id), 'problem'],
      [3, 'go_live', 'Finish and go live: New draft', 'Not live yet', ORG_PATHS.event(fresh.id), 'plain'],
    ]);
    expect(seriesChip(old, today())).toEqual({ label: 'Not live yet', tone: 'bad' });
    expect(seriesChip(fresh, today())).toEqual({ label: 'Draft, 2 days', tone: 'n' });
    chipAgreesWithHome(jobs, [old, fresh]);
  });

  it('paused + ended only -> the two first steps, no change/add/cancel', () => {
    const paused = series({ name: 'Paused one', lifecycle_status: 'paused', next_dates: [date(2), date(9)] });
    const ended = series({ name: 'Ended one', lifecycle_status: 'ended', upcoming_count: 0, next_dates: [], default_cover_image_url: null });
    const jobs = homeJobs(page([paused, ended]), [], today());
    expect(jobs.map((j) => [j.n, j.kind, j.title, j.to, j.tone])).toEqual([
      [1, 'create_first_event', 'Create your first event', ORG_PATHS.newWhat, 'gold'],
      [2, 'add_manager', 'Add a manager', ORG_PATHS.teamAdd, 'plain'],
    ]);
    expect(seriesChip(paused, today())).toEqual({ label: 'Paused', tone: 'n' });
    expect(seriesChip(ended, today())).toEqual({ label: 'Ended', tone: 'n' });
    chipAgreesWithHome(jobs, [paused, ended]);
  });

  it('paused + one live series with a scheduled date -> change, add, cancel as before', () => {
    const paused = series({ name: 'Paused one', lifecycle_status: 'paused', upcoming_count: 0, next_dates: [] });
    const live = series({ name: 'Live one', upcoming_count: 1, next_dates: [date(6)] });
    const jobs = homeJobs(page([paused, live]), [], today());
    expect(jobs.map((j) => [j.n, j.kind, j.title, j.to, j.tone])).toEqual([
      [1, 'change', 'Change a date', ORG_PATHS.change, 'plain'],
      [2, 'add', 'Add a date', ORG_PATHS.add, 'plain'],
      [3, 'cancel', 'Cancel a date', ORG_PATHS.cancel, 'plain'],
    ]);
    expect(seriesChip(paused, today())).toEqual({ label: 'Paused', tone: 'n' });
    expect(seriesChip(live, today())).toEqual({ label: 'Live', tone: 'ok' });
    chipAgreesWithHome(jobs, [paused, live]);
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
    // Decision 3 (INT-B N-9): every coming date cancelled outranks every Home problem on the chip.
    ['live, all cancelled', { upcoming_count: 0, cancelled_upcoming_count: 3, next_dates: [] }, { label: 'Cancelled', tone: 'bad' }],
    ['live, no cover', { default_cover_image_url: null }, { label: 'Needs a flyer', tone: 'bad' }],
    ['draft 9 days', { lifecycle_status: 'draft', created_at: daysAgoIso(9) }, { label: 'Not live yet', tone: 'bad' }],
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
    const rows = homeJobs(page([s, series()]), [], today()).filter((j) => j.tone === 'problem' && j.title.endsWith(`: ${s.name}`));
    if (chip.label === 'Cancelled') {
      // A cancelled-only series: the chip states the cancellation (decision 3); Home keeps its job row.
      expect(rows.map((r) => CHIP_OF[r.kind])).toEqual(['Needs dates']);
    } else if (chip.tone === 'bad') {
      expect(rows.map((r) => CHIP_OF[r.kind])).toEqual([chip.label]);
    } else {
      expect(rows).toEqual([]);
    }
  });

  it('a live series with no dates AND no cover: the chip shows the first Home row', () => {
    const s = series({ upcoming_count: 0, next_dates: [], default_cover_image_url: null });
    const rows = homeJobs(page([s]), [], today()).filter((j) => j.tone === 'problem');
    expect(rows.map((r) => CHIP_OF[r.kind])).toEqual(['Needs dates', 'Needs a flyer']);
    expect(seriesChip(s, today()).label).toBe(CHIP_OF[rows[0].kind]);
  });
});
