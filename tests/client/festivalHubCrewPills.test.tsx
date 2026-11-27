// @vitest-environment jsdom
/**
 * /festivals card keep-list after the crew pills went (owner click 2026-11-27).
 * The three crew pills (home, car, heart) never had numbers -- the counts were never
 * stored -- so flags.festivalCrewPillsRemoved (default ON) drops them. Everything else
 * on the card stays: name, date + city line, Festival chip, "View details & find crew".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { installJsdomPolyfills } from './jsdomPolyfills';

const h = vi.hoisted(() => ({ removed: true }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  return {
    ...real,
    flags: new Proxy(real.flags, {
      get: (t, k) => (k === 'festivalCrewPillsRemoved' ? h.removed : Reflect.get(t, k)),
    }),
  };
});
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: null, isLoading: false, authStatus: 'ready' }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: async () => ({ data: [], error: null }), auth: {} },
}));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/festivalsList', async (orig) => ({
  ...(await orig<typeof import('@/lib/festivalsList')>()),
  fetchPublicFestivalsList: async () => [
    { id: 'f-m', name: 'Tomorrow Fest', city: 'Madrid', date: '2026-10-16', start_time: null, poster_url: null },
  ],
}));

import FestivalHub from '@/pages/FestivalHub';

const mount = async () => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/festivals']}>
        <FestivalHub />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText('Tomorrow Fest');
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
};

beforeEach(() => {
  installJsdomPolyfills();
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-15T12:00:00Z') });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  h.removed = true;
});

describe('festival card crew pills', () => {
  it('flag on (default): no crew pills, the rest of the card stays', async () => {
    await mount();
    expect(screen.queryByTestId('festival-crew-pills')).toBeNull();
    expect(screen.getByText('Tomorrow Fest')).toBeTruthy();
    expect(screen.getAllByText(/Madrid/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Festival').length).toBeGreaterThan(0);
    expect(screen.getByText('View details & find crew')).toBeTruthy();
  });

  it('flag off (rollback): the pills come back', async () => {
    h.removed = false;
    await mount();
    expect(screen.getByTestId('festival-crew-pills')).toBeTruthy();
    expect(screen.getByText('View details & find crew')).toBeTruthy();
  });
});
