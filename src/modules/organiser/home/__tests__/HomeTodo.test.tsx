// @vitest-environment jsdom
/**
 * D83: Home reads as a to-do list. Every job title is an action that names its event, the
 * sub-line says why in plain words, the profile card is "Finish your profile" while answers
 * are left, and an empty list says what the person can do. Which jobs exist stays homeJobs.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';

const rpc = vi.hoisted(() => vi.fn());
const force = vi.hoisted(() => ({ empty: false }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, session: null }) }));
vi.mock('@/modules/organiser/jobs/homeJobs', async (orig) => {
  const real = await orig<typeof import('@/modules/organiser/jobs/homeJobs')>();
  return { ...real, homeJobs: (...a: Parameters<typeof real.homeJobs>) => (force.empty ? [] : real.homeJobs(...a)) };
});

import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import type { HomeDate, HomeSeriesFull } from '@/modules/organiser/shared/homeModel';
import { homeJobs, type JobKind } from '@/modules/organiser/jobs/homeJobs';
import type { IncomingAccessRequest } from '@/modules/organiser/shared/teamModel';
import { markFinishLater } from '@/modules/organiser/wizard/nudgeStore';
import HomePage from '../index';
import { TODO_EMPTY, TODO_HEADING } from '../homeView';

vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
afterAll(() => { vi.useRealTimers(); });

const today = () => londonTodayKey();
const daysAgoIso = (n: number) => `${addDaysToKey(today(), -n)}T09:00:00+00:00`;
const date = (offset: number): HomeDate => {
  const d = addDaysToKey(today(), offset);
  return { occurrence_id: `o-${d}`, occurrence_date: d, lifecycle_status: 'scheduled', materialised_start_utc: `${d}T20:00:00+00:00`, has_own_changes: false };
};
const series = (name: string, over: Partial<HomeSeriesFull> = {}): HomeSeriesFull => ({
  id: `id-${name}`, name, slug: null, format: 'recurring', category: 'class', lifecycle_status: 'live',
  default_local_start_time: '20:00:00', default_cover_image_url: 'https://img.example/c.jpg', created_at: daysAgoIso(60),
  upcoming_count: 2, cancelled_upcoming_count: 0, next_dates: [date(1), date(8)], latest_decision: null, ...over,
});
const page = (s: HomeSeriesFull[]): HomeOrganiser => ({
  id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner',
  latest_decision: null, series: s, team: [], ...{},
});
const request: IncomingAccessRequest = { requestId: 'r1', userId: 'u2', requesterEmail: 'maya@example.com', message: null, createdAt: daysAgoIso(1) };

// Every JobKind -> a shape that produces it; its title has an action verb and, where there is one, the event name.
const VERB = /^(Finish and go live|Add dates|Add a flyer|Add a date|Change a date|Cancel a date|Create your first event|Add a manager|Answer a request to join)/;
const CASES: { kind: JobKind; build: () => HomeOrganiser; requests?: IncomingAccessRequest[]; event?: string }[] = [
  { kind: 'change', build: () => page([series('Salsa Fri')]) },
  { kind: 'add', build: () => page([series('Salsa Fri')]) },
  { kind: 'cancel', build: () => page([series('Salsa Fri')]) },
  { kind: 'no_dates_left', build: () => page([series('Salsa Fri', { upcoming_count: 0, next_dates: [] })]), event: 'Salsa Fri' },
  { kind: 'stale_draft', build: () => page([series('Old Draft', { lifecycle_status: 'draft', created_at: daysAgoIso(9) })]), event: 'Old Draft' },
  { kind: 'no_cover', build: () => page([series('Bare One', { default_cover_image_url: null })]), event: 'Bare One' },
  { kind: 'join_request', build: () => page([series('Salsa Fri')]), requests: [request] },
  { kind: 'create_first_event', build: () => page([]) },
  { kind: 'add_manager', build: () => page([]) },
];

describe('D83: every job title is an action (and names its event)', () => {
  it.each(CASES)('$kind', ({ kind, build, requests = [], event }) => {
    const job = homeJobs(build(), requests, today()).find((j) => j.kind === kind);
    expect(job, `no ${kind} job`).toBeDefined();
    expect(job!.title).toMatch(VERB);
    if (event) expect(job!.title).toContain(event);
  });

  it('covers every JobKind', () => {
    const all: JobKind[] = ['change', 'add', 'cancel', 'no_dates_left', 'join_request', 'stale_draft', 'no_cover', 'create_first_event', 'add_manager'];
    expect(CASES.map((c) => c.kind).sort()).toEqual([...all].sort());
  });

  it.each([[8, 'Not live yet, started 8 days ago'], [9, 'Not live yet, started 9 days ago'], [287, 'Not live yet, started 287 days ago']])('stale draft of %i days: sub "%s"', (age, sub) => {
    const jobs = homeJobs(page([series('D', { lifecycle_status: 'draft', created_at: daysAgoIso(age) })]), [], today());
    expect(jobs.find((j) => j.kind === 'stale_draft')!.sub).toBe(sub);
  });

  it('the stale-draft age counts London days, not 24 h blocks', () => {
    // 23:30 UTC the evening before is already "yesterday + 1" in London (BST) when created at 00:30 London.
    const createdAt = `${addDaysToKey(today(), -9)}T23:30:00+00:00`; // 00:30 London on day -8
    const sub = homeJobs(page([series('D', { lifecycle_status: 'draft', created_at: createdAt })]), [], today()).find((j) => j.kind === 'stale_draft')!.sub;
    expect(sub).toBe('Not live yet, started 8 days ago');
  });

  it('the other two sub-lines say why', () => {
    const jobs = homeJobs(page([series('A', { upcoming_count: 0, next_dates: [] }), series('B', { default_cover_image_url: null })]), [], today());
    expect(jobs.find((j) => j.kind === 'no_dates_left')!.sub).toBe('No coming dates, so dancers see nothing');
    expect(jobs.find((j) => j.kind === 'no_cover')!.sub).toBe('Events with a flyer get more clicks');
  });
});

let organiser: HomeOrganiser;
let progress: Record<string, unknown> | null;
beforeEach(() => {
  force.empty = false;
  progress = null;
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_home_v1') return { data: { today: today(), organisers: [organiser] }, error: null };
    if (fn === 'list_organiser_access_requests_v1') return { data: [], error: null };
    if (fn === 'my_profile_progress_v1' && progress) return { data: progress, error: null };
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
  try { window.localStorage.clear(); } catch { /* none */ }
  markFinishLater('u1', Date.now());
});
afterEach(cleanup);

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[ORG_PATHS.home]}>
        <Routes><Route path={ORG_PATHS.home} element={<HomePage />} /><Route path="*" element={<p />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('D83: Home screen', () => {
  it('shows "Your to-do list" above the numbered jobs', async () => {
    organiser = page([series('Salsa Fri')]);
    mount();
    await waitFor(() => expect(screen.getAllByTestId('home-job').length).toBeGreaterThan(0));
    expect(screen.getByTestId('home-todo-heading').textContent).toBe(TODO_HEADING);
    expect(TODO_HEADING).toBe('Your to-do list');
  });

  it('an empty list says Nothing to do and names the New event button', async () => {
    organiser = page([series('Salsa Fri')]);
    force.empty = true;
    mount();
    const empty = await screen.findByTestId('home-todo-empty');
    expect(empty.textContent).toBe(TODO_EMPTY);
    expect(TODO_EMPTY).toMatch(/^Nothing to do right now\./);
    expect(screen.getByTestId('home-new-event').textContent).toContain('New event');
    expect(TODO_EMPTY).toContain('New event');
    expect(screen.queryByTestId('home-jobs')).toBeNull();
  });

  it.each([
    [2, 'Finish your profile', '2 answers left. Needed before your events can go live.'],
    [1, 'Finish your profile', '1 answer left. Needed before your events can go live.'],
    [3, 'Finish your profile', '3 answers left. Needed before your events can go live.'],
  ])('profile card with %i answers left', async (left, title, sub) => {
    organiser = page([series('Salsa Fri')]);
    progress = { percent: 60, required_left: left, publish_ready: false, steps: [], declined: [] };
    mount();
    const level = await screen.findByTestId('home-profile-level');
    expect(level.textContent).toBe(sub);
    expect(screen.getByTestId('home-profile-button').textContent).toContain(title);
    expect(screen.getByTestId('home-profile').textContent).not.toContain('Ready to publish');
  });

  it('0 answers left: the "Finish your profile" to-do is gone', async () => {
    organiser = page([series('Salsa Fri')]);
    progress = { percent: 64, required_left: 0, publish_ready: true, steps: [], declined: [] };
    mount();
    await waitFor(() => expect(screen.getAllByTestId('home-job').length).toBeGreaterThan(0));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('my_profile_progress_v1', expect.anything()));
    expect(screen.queryByText('Finish your profile')).toBeNull();
  });
});
