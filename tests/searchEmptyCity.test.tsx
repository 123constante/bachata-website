// @vitest-environment jsdom
/**
 * Search no-results per city (Bristol polish): outside London an empty search
 * says "Nothing in <City> yet" with "Tell us" AND "Search all cities", which
 * re-runs the search with p_city_slug NULL. London keeps its own copy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({ city: null as string | null, seo: [] as { title?: string }[] }));
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/featureFlags', () => ({ flags: { searchV5: true, searchV6: true, searchV7: true, teacherDetail: true } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/festivalsList', () => ({ fetchPublicFestivalsList: async () => [], filterUpcomingFestivals: (r: unknown[]) => r }));
vi.mock('@/lib/searchClickTelemetry', () => ({ recordSearchResultClick: vi.fn() }));
vi.mock('@/lib/searchTelemetry', () => ({ recordSearchQuery: vi.fn() }));
vi.mock('@/lib/seo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/seo')>()),
  useSeo: (x: { title?: string }) => { h.seo.push(x); },
}));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: h.city }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => true }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/search/DiscoveryPanel', () => ({ DiscoveryPanel: () => null }));

import SearchResults from '@/pages/SearchResults';

const empty = { query: 'zouk', events: [], organisers: [], venues: [], vendors: [], cities: [], people: [], total_count: 0, did_you_mean: null, unrated_event_count: null };
const renderAt = (url: string) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/search" element={<SearchResults />} /></Routes>
    </MemoryRouter>
  </QueryClientProvider>,
);
const citiesAsked = () => rpc.mock.calls.filter(([fn]) => String(fn).startsWith('search_public')).map(([, a]) => (a as { p_city_slug: string | null }).p_city_slug);

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: empty, error: null });
  h.seo = [];
});
afterEach(cleanup);

describe('search with no results x city', () => {
  it('Bristol: "Nothing in Bristol yet" + Tell us + Search all cities (p_city_slug null)', async () => {
    h.city = 'bristol-gb';
    renderAt('/search?q=zouk');
    const note = await screen.findByTestId('empty-city-note');
    expect(note.textContent).toContain('Nothing in Bristol yet');
    expect(screen.getByRole('button', { name: 'Tell us' })).toBeTruthy();
    expect(citiesAsked()).toEqual(['bristol-gb']);
    fireEvent.click(screen.getByRole('button', { name: 'Search all cities' }));
    await waitFor(() => expect(citiesAsked()).toContain(null));
    // Searching all cities and still finding nothing: the plain no-results copy.
    expect(await screen.findByText(/No results for/)).toBeTruthy();
    expect(screen.queryByTestId('empty-city-note')).toBeNull();
  });

  it.each([{ city: 'london-gb' }, { city: null }])('$city: plain no-results copy, no note', async ({ city }) => {
    h.city = city;
    renderAt('/search?q=zouk');
    expect(await screen.findByText(/No results for/)).toBeTruthy();
    expect(screen.queryByTestId('empty-city-note')).toBeNull();
  });
});
