// @vitest-environment jsdom
/**
 * A claim, create or request made from the dancer home's "I organise events"
 * section keeps the person on /account: a "Done" card takes over from the
 * onboarding (whose search results would still offer what was just claimed),
 * says the confirmation once and offers the organiser area by name. The
 * onboarding is stubbed here (its claim flow is OnboardingView's, tested with
 * it); only the callback it fires matters. The real view mounts in
 * AccountLayoutD.matrix.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { makeBackend, FULL, ROW_SHAPES, type Backend } from './helpers/dancerBackend';

const h = vi.hoisted(() => ({ backend: null as unknown as { client: unknown; state: { organisers: number } } }));
vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return h.backend.client;
  },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => h.backend.client }));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: { id: 'u1', email: 'ana@example.com' }, session: null, isLoading: false, authStatus: 'ready' }),
}));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london-gb' }) }));
vi.mock('@/components/account/OrganiserOnboardingPanel', () => ({
  default: ({ onChanged }: { onChanged: (c: string) => void }) => (
    <div data-testid="org-onboarding">
      <button
        type="button"
        onClick={() => {
          h.backend.state.organisers = 1; // what claim_organiser_v1 does
          onChanged('You now manage Ritmo');
        }}
      >
        Claim it
      </button>
    </div>
  ),
}));

import { AccountScreen } from '../Account';

afterEach(cleanup);

describe('acting from the dancer home', () => {
  it('stays on the page with the confirmation, and offers the organiser area', async () => {
    const backend: Backend = makeBackend({ row: ROW_SHAPES[1].row, organisers: 0, requests: [] });
    h.backend = backend;
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/account']}>
          <Routes>
            <Route path="/account" element={<AccountScreen />} />
            <Route path="/account/o" element={<p data-testid="organiser-home">organiser home</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // Slice A: the "Your areas" row (D112) are on Account home.
    // F2: Account home sits under the layout's Home breadcrumb, so no SiteHomeLink as well.
    expect(await screen.findByTestId('account-areas-row')).toBeTruthy();
    expect(screen.queryByTestId('site-home-link')).toBeNull();
    expect((await screen.findByTestId('account-areas-row')).textContent).toContain('Your areas');
    fireEvent.click(await screen.findByRole('button', { name: /I organise events/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Claim it' }));
    expect(await screen.findByTestId('dancer-home-now-organiser')).toBeTruthy();
    expect(screen.queryByTestId('organiser-home')).toBeNull();
    expect(screen.queryByTestId('org-onboarding')).toBeNull();
    // One status region for one confirmation.
    expect(screen.getAllByRole('status').map((el) => el.textContent)).toEqual([
      'You now manage Ritmo Your organiser area has the details.',
    ]);
    expect(screen.getAllByRole('button', { name: /^Sign out/ })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Open the organiser area' }).getAttribute('href')).toBe('/account/o');
  });

  it('an organiser on their dancer profile with a failed requests read sees no "could not check" line', async () => {
    h.backend = makeBackend({ row: { ...FULL }, organisers: 2, requests: [], requestsFail: true });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/account/dancer']}>
          <Routes>
            <Route path="/account/dancer" element={<AccountScreen view="dancer" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId('dancer-home-organiser-link')).toBeTruthy();
    expect(screen.queryByTestId('dancer-home-organiser-check-failed')).toBeNull();
  });
});
