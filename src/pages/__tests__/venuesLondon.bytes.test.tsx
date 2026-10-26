// @vitest-environment jsdom
/**
 * Bristol polish guard: the London venues page is BYTE-IDENTICAL to before the
 * city cut. The golden HTML was rendered from origin/main 899f85e (before this
 * change) with the same fixture and clock; regenerate only on purpose with
 * UPDATE_VENUES_GOLDEN=1 and say why in the PR.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { installJsdomPolyfills } from '../../../tests/client/jsdomPolyfills';

const h = vi.hoisted(() => ({ city: 'london-gb' as string | null }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: h.city }) }));
vi.mock('@/lib/seo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/seo')>()),
  useSeo: () => {},
}));
const v = (id: string, city: string, over: Record<string, unknown> = {}) => ({
  id, slug: id, name: `Venue ${id}`, neighbourhood: null, cover_image: null, city_name: city, capacity: 120, floor_type: 'wood',
  description: null, bar_available: true, cloakroom_available: false, has_parking: false, facilities_new: [],
  upcoming_event_count: 2, next_event_iso: '2026-10-27T20:00:00', next_event_name: 'Social', nearest_station: 'Bank',
  nearest_station_minutes: 4, nearest_station_mode: 'metro', day_pattern: ['Tuesday'], address: '1 Road', postcode: 'EC2R 8AH', ...over,
});
const FIXTURE = [
  v('a', 'London'),
  v('b', 'London', { postcode: 'N1 9GU', nearest_station: null, address: null, day_pattern: ['Friday'], next_event_iso: null }),
  v('c', 'Budapest', { postcode: null, nearest_station: null, upcoming_event_count: 0, next_event_iso: null }),
];
vi.mock('@/services/venuePublicService', () => ({ fetchPublicVenuesList: async () => FIXTURE }));

import Venues from '@/pages/Venues';

const GOLDEN = join(__dirname, '__fixtures__', 'venues-london.golden.html');

async function renderAt(at: string, pattern: string) {
  const { container } = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>
        <Routes><Route path={pattern} element={<Venues />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  return container.innerHTML;
}

beforeEach(() => {
  installJsdomPolyfills();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-10-26T12:00:00Z'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('London venues page is byte-identical', () => {
  it.each([
    { at: '/venues', pattern: '/venues', city: 'london-gb' },
    { at: '/venues', pattern: '/venues', city: null },
    { at: '/city/london-gb/venues', pattern: '/city/:slug/venues', city: 'london-gb' },
  ])('$at (stored city $city)', async ({ at, pattern, city }) => {
    h.city = city;
    const html = await renderAt(at, pattern);
    if (process.env.UPDATE_VENUES_GOLDEN === '1' && at === '/venues' && city === 'london-gb') writeFileSync(GOLDEN, html);
    expect(html).toBe(readFileSync(GOLDEN, 'utf8'));
    // The off-city venue (Budapest) is still listed for London, under Elsewhere.
    expect(html).toContain('Elsewhere');
  });
});
