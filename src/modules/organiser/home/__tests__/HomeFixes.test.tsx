// @vitest-environment jsdom
/** Home fixes: the line-up strip names the window it counts; a join request is confirmed once. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const api = vi.hoisted(() => ({
  home: vi.fn(), mine: vi.fn(), incoming: vi.fn(), workspace: vi.fn(), programme: vi.fn(), search: vi.fn(), request: vi.fn(),
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
    requestOrganiserAccess: api.request,
  };
});

import HomePage from '../index';
import { LINEUP_CHECK_LIMIT, noLineupText } from '../homeView';

const TODAY = '2026-10-07';
const date = (id: string, d: string) => ({
  occurrence_id: id, occurrence_date: d, lifecycle_status: 'scheduled', materialised_start_utc: null, has_own_changes: false, venue_name: 'Salsa Bar',
});
const series = (dates: ReturnType<typeof date>[]) => ({
  id: 's1', name: 'Friday Party', slug: 's1', format: 'recurring', category: 'party', lifecycle_status: 'live', default_local_start_time: null,
  upcoming_count: 20, next_dates: dates, latest_decision: null,
});
const org = (seriesList: unknown[]) => ({
  id: 'o1', name: 'Org', slug: 'org', avatar_url: null, city_id: null, lifecycle_status: 'live', role: 'owner', latest_decision: null, series: seriesList,
});
const withPeople = (occurrenceId: string) => ({
  occurrenceId, seriesId: 's1', occurrenceDate: null, version: 1, editable: true, notEditableReason: null,
  sessions: [{ series_item_id: 'i1', type: 'class' }],
  sessionPeople: [{ series_item_id: 'i1', people: [{ profile_id: 'p1', display_name: 'Ana', role: 'teaching' }] }],
});
const empty = (occurrenceId: string) => ({ ...withPeople(occurrenceId), sessionPeople: [] });
/** n weekly Friday dates from 9 Oct. */
const fridays = (n: number) => Array.from({ length: n }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 9 + 7 * i)).toISOString().slice(0, 10);
  return date(`a${i + 1}`, d);
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account/o']}>
        <Routes>
          <Route path="/account/o" element={<HomePage />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.mine.mockResolvedValue([]);
  api.incoming.mockResolvedValue([]);
  api.search.mockResolvedValue([]);
});
afterEach(cleanup);

describe('noLineupText: says which dates it counted', () => {
  it.each([
    [0, 5, null],
    [1, 1, 'Your next date has no teacher or DJ yet'],
    [1, 3, '1 of your next 3 dates has no teacher or DJ yet'],
    [2, 3, '2 of your next 3 dates have no teacher or DJ yet'],
    [4, 5, '4 of your next 5 dates have no teacher or DJ yet'],
    [3, 3, 'Your next 3 dates have no teacher or DJ yet'],
    [5, 5, 'Your next 5 dates have no teacher or DJ yet'],
  ])('%i missing of %i checked -> %j', (missing, checked, text) => {
    expect(noLineupText(missing, checked)).toBe(text);
  });
});

describe('Home line-up strip on the page', () => {
  it.each([
    // [dates listed, dates without a teacher or DJ, expected strip]
    [3, ['a2', 'a3'], '2 of your next 3 dates have no teacher or DJ yet'],
    [1, ['a1'], 'Your next date has no teacher or DJ yet'],
    // 7 dates, all empty: only the first LINEUP_CHECK_LIMIT are read, and the strip says so.
    [7, ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'], `Your next ${LINEUP_CHECK_LIMIT} dates have no teacher or DJ yet`],
    [7, ['a2'], `1 of your next ${LINEUP_CHECK_LIMIT} dates has no teacher or DJ yet`],
  ])('%i dates, empty %j -> %j', async (n, emptyIds, text) => {
    api.home.mockResolvedValue({ today: TODAY, organisers: [org([series(fridays(n))])] });
    api.programme.mockImplementation(async (id: string) => ((emptyIds as string[]).includes(id) ? empty(id) : withPeople(id)));
    mount();
    const strip = await screen.findByTestId('home-strip-lineup');
    await waitFor(() => expect(strip.textContent).toContain(text));
  });

  it('no strip when every checked date has a teacher or DJ', async () => {
    api.home.mockResolvedValue({ today: TODAY, organisers: [org([series(fridays(3))])] });
    api.programme.mockImplementation(async (id: string) => withPeople(id));
    mount();
    await screen.findAllByTestId('home-date-row');
    await waitFor(() => expect(api.programme).toHaveBeenCalledTimes(3));
    expect(screen.queryByTestId('home-strip-lineup')).toBeNull();
  });
});

describe('Ask to join confirmation', () => {
  it('is shown and announced once, not twice', async () => {
    api.home.mockResolvedValue({ today: TODAY, organisers: [] });
    api.search.mockResolvedValue([{ id: 'b', name: 'Beta', slug: 'b', avatar_url: null, city_id: null, claimed_by: 'someone', contact_email: null }]);
    api.request.mockResolvedValue({ request_id: 'r', status: 'open' });
    mount();
    fireEvent.change(await screen.findByTestId('onboarding-search'), { target: { value: 'be' } });
    fireEvent.click(await screen.findByTestId('onboarding-request'));
    fireEvent.click(await screen.findByTestId('onboarding-request-send'));
    const words = 'Request sent. The team will check and add you to Beta.';
    await waitFor(() => expect(screen.getByTestId('onboarding-done').textContent).toContain(words));
    await new Promise((r) => setTimeout(r, 80)); // past the announce delay
    const carriers = Array.from(document.body.querySelectorAll('*')).filter((el) =>
      Array.from(el.childNodes).some((c) => c.nodeType === 3 && (c.textContent ?? '').includes(words)));
    expect(carriers).toHaveLength(1);
  });
});
