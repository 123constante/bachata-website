// @vitest-environment jsdom
/**
 * /festivals lists UPCOMING festivals only: the RPC returns every public festival,
 * so FestivalHub applies the shared filterUpcomingFestivals rule (as the home rail does).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { installJsdomPolyfills } from './jsdomPolyfills';

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
    { id: 'f-y', name: 'Yesterday Fest', city: 'A', date: '2026-10-14', start_time: null, poster_url: null },
    { id: 'f-t', name: 'Today Fest', city: 'B', date: '2026-10-15', start_time: null, poster_url: null },
    { id: 'f-m', name: 'Tomorrow Fest', city: 'C', date: '2026-10-16', start_time: null, poster_url: null },
    { id: 'f-n', name: 'Undated Fest', city: 'D', date: null, start_time: null, poster_url: null },
  ],
}));

import FestivalHub from '@/pages/FestivalHub';

beforeEach(() => {
  installJsdomPolyfills();
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-15T12:00:00Z') });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('festival hub upcoming filter', () => {
  it.each([
    ['Yesterday Fest', false],
    ['Today Fest', true],
    ['Tomorrow Fest', true],
    ['Undated Fest', false],
  ])('%s shown=%s', async (name, shown) => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/festivals']}>
          <FestivalHub />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText('Today Fest');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(screen.queryAllByText(name).length > 0).toBe(shown);
  });
});
