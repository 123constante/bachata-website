// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { SHAPES, WEEKLY13 } from './wsFixtures';

type ShapeKey = keyof typeof SHAPES | 'weekly13';
import { L } from '../../model';

/*
 * Walk B's 10 untested cells: Details and Prices on every real event shape. Same stand-ins as
 * editScreens.send.test.tsx (supabase and the side reads only); the send path is the real one.
 * Locking is by lifecycle only (eventLock): ended and archived grey the screen; a past one-off
 * that is still "live" is open, so it sits with the open shapes here.
 */
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: false, isPending: false }) }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'city-9' }) }));
vi.mock('../../../shared/profileProgress', async (orig) => ({
  ...(await orig<typeof import('../../../shared/profileProgress')>()),
  useProfileProgress: () => ({ data: { publishReady: true, requiredLeft: [] } }),
}));
vi.mock('../../../shared/publicVenues', async (orig) => ({
  ...(await orig<typeof import('../../../shared/publicVenues')>()),
  useVenueOptions: () => ({ isPending: false, isError: false, data: [] }),
}));

import { DetailsScreen } from '../DetailsScreen';
import { PricesScreen } from '../PricesScreen';

afterEach(() => { cleanup(); rpc.mockReset(); });

type Raw = Record<string, unknown>;
const DETAILS = '/account/p3/events/ser-1/details';
const PRICES = '/account/p3/events/ser-1/prices';

function server(shape: Raw) {
  const envs: Raw[] = [];
  rpc.mockImplementation(async (name: string, args: Raw) => {
    if (name === 'admin_event_workspace_p5') return { data: shape, error: null };
    if (name === 'series_scope_change_preview_v1') return { data: { dates: [{ occurrence_id: 'o-x', occurrence_date: '2026-11-06', kept_fields: [], applied_fields: [] }], totals: { dates: 1, applied: 1, kept: 0, curated_but_inherits: 0 } }, error: null };
    if (name === 'series_command_p5') { envs.push(args.p_envelope as Raw); return { data: { ok: true, new_version: 8 }, error: null }; }
    return { data: null, error: null };
  });
  return envs;
}
function show(path: string, key: ShapeKey) {
  const envs = server(key === 'weekly13' ? WEEKLY13 : SHAPES[key]);
  const router = createMemoryRouter([
    { path: '/account/p3/events/:seriesId', element: <p data-testid="p3-event">event</p> },
    { path: '/account/p3/events/:seriesId/details', element: <DetailsScreen /> },
    { path: '/account/p3/events/:seriesId/prices', element: <PricesScreen /> },
  ], { initialEntries: [path] });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
  return envs;
}
const saveBtn = () => screen.getByTestId('p3-save') as HTMLButtonElement;
const press = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };

const OPEN: ShapeKey[] = ['oneoff', 'oneoffPast', 'draft', 'draftReady', 'course', 'courseDone', 'paused', 'weekly', 'weekly13'];
const LOCKED: ShapeKey[] = ['ended'];

describe('detailsShapeMatrix', () => {
  it.each(OPEN)('%s: renders, Save is off until a change, an untouched Save sends nothing, one edit is one series.upsert', async (key) => {
    const envs = show(DETAILS, key);
    await waitFor(() => screen.getByTestId('p3-details'));
    expect((screen.getByTestId('p3-d-name') as HTMLInputElement).disabled).toBe(false);
    expect(screen.queryByTestId('p3-details-lock')).toBeNull();
    expect(saveBtn().disabled).toBe(true);
    expect(saveBtn().textContent).toBe(L.nothingChanged);
    await press(saveBtn());
    expect(envs).toHaveLength(0);
    // a draft has no name yet, and Save waits for one: that is the one field a draft owes
    if (key === 'draft') {
      fireEvent.change(screen.getByTestId('p3-d-description'), { target: { value: 'Matrix edit.' } });
      expect(saveBtn().disabled).toBe(true);
      expect(screen.getByTestId('p3-save-why').textContent).toBeTruthy();
      fireEvent.change(screen.getByTestId('p3-d-name'), { target: { value: 'Draft night' } });
      fireEvent.change(screen.getByTestId('p3-d-description'), { target: { value: '' } });
    } else {
      fireEvent.change(screen.getByTestId('p3-d-description'), { target: { value: 'Matrix edit.' } });
    }
    expect(saveBtn().disabled).toBe(false);
    await press(saveBtn());
    const ask = screen.queryByTestId('p3-scope-this');
    if (ask) { await press(ask); }
    await waitFor(() => expect(envs.length).toBeGreaterThan(0), { timeout: 3000 });
    expect(envs).toHaveLength(1);
    const cmd = envs[0].command as Raw;
    expect(cmd.kind).toBe('series.upsert');
    const keys = Object.keys(cmd.payload as Raw).filter((k) => k !== 'name');
    expect(keys).toEqual(key === 'draft' ? [] : ['default_description']);
  });

  it.each(LOCKED)('%s: every field is greyed and Save names why', async (key) => {
    const envs = show(DETAILS, key);
    await waitFor(() => screen.getByTestId('p3-details-lock'));
    expect((screen.getByTestId('p3-d-name') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('p3-d-description') as HTMLTextAreaElement).disabled).toBe(true);
    expect(saveBtn().disabled).toBe(true);
    expect(screen.getByTestId('p3-save-why').textContent).toMatch(/can't be changed here/);
    await press(saveBtn());
    expect(envs).toHaveLength(0);
  });

  it('weekly13: 13 dates, the date with its own changes shows "Different on 1 date" under the name', async () => {
    show(DETAILS, 'weekly13');
    await waitFor(() => screen.getByTestId('p3-details'));
    expect(screen.getByTestId('p3-different-on-name').textContent).toBe('Different on 1 date');
  });
  it('weekly: 2026-11-13 is flagged has_override with no field keys, so no field gets a Different line', async () => {
    show(DETAILS, 'weekly');
    await waitFor(() => screen.getByTestId('p3-details'));
    expect(document.querySelector('[data-testid^="p3-different-on"]')).toBeNull();
  });

  it('archived: no editor at all, the finished card says so', async () => {
    const envs = show(DETAILS, 'archived');
    await waitFor(() => screen.getByTestId('p3-event-archived'));
    expect(screen.queryByTestId('p3-d-name')).toBeNull();
    expect(envs).toHaveLength(0);
  });
});

describe('detailsFestivalShape', () => {
  it('festival: renders open; pictures are festival-limited; one edit is one series.upsert', async () => {
    const envs = show(DETAILS, 'festival');
    await waitFor(() => screen.getByTestId('p3-details'));
    expect(saveBtn().disabled).toBe(true);
    await press(saveBtn());
    expect(envs).toHaveLength(0);
    expect(screen.getByTestId('p3-d-pictures-festival')).toBeTruthy();
    fireEvent.change(screen.getByTestId('p3-d-description'), { target: { value: 'Matrix edit.' } });
    await press(saveBtn());
    await waitFor(() => expect(envs).toHaveLength(1));
    expect(Object.keys(((envs[0].command as Raw).payload) as Raw).filter((k) => k !== 'name')).toEqual(['default_description']);
  });
});

describe('pricesShapeMatrix', () => {
  const edit = () => {
    const sw = screen.queryByTestId('p3-free-switch');
    if (sw) { fireEvent.click(sw); return 'payment_methods'; }
    fireEvent.click(screen.getAllByTestId('p3-pay-chip')[0]);
    return 'payment_methods';
  };
  it.each([...OPEN, 'festival' as ShapeKey])('%s: renders, Save off until a change, untouched Save sends nothing, one edit is one series.upsert', async (key) => {
    const envs = show(PRICES, key);
    await waitFor(() => screen.getByTestId('p3-prices'));
    expect(screen.queryByTestId('p3-prices-lock')).toBeNull();
    expect(saveBtn().disabled).toBe(true);
    expect(saveBtn().textContent).toBe(L.nothingChanged);
    await press(saveBtn());
    expect(envs).toHaveLength(0);
    const field = edit();
    expect(saveBtn().disabled).toBe(false);
    await press(saveBtn());
    const ask = screen.queryByTestId('p3-scope-this');
    if (ask) { await press(ask); }
    await waitFor(() => expect(envs.length).toBeGreaterThan(0), { timeout: 3000 });
    expect(envs).toHaveLength(1);
    const cmd = envs[0].command as Raw;
    expect(cmd.kind).toBe('series.upsert');
    expect(Object.keys(cmd.payload as Raw).filter((k) => k !== 'name')).toEqual([field]);
  });

  it.each(LOCKED)('%s: the screen is greyed and Save names why', async (key) => {
    const envs = show(PRICES, key);
    await waitFor(() => screen.getByTestId('p3-prices-lock'));
    const sw = screen.queryByTestId('p3-free-switch') as HTMLInputElement | null;
    if (sw) expect(sw.disabled).toBe(true);
    screen.getAllByTestId('p3-pay-chip').forEach((c) => expect((c as HTMLButtonElement).disabled).toBe(true));
    expect(saveBtn().disabled).toBe(true);
    expect(screen.getByTestId('p3-save-why').textContent).toMatch(/can't be changed here/);
    expect(envs).toHaveLength(0);
  });

  it('archived: no editor at all, the finished card says so', async () => {
    const envs = show(PRICES, 'archived');
    await waitFor(() => screen.getByTestId('p3-event-archived'));
    expect(screen.queryByTestId('p3-save')).toBeNull();
    expect(envs).toHaveLength(0);
  });

  it('weekly13: the date with its own changes does not show a price Different line for a title-only change', async () => {
    show(PRICES, 'weekly13');
    await waitFor(() => screen.getByTestId('p3-prices'));
    expect(screen.queryByTestId('p3-different-on-price')).toBeNull();
  });
});
