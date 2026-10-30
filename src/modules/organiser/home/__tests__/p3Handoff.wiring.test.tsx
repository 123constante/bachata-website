// @vitest-environment jsdom
/**
 * Brief p3-landing-welcome (owner 2026-10-30): R1's organiser home (/account/o) hands a person with no
 * page to P3's Welcome while P3 is live (organiserP3 AND organiserSelfServe). It is what the owner hit
 * via Back to Home on R1's Done: the old dark "Find your page". With a page, P3 off, or the home read
 * not in yet, R1 Home renders exactly as before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const state = vi.hoisted(() => ({
  flags: { organiserP3: true, organiserSelfServe: true },
  data: { organisers: [] as { id: string; name: string }[] } as { organisers: { id: string; name: string }[] } | undefined,
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn() } }));
vi.mock('@/lib/featureFlags', () => ({ flags: state.flags }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ session: null, user: { id: 'u1' } }) }));
vi.mock('../onboarding/OnboardingView', () => ({ OnboardingView: () => <p data-testid="r1-onboarding">R1 Find your page</p> }));
vi.mock('../useHomeData', () => ({
  useHomeData: () => ({
    user: { id: 'u1', email: 'sam@example.com' },
    home: { data: state.data, isPending: !state.data, isPaused: false, isError: false },
    organisers: state.data?.organisers ?? [],
    selected: state.data?.organisers[0] ?? null,
    jobs: [],
    mine: { data: [] },
  }),
}));

import HomePage from '..';

function Where() {
  const l = useLocation();
  return <span data-testid="where">{l.pathname}</span>;
}
const mount = (url = '/account/o') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/account/o" element={<HomePage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

afterEach(cleanup);

describe('R1 Home x P3 flag x pages', () => {
  it.each([
    { name: 'P3 live, 0 pages', p3: true, self: true, pages: 0, url: '/account/o', p3Welcome: true },
    { name: 'P3 live, 0 pages, ?add=1', p3: true, self: true, pages: 0, url: '/account/o?add=1', p3Welcome: true },
    { name: 'P3 off, 0 pages', p3: false, self: true, pages: 0, url: '/account/o', p3Welcome: false },
    { name: 'P3 on without self-serve, 0 pages', p3: true, self: false, pages: 0, url: '/account/o', p3Welcome: false },
  ])('$name', ({ p3, self, pages, url, p3Welcome }) => {
    state.flags.organiserP3 = p3;
    state.flags.organiserSelfServe = self;
    state.data = { organisers: Array.from({ length: pages }, (_, i) => ({ id: `o${i}`, name: `Page ${i}` })) };
    mount(url);
    if (p3Welcome) expect(screen.getByTestId('where').textContent).toBe('/account/p3/start');
    else expect(screen.getByTestId('r1-onboarding')).toBeTruthy();
  });

  it('P3 live, home read not in yet: no hand-off before the count is known', () => {
    state.flags.organiserP3 = true;
    state.flags.organiserSelfServe = true;
    state.data = undefined;
    mount();
    expect(screen.queryByTestId('where')).toBeNull();
  });
});
