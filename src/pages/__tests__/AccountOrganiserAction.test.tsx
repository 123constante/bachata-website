// @vitest-environment jsdom
/**
 * A claim, create or request made from the dancer home's "I organise events"
 * section keeps the person on /account, where the onboarding's own confirmation
 * is still on screen, and offers the organiser area by name. The onboarding is
 * stubbed here (its claim flow is OnboardingView's, tested with it); only the
 * callback it fires matters. The real view mounts in AccountDancerHome.matrix.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { makeBackend, DANCER_SHAPES, type Backend } from './helpers/dancerBackend';

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
      <p role="status">You now manage Ritmo</p>
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
    const backend: Backend = makeBackend(DANCER_SHAPES[1].state);
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
    fireEvent.click(await screen.findByRole('button', { name: /I organise events/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Claim it' }));
    expect(await screen.findByTestId('dancer-home-now-organiser')).toBeTruthy();
    expect(screen.queryByTestId('organiser-home')).toBeNull();
    expect(screen.getByText('You now manage Ritmo')).toBeTruthy();
    // One status region for one confirmation: the card above is not another.
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Open the organiser area' }).getAttribute('href')).toBe('/account/o');
  });
});
