// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { occ, wsRaw, weekly } from './wsFixtures';

const rpc = vi.hoisted(() => vi.fn());
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
  useVenueOptions: () => ({ isPending: false, isError: false, data: [] }),
}));

import { DetailsScreen } from '../DetailsScreen';
import { PricesScreen } from '../PricesScreen';

afterEach(() => { cleanup(); rpc.mockReset(); });

function show(path: string, dates: unknown[], meta = {}) {
  rpc.mockImplementation(async (name: string) => (name === 'admin_event_workspace_p5' ? { data: wsRaw({}, [], dates, meta), error: null } : { data: null, error: null }));
  const router = createMemoryRouter([
    { path: '/account/p3/events/:seriesId/details', element: <DetailsScreen /> },
    { path: '/account/p3/events/:seriesId/prices', element: <PricesScreen /> },
  ], { initialEntries: [path] });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
}
const D = '/account/p3/events/ser-1/details';
const P = '/account/p3/events/ser-1/prices';
const [a, b, c] = weekly('2026-11-06', 3);
const own = (d: string, keys: string[], status = 'scheduled') => occ(d, status, { override_keys: keys });

describe('differentDatesCount.matrix (screens)', () => {
  it('Details: a line under each field that has own dates, plain text', async () => {
    show(D, [own(a, ['title', 'description']), own(b, ['venue_id', 'city_id', 'ticket_url']), own(c, ['cover_image_url', 'music_styles', 'title'], 'cancelled')]);
    await screen.findByTestId('p3-details');
    expect(screen.getByTestId('p3-different-on-name').textContent).toBe('Different on 1 date');
    expect(screen.getByTestId('p3-different-on-about').textContent).toBe('Different on 1 date');
    expect(screen.getByTestId('p3-different-on-where').textContent).toBe('Different on 1 date');
    expect(screen.getByTestId('p3-different-on-ticket').textContent).toBe('Different on 1 date');
    expect(screen.queryByTestId('p3-different-on-cover')).toBeNull();
    expect(screen.queryByTestId('p3-different-on-music')).toBeNull();
    expect(screen.getByTestId('p3-different-on-name').closest('a,button')).toBeNull();
  });
  it('Details: nothing when no date is different; N dates; capped wording', async () => {
    show(D, [occ(a), occ(b)]);
    await screen.findByTestId('p3-details');
    expect(document.querySelector('[data-testid^="p3-different-on"]')).toBeNull();
    cleanup();
    show(D, [own(a, ['title']), own(b, ['title'])], { has_more: true, total: 131 });
    await waitFor(() => expect(screen.getByTestId('p3-different-on-name').textContent).toBe('Different on 2 of the dates shown'));
  });
  it('Prices: a line under the price list', async () => {
    show(P, [own(a, ['passes']), own(b, ['passes']), occ(c)]);
    await screen.findByTestId('p3-prices');
    expect(screen.getByTestId('p3-different-on-price').textContent).toBe('Different on 2 dates');
    cleanup();
    show(P, [occ(a)]);
    await screen.findByTestId('p3-prices');
    expect(screen.queryByTestId('p3-different-on-price')).toBeNull();
  });
});
