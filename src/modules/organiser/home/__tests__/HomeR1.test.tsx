// @vitest-environment jsdom
/**
 * S1 Home (rule 2, boards C1 + C1b, D36-D38): table-driven over the S0b home
 * shapes. Every row is a homeJobs() Job -- its text is Job.title and a tap goes
 * to Job.to -- so Home never computes a fact itself. rpc + router spies; the
 * clock is frozen and every date is derived from it.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, session: null }) }));

import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import type { HomeDate, HomeSeriesFull } from '@/modules/organiser/shared/homeModel';
import { homeJobs } from '@/modules/organiser/jobs/homeJobs';
import { parseIncomingRequests } from '@/modules/organiser/shared/teamModel';
import HomePage from '../index';

vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
afterAll(() => {
  vi.useRealTimers();
});

const today = () => londonTodayKey();
const daysAgoIso = (n: number) => `${addDaysToKey(today(), -n)}T09:00:00+00:00`;
const date = (offset: number): HomeDate => {
  const d = addDaysToKey(today(), offset);
  return { occurrence_id: `o-${d}`, occurrence_date: d, lifecycle_status: 'scheduled', materialised_start_utc: `${d}T20:00:00+00:00`, has_own_changes: false };
};
let seq = 0;
const series = (over: Partial<HomeSeriesFull> = {}): HomeSeriesFull => {
  seq += 1;
  return {
    id: `s${seq}`, name: `Event ${seq}`, slug: null, format: 'recurring', category: 'class', lifecycle_status: 'live',
    default_local_start_time: '20:00:00', default_cover_image_url: 'https://img.example/cover.jpg', created_at: daysAgoIso(60),
    upcoming_count: 2, cancelled_upcoming_count: 0, next_dates: [date(1), date(8)], latest_decision: null, ...over,
  };
};
const page = (s: HomeSeriesFull[], over: Partial<HomeOrganiser> = {}): HomeOrganiser => ({
  id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner',
  latest_decision: null, series: s, team: [], ...over,
});
const requestRow = { request_id: 'r1', user_id: 'u2', requester_email: 'maya@example.com', message: null, created_at: daysAgoIso(1) };

let organisers: HomeOrganiser[];
let incoming: unknown[];
beforeEach(() => {
  seq = 0;
  incoming = [];
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown> = {}) => {
    if (fn === 'organiser_home_v1') return { data: { today: today(), organisers }, error: null };
    if (fn === 'list_organiser_access_requests_v1') return { data: args.p_scope === 'incoming' ? incoming : [], error: null };
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
  try { window.localStorage.clear(); } catch { /* none */ }
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname}{loc.search}</p>;
}
function mount(entry: string = ORG_PATHS.home) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path={ORG_PATHS.home} element={<HomePage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const rows = () => screen.getAllByTestId('home-job');

const SHAPES: { name: string; build: () => HomeOrganiser; requests?: boolean }[] = [
  { name: '1 live series with coming dates', build: () => page([series()]) },
  { name: 'live, 0 coming dates (no dates left)', build: () => page([series(), series({ upcoming_count: 0, next_dates: [] })]) },
  { name: 'draft 9 days old (stale draft)', build: () => page([series(), series({ lifecycle_status: 'draft', created_at: daysAgoIso(9) })]) },
  { name: 'draft 2 days old (no row)', build: () => page([series(), series({ lifecycle_status: 'draft', created_at: daysAgoIso(2) })]) },
  { name: 'live, no cover', build: () => page([series({ default_cover_image_url: null })]) },
  { name: 'open join request', build: () => page([series()]), requests: true },
  { name: 'manager role', build: () => page([series()], { role: 'manager' }) },
  { name: 'paused + ended only (first steps)', build: () => page([series({ lifecycle_status: 'paused' }), series({ lifecycle_status: 'ended' })]) },
  { name: 'no series (C1b)', build: () => page([]) },
];

describe('Home rows are homeJobs() (C1/C1b)', () => {
  it.each(SHAPES)('$name: each row reads Job.title (+ sub) in order and taps to Job.to', async ({ build, requests }) => {
    const p = build();
    organisers = [p];
    if (requests) incoming = [requestRow];
    const jobs = homeJobs(p, parseIncomingRequests(incoming), today());
    mount();
    await waitFor(() => expect(rows()).toHaveLength(jobs.length));
    rows().forEach((row, i) => {
      expect(row.getAttribute('data-kind')).toBe(jobs[i].kind);
      expect(row.tagName).toBe('BUTTON');
      expect(within(row).getByTestId('home-job-n').textContent).toBe(String(jobs[i].n));
      expect(within(row).getByTestId('home-job-title').textContent).toBe(jobs[i].title);
      if (jobs[i].sub) expect(within(row).getByTestId('home-job-sub').textContent).toBe(jobs[i].sub);
    });
    for (let i = 0; i < jobs.length; i += 1) {
      cleanup();
      mount();
      await waitFor(() => expect(rows()).toHaveLength(jobs.length));
      fireEvent.click(rows()[i]);
      expect(screen.getByTestId('where').textContent).toBe(jobs[i].to);
    }
  });

  it('a running page: 1 Change, 2 Add, 3 Cancel, then problems as further numbered rows; New event under them', async () => {
    organisers = [page([series(), series({ name: 'Sunday Party', upcoming_count: 0, next_dates: [] })])];
    mount();
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(rows().map((r) => r.textContent)).toEqual(['1Change a date', '2Add a date', '3Cancel a date', '4Add dates: Sunday PartyNo coming dates, so dancers see nothing']);
    expect(rows()[3].getAttribute('data-tone')).toBe('problem');
    fireEvent.click(screen.getByTestId('home-new-event'));
    expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.newWhat);
  });

  it('45 series of which 40 archived -> 5 series rows (R3-4)', async () => {
    const live = Array.from({ length: 5 }, () => series({ default_cover_image_url: null }));
    const archived = Array.from({ length: 40 }, () => series({ lifecycle_status: 'archived', default_cover_image_url: null, upcoming_count: 0, next_dates: [] }));
    organisers = [page([...archived, ...live])];
    mount();
    await waitFor(() => expect(screen.getAllByTestId('home-job').length).toBeGreaterThan(0));
    const seriesRows = rows().filter((r) => r.getAttribute('data-tone') === 'problem');
    expect(seriesRows.map((r) => within(r).getByTestId('home-job-title').textContent)).toEqual(live.map((s) => `Add a flyer: ${s.name}`));
  });

  it('no series -> C1b: exactly two numbered rows + New event + the four small buttons', async () => {
    organisers = [page([])];
    mount();
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(rows().map((r) => r.getAttribute('data-kind'))).toEqual(['create_first_event', 'add_manager']);
    expect(screen.getByTestId('home-new-event')).toBeTruthy();
    expect(screen.getAllByTestId('home-small').map((b) => b.textContent)).toEqual(['Team', 'My page', 'My events', 'More']);
  });

  it('the four small buttons go to Team, My page, My events, More', async () => {
    organisers = [page([series()])];
    const targets = [ORG_PATHS.team, ORG_PATHS.page, ORG_PATHS.events, ORG_PATHS.more];
    for (let i = 0; i < 4; i += 1) {
      cleanup();
      mount();
      await waitFor(() => expect(screen.getAllByTestId('home-small')).toHaveLength(4));
      fireEvent.click(screen.getAllByTestId('home-small')[i]);
      expect(screen.getByTestId('where').textContent).toBe(targets[i]);
    }
  });
});

describe('support rows (D7)', () => {
  it('absent when the env vars are absent', async () => {
    vi.stubEnv('VITE_SUPPORT_WHATSAPP', '');
    vi.stubEnv('VITE_SUPPORT_EMAIL', '');
    organisers = [page([])];
    mount();
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.queryByTestId('home-support-whatsapp')).toBeNull();
    expect(screen.queryByTestId('home-support-email')).toBeNull();
  });

  it('present on the first-steps page when set, as real links', async () => {
    vi.stubEnv('VITE_SUPPORT_WHATSAPP', 'https://wa.me/447000000000');
    vi.stubEnv('VITE_SUPPORT_EMAIL', 'help@example.com');
    organisers = [page([])];
    mount();
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.getByTestId('home-support-whatsapp').getAttribute('href')).toBe('https://wa.me/447000000000');
    expect(screen.getByTestId('home-support-email').getAttribute('href')).toBe('mailto:help@example.com');
  });
});

describe('the page name and Switch', () => {
  it('one page: the name shows, no Switch link', async () => {
    organisers = [page([series()])];
    mount();
    await waitFor(() => expect(screen.getByTestId('home-page-name').textContent).toBe('Ritmo'));
    expect(screen.queryByTestId('home-switch')).toBeNull();
  });

  it('2+ pages: the name is a 44px link to Switch; ?o= picks the page shown', async () => {
    organisers = [page([series()]), page([], { id: 'org-2', name: 'Latino Nights' })];
    mount(`${ORG_PATHS.home}?o=org-2`);
    await waitFor(() => expect(screen.getByTestId('home-switch').textContent).toContain('Latino Nights'));
    expect(screen.getByTestId('home-switch').className).toContain('min-h-[44px]');
    expect(rows().map((r) => r.getAttribute('data-kind'))[0]).toBe('create_first_event');
    fireEvent.click(screen.getByTestId('home-switch'));
    expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.switch);
  });
});

describe('loading and failure', () => {
  it('a failed read shows the error with Retry', async () => {
    organisers = [page([series()])];
    rpc.mockImplementationOnce(async () => ({ data: null, error: { message: 'boom' } }));
    mount();
    await waitFor(() => expect(screen.getByTestId('home-error')).toBeTruthy());
    fireEvent.click(screen.getByTestId('home-error-retry'));
    await waitFor(() => expect(rows()).toHaveLength(3));
  });
});
