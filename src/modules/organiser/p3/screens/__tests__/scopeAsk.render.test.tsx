// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { SHAPES, wsRaw } from './wsFixtures';
import { L, saveWordsFor } from '../../model';
import { VERSION_CONFLICT } from '../../../shared/copy';
import { LINK_PROBLEM } from '../../../shared/linkRules';

/*
 * W3a through the REAL send path: edit screen -> useSaveRun -> useSendOnce -> runSeriesCommand ->
 * envelope. Only supabase and the side reads (admin check, profile progress, venues, city) are
 * stood in for. A data router (createMemoryRouter) so the leave guard's router blocker is live,
 * as under app/root.tsx.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: false, isPending: false }) }));
const city = vi.hoisted(() => vi.fn(async () => ({ cityId: 'city-9' }) as { cityId: string } | null));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: city }));
vi.mock('../../../shared/profileProgress', async (orig) => ({
  ...(await orig<typeof import('../../../shared/profileProgress')>()),
  useProfileProgress: () => ({ data: { publishReady: true, requiredLeft: [] } }),
}));
vi.mock('../../../shared/publicVenues', async (orig) => ({
  ...(await orig<typeof import('../../../shared/publicVenues')>()),
  useVenueOptions: () => ({ isPending: false, isError: false, data: [
    { id: 'v1', name: 'Salsa Hall', neighbourhood: null, city_name: 'Leeds', address: null, postcode: null },
    { id: 'v2', name: 'Studio Two', neighbourhood: 'Soho', city_name: 'London', address: null, postcode: null },
  ] }),
}));

import { EventPage } from '../EventPage';
import { DetailsScreen } from '../DetailsScreen';
import { PricesScreen } from '../PricesScreen';

afterEach(() => { previews.length = 0; scoped.length = 0; cleanup(); rpc.mockReset(); city.mockReset(); city.mockImplementation(async () => ({ cityId: 'city-9' })); });

type Raw = Record<string, unknown>;
let raw: Raw = SHAPES.weekly;
let qc: QueryClient;
let router: ReturnType<typeof createMemoryRouter>;

const previews: Raw[] = [];
const scoped: Raw[] = [];
const dateRow = (id: string, date: string, kept: string[] = []) => ({ occurrence_id: id, occurrence_date: date, kept_fields: kept, applied_fields: kept.length ? [] : ['x'] });
let preview: (a: Raw) => unknown = () => ({ data: null, error: null });
let scopedReply: (e: Raw) => unknown = () => ({ data: { scope: 'all_dates', applied_dates: ['a'], kept_dates: [], result: { new_version: 8 } }, error: null });
const previewOf = (dates: Raw[]) => ({ data: { dates, totals: { dates: dates.length, applied: dates.filter((d) => !(d.kept_fields as string[]).length).length, kept: dates.filter((d) => (d.kept_fields as string[]).length).length, curated_but_inherits: 0 } }, error: null });
const THREE = [dateRow('o-2026-11-06', '2026-11-06'), dateRow('o-2026-11-13', '2026-11-13'), dateRow('o-2026-11-20', '2026-11-20')];

function server(command: (env: Raw, n: number) => unknown = () => ({ data: { ok: true, new_version: 8 }, error: null })) {
  const envs: Raw[] = [];
  rpc.mockImplementation(async (name: string, args: Raw) => {
    if (name === 'admin_event_workspace_p5') return { data: raw, error: null };
    if (name === 'series_command_p5') { envs.push(args.p_envelope as Raw); return command(args.p_envelope as Raw, envs.length); }
    if (name === 'series_scope_change_preview_v1') { previews.push(args); return preview(args); }
    if (name === 'series_scoped_change_p5') { scoped.push(args.p_envelope as Raw); return scopedReply(args.p_envelope as Raw); }
    return { data: null, error: null };
  });
  return envs;
}

function show(path: string, shape: Raw = SHAPES.weekly) {
  raw = shape;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  router = createMemoryRouter([
    { path: '/account/p3/events/:seriesId', element: <EventPage /> },
    { path: '/account/p3/events/:seriesId/details', element: <DetailsScreen /> },
    { path: '/account/p3/events/:seriesId/prices', element: <PricesScreen /> },
    { path: '/account/p3/events', element: <p data-testid="events-list">events</p> },
  ], { initialEntries: [path] });
  render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>);
}

const DETAILS = '/account/p3/events/ser-1/details';
const PRICES = '/account/p3/events/ser-1/prices';
const saveBtn = () => screen.getByTestId('p3-save') as HTMLButtonElement;
const type = (id: string, value: string) => fireEvent.change(screen.getByTestId(id), { target: { value } });
const press = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };


const pickPlace = async () => {
  await waitFor(() => screen.getByTestId('p3-d-pick-place'));
  fireEvent.click(screen.getByTestId('p3-d-pick-place'));
  fireEvent.click(within(screen.getByTestId('p3-d-venues')).getByText('Studio Two'));
  await waitFor(() => expect(saveBtn().disabled).toBe(false));
};

describe('Scope ask: Details', () => {
  it('a one-date event: Save sends today\'s series.upsert, no sheet, no preview', async () => {
    const envs = server();
    show(DETAILS, SHAPES.oneoff);
    await pickPlace();
    await press(saveBtn());
    await waitFor(() => expect(envs).toHaveLength(1));
    expect(screen.queryByTestId('p3-sheet')).toBeNull();
    expect(previews).toHaveLength(0);
    expect(scoped).toHaveLength(0);
    expect((envs[0].command as Raw).kind).toBe('series.upsert');
  });

  it('3 dates + new place: the sheet opens, preview asks venue_id, "All 3 dates"; one date sends this_date for that id', async () => {
    const envs = server();
    preview = () => previewOf(THREE);
    show(DETAILS);
    await pickPlace();
    await press(saveBtn());
    await waitFor(() => screen.getByTestId('p3-scope-all'));
    expect(previews).toEqual([{ p_series_id: 'ser-1', p_fields: ['venue_id'] }]);
    expect(screen.getByTestId('p3-sheet').textContent).toContain('All 3 dates');
    expect(screen.getByTestId('p3-scope-line').textContent).toBe('Every date changes.');
    expect(envs).toHaveLength(0);
    await press(screen.getByTestId('p3-scope-one'));
    const dates = screen.getAllByTestId('p3-scope-date');
    expect(dates.map((b) => b.textContent)).toEqual(['Friday 6 November', 'Friday 13 November', 'Friday 20 November']);
    await press(dates[1]);
    await waitFor(() => expect(scoped).toHaveLength(1));
    expect(scoped[0]).toMatchObject({ series_id: 'ser-1', scope: 'this_date', occurrence_id: 'o-2026-11-13', changes: { venue_id: 'v2', city_id: 'city-9' } });
    expect(envs).toHaveLength(0);
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(screen.getByTestId('p3-toast').textContent).toContain(saveWordsFor(false, 'live').savedDate('Friday 13 November'));
  });

  it('All dates sends the scoped all_dates call (no occurrence_id) and says which dates kept their own place', async () => {
    server();
    preview = () => previewOf([THREE[0], dateRow('o-2026-11-13', '2026-11-13', ['venue_id', 'city_id']), THREE[2]]);
    scopedReply = () => ({ data: { scope: 'all_dates', applied_dates: ['a', 'b'], kept_dates: [{ occurrence_id: 'o-2026-11-13', occurrence_date: '2026-11-13', fields: ['venue_id', 'city_id'] }], result: { new_version: 8 } }, error: null });
    show(DETAILS);
    await pickPlace();
    await press(saveBtn());
    await waitFor(() => screen.getByTestId('p3-scope-all'));
    expect(screen.getByTestId('p3-scope-line').textContent).toBe('2 dates change. 1 keeps its own place because you edited it by hand.');
    await press(screen.getByTestId('p3-scope-all'));
    await waitFor(() => expect(scoped).toHaveLength(1));
    expect('occurrence_id' in scoped[0]).toBe(false);
    expect(scoped[0]).toMatchObject({ scope: 'all_dates', expected_version: 7 });
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(screen.getByTestId('p3-toast').textContent).toContain(`${saveWordsFor(false, 'live').detailsSaved} 1 date kept its own place.`);
  });

  it('place + description: "Just one date" is disabled with its reason; All dates is today\'s single upsert, no scoped call', async () => {
    const envs = server();
    preview = () => previewOf(THREE);
    show(DETAILS);
    await waitFor(() => screen.getByTestId('p3-d-description'));
    type('p3-d-description', 'New words.');
    await pickPlace();
    await press(saveBtn());
    await waitFor(() => screen.getByTestId('p3-scope-all'));
    expect((screen.getByTestId('p3-scope-one') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('p3-scope-one-why').textContent).toBe('Name, description, music and the other details change every date. Save those first, then change this one.');
    await press(screen.getByTestId('p3-scope-all'));
    await waitFor(() => expect(envs).toHaveLength(1));
    expect(scoped).toHaveLength(0);
    expect(Object.keys((envs[0].command as Raw).payload as Raw).sort()).toEqual(['default_city_id', 'default_description', 'default_venue_id', 'name']);
  });

  it('the preview fails: Try again, nothing writes; Cancel keeps the typing and sends nothing', async () => {
    const envs = server();
    preview = () => ({ data: null, error: { message: 'boom' } });
    show(DETAILS);
    await pickPlace();
    await press(saveBtn());
    await waitFor(() => screen.getByTestId('p3-scope-retry'));
    expect(screen.queryByTestId('p3-scope-all')).toBeNull();
    preview = () => previewOf(THREE);
    await press(screen.getByTestId('p3-scope-retry'));
    await waitFor(() => screen.getByTestId('p3-scope-all'));
    await press(screen.getByTestId('p3-scope-cancel'));
    expect(screen.queryByTestId('p3-sheet')).toBeNull();
    expect(envs).toHaveLength(0);
    expect(scoped).toHaveLength(0);
    expect(screen.getByTestId('p3-d-place').textContent).toBe('Studio Two');
  });

  it('only one future date by the read: no question, today\'s save runs', async () => {
    const envs = server();
    preview = () => previewOf([THREE[0]]);
    show(DETAILS);
    await pickPlace();
    await press(saveBtn());
    await waitFor(() => expect(envs).toHaveLength(1));
    expect(scoped).toHaveLength(0);
  });

  it('a dropped connection then a retry sends the same idempotency key', async () => {
    server();
    preview = () => previewOf(THREE);
    let n = 0;
    scopedReply = () => (++n === 1 ? { data: null, error: { message: 'Failed to fetch' } } : { data: { scope: 'all_dates', applied_dates: ['a'], kept_dates: [], result: { new_version: 8 } }, error: null });
    show(DETAILS);
    await pickPlace();
    await press(saveBtn());
    await waitFor(() => screen.getByTestId('p3-scope-all'));
    await press(screen.getByTestId('p3-scope-all'));
    await waitFor(() => screen.getByTestId('p3-scope-error'));
    await press(screen.getByTestId('p3-scope-all'));
    await waitFor(() => expect(scoped).toHaveLength(2));
    expect(scoped[1].idempotency_key).toBe(scoped[0].idempotency_key);
  });
});

describe('Scope ask: Prices', () => {
  it('3 dates + a new price: preview asks passes; one date sends passes for that date', async () => {
    server();
    preview = () => previewOf(THREE);
    show(PRICES);
    await waitFor(() => screen.getByTestId('p3-price-add'));
    fireEvent.click(screen.getByTestId('p3-price-add'));
    type('p3-price-name', 'Class and party');
    type('p3-price-amount', '15');
    await press(saveBtn());
    await waitFor(() => screen.getByTestId('p3-scope-all'));
    expect(previews).toEqual([{ p_series_id: 'ser-1', p_fields: ['passes'] }]);
    await press(screen.getByTestId('p3-scope-one'));
    await press(screen.getAllByTestId('p3-scope-date')[0]);
    await waitFor(() => expect(scoped).toHaveLength(1));
    expect(scoped[0]).toMatchObject({ scope: 'this_date', occurrence_id: 'o-2026-11-06' });
    expect(Object.keys(scoped[0].changes as Raw)).toEqual(['passes']);
  });

  it('only how-to-pay changed: not a scoped field, no sheet', async () => {
    const envs = server();
    show(PRICES);
    await waitFor(() => screen.getAllByTestId('p3-pay-chip'));
    fireEvent.click(screen.getAllByTestId('p3-pay-chip')[1]);
    await press(saveBtn());
    await waitFor(() => expect(envs).toHaveLength(1));
    expect(previews).toHaveLength(0);
  });
});
