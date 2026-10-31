// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { SHAPES } from './wsFixtures';
import { L } from '../../model';
import { VENUE_LIST_COPY } from '../VenueList';

/*
 * F-17 and F-18 as the person sees them: the real screens, the real sheets.
 * F-17: [Details place sheet, date Where sheet] x [failed, empty] - Try again and the line sit inside the open sheet.
 * F-18: PricesScreen x [festival with 0 prices, weekly with 0 prices] - the free switch and the empty copy agree.
 */

const rpc = vi.hoisted(() => vi.fn());
const venues = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: false, isPending: false }) }));
vi.mock('../../../shared/profileProgress', async (orig) => ({
  ...(await orig<typeof import('../../../shared/profileProgress')>()),
  useProfileProgress: () => ({ data: { publishReady: true, requiredLeft: [] } }),
}));
vi.mock('../../../shared/publicVenues', async (orig) => ({
  ...(await orig<typeof import('../../../shared/publicVenues')>()),
  useVenueOptions: () => venues.value,
}));

import { EventPage } from '../EventPage';
import { DetailsScreen } from '../DetailsScreen';
import { PricesScreen } from '../PricesScreen';

afterEach(cleanup);

const refetch = vi.fn();
const VENUE_SHAPES = {
  failed: { isPending: false, isError: true, data: undefined, refetch },
  empty: { isPending: false, isError: false, data: [], refetch },
} as const;
const SHOWS = { failed: VENUE_LIST_COPY.fail, empty: VENUE_LIST_COPY.empty };

let shape: Record<string, unknown>;
function show(path: string) {
  rpc.mockReset();
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'admin_event_workspace_p5') return { data: shape, error: null };
    if (name === 'event_view_p5') {
      const id = (args.p_target as { occurrence_id: string }).occurrence_id;
      return { data: { event: {}, occurrence: { id, date: id.slice(2), version: 3, lifecycle_status: 'scheduled', materialised_start_utc: `${id.slice(2)}T20:00:00Z` }, schedule: {} }, error: null };
    }
    return { data: null, error: null };
  });
  const router = createMemoryRouter([
    { path: '/account/p3/events/:seriesId', element: <EventPage /> },
    { path: '/account/p3/events/:seriesId/details', element: <DetailsScreen /> },
    { path: '/account/p3/events/:seriesId/prices', element: <PricesScreen /> },
  ], { initialEntries: [path] });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
}

const OPEN = {
  'Details place sheet': async () => {
    show('/account/p3/events/ser-1/details');
    await waitFor(() => screen.getByTestId('p3-d-pick-place'));
    fireEvent.click(screen.getByTestId('p3-d-pick-place'));
  },
  'date Where sheet': async () => {
    show('/account/p3/events/ser-1');
    await waitFor(() => screen.getAllByTestId('p3-open-date'));
    fireEvent.click(screen.getAllByTestId('p3-open-date')[0]);
    await waitFor(() => screen.getByTestId('p3-date-act-details'));
    fireEvent.click(screen.getByTestId('p3-date-act-details'));
    await waitFor(() => screen.getByTestId('p3-own-where-edit'));
    fireEvent.click(screen.getByTestId('p3-own-where-edit'));
  },
} as const;

describe('F-17 place sheets x venue list shape', () => {
  beforeEach(() => { refetch.mockReset(); shape = SHAPES.weekly; });
  for (const [sheet, open] of Object.entries(OPEN)) {
    it.each(Object.keys(VENUE_SHAPES) as (keyof typeof VENUE_SHAPES)[])(`${sheet}: %s shows its line and Try again`, async (k) => {
      venues.value = VENUE_SHAPES[k];
      await open();
      await waitFor(() => screen.getByTestId('p3-venues-retry'));
      expect(screen.getByText(SHOWS[k])).toBeTruthy();
      fireEvent.click(screen.getByTestId('p3-venues-retry'));
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  }
});

describe('F-18 PricesScreen x events with 0 prices', () => {
  beforeEach(() => { venues.value = { isPending: false, isError: false, data: [], refetch }; });
  it.each([
    ['festival', SHAPES.festival, false],
    ['weekly', SHAPES.weekly, true],
  ])('%s: the free switch is %s and the empty line agrees', async (_n, s, switchShown) => {
    shape = s;
    show('/account/p3/events/ser-1/prices');
    await waitFor(() => screen.getByTestId('p3-prices-empty'));
    expect(!!screen.queryByTestId('p3-free-switch')).toBe(switchShown);
    const line = screen.getByTestId('p3-prices-empty').textContent ?? '';
    expect(line).toBe(L.pricesNone(switchShown));
    expect(/free/i.test(line)).toBe(switchShown);
    expect(screen.getByTestId('p3-price-add')).toBeTruthy();
  });
});
