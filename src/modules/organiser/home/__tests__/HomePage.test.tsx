// @vitest-environment jsdom
/** W1 Home: next dates, the three strips, empty / error / loading, and onboarding when there is no organiser. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const api = vi.hoisted(() => ({
  home: vi.fn(),
  mine: vi.fn(),
  incoming: vi.fn(),
  workspace: vi.fn(),
  programme: vi.fn(),
  search: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, session: null }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => {
  const actual = await vi.importActual<typeof import('@/modules/organiser/shared/selfServeApi')>('@/modules/organiser/shared/selfServeApi');
  return {
    ...actual,
    fetchOrganiserHome: api.home,
    fetchMyAccessRequests: api.mine,
    fetchIncomingAccessRequests: api.incoming,
    fetchSeriesWorkspace: api.workspace,
    fetchOccurrenceProgramme: api.programme,
    searchClaimableOrganisers: api.search,
  };
});

import HomePage from '../index';

const TODAY = '2026-10-07';
const date = (id: string, d: string, extra: Record<string, unknown> = {}) => ({
  occurrence_id: id, occurrence_date: d, lifecycle_status: 'scheduled', materialised_start_utc: null, has_own_changes: false, venue_name: 'Salsa Bar', ...extra,
});
const series = (id: string, name: string, dates: ReturnType<typeof date>[], extra: Record<string, unknown> = {}) => ({
  id, name, slug: id, format: 'recurring', category: 'party', lifecycle_status: 'live', default_local_start_time: null,
  upcoming_count: 20, next_dates: dates, latest_decision: null, ...extra,
});
const org = (seriesList: unknown[], role = 'owner') => ({
  id: 'o1', name: 'Org', slug: 'org', avatar_url: null, city_id: null, lifecycle_status: 'live', role, latest_decision: null, series: seriesList,
});
const withPeople = (occurrenceId: string) => ({
  occurrenceId, seriesId: 's1', occurrenceDate: null, version: 1, editable: true, notEditableReason: null,
  sessions: [{ series_item_id: 'i1', type: 'class' }],
  sessionPeople: [{ series_item_id: 'i1', people: [{ profile_id: 'p1', display_name: 'Ana', role: 'teaching' }] }],
});
const empty = (occurrenceId: string) => ({ ...withPeople(occurrenceId), sessionPeople: [] });

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname}</p>;
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account/o']}>
        <Routes>
          <Route path="/account/o" element={<HomePage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.mine.mockResolvedValue([]);
  api.incoming.mockResolvedValue([]);
  api.programme.mockImplementation(async (id: string) => withPeople(id));
  api.search.mockResolvedValue([]);
});
afterEach(cleanup);

describe('Home list', () => {
  it('shows skeleton rows while loading, then the next dates soonest first with venue and status', async () => {
    let resolve!: (v: unknown) => void;
    api.home.mockReturnValue(new Promise((r) => (resolve = r)));
    mount();
    expect(screen.getByTestId('home-loading')).toBeTruthy();
    resolve({
      today: TODAY,
      organisers: [org([
        series('s1', 'Friday Party', [date('a2', '2026-10-16'), date('a1', '2026-10-09')]),
        series('s2', 'Tuesday Class', [date('b1', '2026-10-13', { venue_name: null, lifecycle_status: 'cancelled' })], { lifecycle_status: 'draft' }),
      ])],
    });
    const rows = await screen.findAllByTestId('home-date-row');
    expect(rows.map((r) => r.getAttribute('data-occurrence'))).toEqual(['a1', 'b1', 'a2']);
    expect(rows[0].textContent).toContain('Friday Party');
    expect(rows[0].textContent).toContain('Salsa Bar');
    expect(rows[0].textContent).toContain('Live');
    expect(rows[1].textContent).toContain('Cancelled');
    expect(rows[1].textContent).toContain('Venue not set');
    expect(rows[0].getAttribute('href')).toBe('/account/o/events/s1/dates/a1');
    expect(screen.getAllByTestId('home-new-event')).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/views|tickets sold|revenue/i);
  });

  it('New event goes to the new-event page', async () => {
    api.home.mockResolvedValue({ today: TODAY, organisers: [org([series('s1', 'Friday Party', [date('a1', '2026-10-09')])])] });
    mount();
    fireEvent.click(await screen.findByTestId('home-new-event'));
    expect(screen.getByTestId('where').textContent).toBe('/account/o/events/new');
  });

  it('empty: no events yet offers the New event button', async () => {
    api.home.mockResolvedValue({ today: TODAY, organisers: [org([])] });
    mount();
    const emptyState = await screen.findByTestId('home-empty');
    expect(emptyState.textContent).toContain('No events yet');
    expect(screen.getAllByTestId('home-new-event')).toHaveLength(1);
    expect(screen.queryByTestId('home-strips')).toBeNull();
  });

  it('a lapsed series simply has no upcoming dates (no strip)', async () => {
    api.home.mockResolvedValue({ today: TODAY, organisers: [org([series('s1', 'Old', [], { upcoming_count: 0 })])] });
    mount();
    expect((await screen.findByTestId('home-empty')).textContent).toContain('No dates coming up');
    expect(screen.queryByTestId('home-strip-runway')).toBeNull();
  });

  it('error: shows the error state and retries', async () => {
    api.home.mockRejectedValueOnce(new Error('boom'));
    mount();
    const err = await screen.findByTestId('home-error');
    expect(err.textContent).toContain('did not load');
    api.home.mockResolvedValue({ today: TODAY, organisers: [org([series('s1', 'Friday Party', [date('a1', '2026-10-09')])])] });
    fireEvent.click(screen.getByTestId('home-error-retry'));
    expect(await screen.findAllByTestId('home-date-row')).toHaveLength(1);
  });
});

describe('Home strips', () => {
  it('none when nothing needs the organiser', async () => {
    api.home.mockResolvedValue({ today: TODAY, organisers: [org([series('s1', 'Friday Party', [date('a1', '2026-10-09')])])] });
    mount();
    await screen.findAllByTestId('home-date-row');
    await waitFor(() => expect(api.programme).toHaveBeenCalled());
    expect(screen.queryByTestId('home-strips')).toBeNull();
  });

  it('(a) team requests waiting opens Team', async () => {
    api.home.mockResolvedValue({ today: TODAY, organisers: [org([series('s1', 'Friday Party', [date('a1', '2026-10-09')])])] });
    api.incoming.mockResolvedValue([{ requestId: 'r1' }, { requestId: 'r2' }]);
    mount();
    const strip = await screen.findByTestId('home-strip-team');
    expect(strip.textContent).toContain('2 team requests are waiting');
    fireEvent.click(strip);
    expect(screen.getByTestId('where').textContent).toBe('/account/o/team');
  });

  // F4: the strip says Extend, so it shows only for an event whose editor HAS Extend
  // (the owner's weekly rule). The home read carries no rule: the series is read.
  const weeklyRule = { mode: 'weekly', interval: 1, weekdays: [5], end: { kind: 'none' } };

  it('(b) runway: the last date from the home read when every upcoming date is listed', async () => {
    api.home.mockResolvedValue({
      today: TODAY,
      organisers: [org([series('s1', 'Friday Party', [date('a1', '2026-10-09'), date('a2', '2026-10-16')], { upcoming_count: 2 })])],
    });
    api.workspace.mockResolvedValue({ series: { format: 'recurring', recurrence_rule: weeklyRule }, dates: [] });
    mount();
    const strip = await screen.findByTestId('home-strip-runway');
    expect(strip.textContent).toContain('Friday Party: dates listed until Fri 16 Oct.');
    expect(strip.textContent).toContain('Extend');
    fireEvent.click(strip);
    expect(screen.getByTestId('where').textContent).toBe('/account/o/events/s1');
  });

  it('(b) runway reads the series dates when more than 3 but at most 8 are left', async () => {
    api.home.mockResolvedValue({
      today: TODAY,
      organisers: [org([series('s1', 'Friday Party', [date('a1', '2026-10-09'), date('a2', '2026-10-16'), date('a3', '2026-10-23')], { upcoming_count: 5 })])],
    });
    api.workspace.mockResolvedValue({
      series: { format: 'recurring', recurrence_rule: weeklyRule },
      dates: ['2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06'].map((d, i) => ({ id: `x${i}`, occurrence_date: d })),
    });
    mount();
    expect((await screen.findByTestId('home-strip-runway')).textContent).toContain('dates listed until Fri 6 Nov');
    expect(api.workspace).toHaveBeenCalledWith('s1');
  });

  it('(b) no Extend strip for a repeating event with no weekly rule (its editor has no Extend)', async () => {
    api.home.mockResolvedValue({
      today: TODAY,
      organisers: [org([series('s1', 'Friday Party', [date('a1', '2026-10-09'), date('a2', '2026-10-16')], { upcoming_count: 2 })])],
    });
    api.workspace.mockResolvedValue({ series: { format: 'recurring', recurrence_rule: null }, dates: [] });
    mount();
    await waitFor(() => expect(api.workspace).toHaveBeenCalledWith('s1'));
    await screen.findAllByTestId('home-date-row');
    expect(screen.queryByTestId('home-strip-runway')).toBeNull();
  });

  it('(b) no strip when the series runs 8 weeks or more ahead', async () => {
    api.home.mockResolvedValue({
      today: TODAY,
      organisers: [org([series('s1', 'Friday Party', [date('a1', '2026-10-09'), date('a2', '2026-10-16'), date('a3', '2026-10-23')], { upcoming_count: 8 })])],
    });
    api.workspace.mockResolvedValue({ series: { format: 'recurring', recurrence_rule: weeklyRule }, dates: [{ id: 'z', occurrence_date: '2026-12-04' }] });
    mount();
    await waitFor(() => expect(api.workspace).toHaveBeenCalled());
    await screen.findAllByTestId('home-date-row');
    expect(screen.queryByTestId('home-strip-runway')).toBeNull();
  });

  it('(c) counts dates with no teacher or DJ and opens the first', async () => {
    api.home.mockResolvedValue({
      today: TODAY,
      organisers: [org([series('s1', 'Friday Party', [date('a1', '2026-10-09'), date('a2', '2026-10-16'), date('a3', '2026-10-23')])])],
    });
    api.programme.mockImplementation(async (id: string) => (id === 'a1' ? withPeople(id) : empty(id)));
    mount();
    const strip = await screen.findByTestId('home-strip-lineup');
    expect(strip.textContent).toContain('2 dates have no teacher or DJ yet');
    fireEvent.click(strip);
    expect(screen.getByTestId('where').textContent).toBe('/account/o/events/s1/dates/a2');
  });
});

describe('Home without an organiser', () => {
  it('renders onboarding, with the requests waiting for an answer', async () => {
    api.home.mockResolvedValue({ today: TODAY, organisers: [] });
    api.mine.mockResolvedValue([
      { requestId: 'r1', organiserId: 'o9', organiserName: 'Bachata Nights', status: 'open', createdAt: '2026-10-06T10:00:00Z', resolvedAt: null },
    ]);
    mount();
    expect(await screen.findByTestId('org-onboarding')).toBeTruthy();
    expect((await screen.findByTestId('onboarding-pending-row')).textContent).toContain('Bachata Nights');
    expect(screen.queryByTestId('home-new-event')).toBeNull();
  });
});
