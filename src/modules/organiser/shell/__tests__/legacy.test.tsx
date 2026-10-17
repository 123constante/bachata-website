// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, RouterProvider, Routes, createMemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: () => new Promise(() => {}), from: () => ({}) } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, session: null }) }));
vi.mock('@/lib/accountGate', () => ({ useAccountGate: () => ({ status: 'complete', dancerProfileId: 'p1', deletion: null }) }));

import OrganiserRoutes from '../OrganiserRoutes';
import { LegacyAccountRedirect } from '../LegacyRedirect';
import { legacyAccountPath, moduleLegacyPath } from '../legacyPaths';

vi.setConfig({ testTimeout: 20_000 });

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
});
afterAll(() => {
  vi.useRealTimers();
});
afterEach(cleanup);

function Where() {
  const { pathname, search, hash } = useLocation();
  return <p data-testid="where">{`${pathname}${search}${hash}`}</p>;
}

// The same four routes AnimatedRoutes mounts behind flags.organiserSelfServe.
function atAccount(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/account" element={<LegacyAccountRedirect target="home" />} />
        <Route path="/account/new" element={<LegacyAccountRedirect target="new" />} />
        <Route path="/account/series/:seriesId" element={<LegacyAccountRedirect target="series" />} />
        <Route path="/account/team/:organiserId?" element={<LegacyAccountRedirect target="team" />} />
        <Route path="/account/o/*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('old /account URLs land on the new paths (legacyAccountPath)', () => {
  it.each([
    ['/account', '/account/o'],
    ['/account?claim=1#top', '/account/o?claim=1#top'],
    ['/account/new', '/account/o/new/what'],
    ['/account/new?organiser=org-1', '/account/o/new/what?organiser=org-1'],
    ['/account/series/ser-1', '/account/o/events/ser-1'],
    ['/account/series/ser-1?x=2#dates', '/account/o/events/ser-1?x=2#dates'],
    ['/account/team', '/account/o/team'],
    ['/account/team/org-1', '/account/o/team?o=org-1'],
    ['/account/team/org-1?o=org-2', '/account/o/team?o=org-2'],
  ])('%s -> %s', async (from, to) => {
    atAccount(from);
    expect((await screen.findByTestId('where')).textContent).toBe(to);
  });

  it('replaces the history entry, so Back never bounces into the redirect', async () => {
    const router = createMemoryRouter(
      [
        { path: '/account', element: <LegacyAccountRedirect target="home" /> },
        { path: '/account/o/*', element: <Where /> },
      ],
      { initialEntries: ['/account'] },
    );
    render(<RouterProvider router={router} />);
    expect((await screen.findByTestId('where')).textContent).toBe('/account/o');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('encodes the series id', () => {
    expect(legacyAccountPath('series', { seriesId: 'a b' }, '', '')).toBe('/account/o/events/a%20b');
  });
});

describe("main's own organiser URLs land on their R1 paths (moduleLegacyPath)", () => {
  it.each([
    ['/account/o/events/new', '/account/o/new/what'],
    ['/account/o/events/new?organiser=org-1#x', '/account/o/new/what?organiser=org-1#x'],
    ['/account/o/events/s1/dates/o1', '/account/o/change/s1/o1'],
    ['/account/o/events/s1/dates/o1?from=home', '/account/o/change/s1/o1?from=home'],
    ['/account/o/profile', '/account/o/page'],
    ['/account/o/profile?o=org-2', '/account/o/page?o=org-2'],
  ])('%s -> %s (replace)', async (from, to) => {
    const router = createMemoryRouter([{ path: '/account/o/*', element: <OrganiserRoutes /> }], { initialEntries: [from] });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await vi.waitFor(() => expect(`${router.state.location.pathname}${router.state.location.search}${router.state.location.hash}`).toBe(to), { timeout: 10_000 });
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('encodes the ids', () => {
    expect(moduleLegacyPath('date', { seriesId: 'a b', occurrenceId: 'c/d' }, '', '')).toBe('/account/o/change/a%20b/c%2Fd');
    expect(moduleLegacyPath('newEvent', {}, '?a=1', '')).toBe('/account/o/new/what?a=1');
    expect(moduleLegacyPath('profile', {}, '', '#h')).toBe('/account/o/page#h');
  });
});
