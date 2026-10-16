// @vitest-environment jsdom
/** S4: an e-mailed-link sign-up lands in /auth/callback and must record consent there (once, never awaited). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({ rpc: [] as [string, unknown][], hang: false }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (fn: string, args: unknown) => {
      h.rpc.push([fn, args]);
      return h.hang ? new Promise(() => {}) : Promise.resolve({ data: null, error: null });
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'u1', user_metadata: {}, email_confirmed_at: null, last_sign_in_at: null } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: vi.fn(async () => ({ data: null, error: null })) }));
vi.mock('@/lib/myPersona', () => ({ fetchMyPersonaId: vi.fn(async () => null) }));
vi.mock('@/lib/claimMyDancerProfile', () => ({ claimAtSignIn: vi.fn(async () => ({})), shouldArmFinishHop: () => false }));
vi.mock('@/lib/saveMyDancerProfile', () => ({ saveMyDancerProfile: vi.fn() }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: vi.fn() }));
vi.mock('@/lib/featureFlags', () => ({ flags: { organiserSelfServe: true } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

import AuthCallback from '../AuthCallback';

const mount = (mode: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/auth/callback?mode=${mode}`]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<p data-testid="landed">landed</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  h.rpc = [];
  h.hang = false;
  localStorage.clear();
});
afterEach(cleanup);

describe('/auth/callback consent', () => {
  it('mode=signup records terms_privacy once', async () => {
    mount('signup');
    await screen.findByTestId('landed');
    expect(h.rpc.filter((c) => c[0] === 'accept_terms_v1')).toHaveLength(1);
  });
  it('mode=signin records nothing', async () => {
    mount('signin');
    await screen.findByTestId('landed');
    expect(h.rpc.filter((c) => c[0] === 'accept_terms_v1')).toHaveLength(0);
  });
  it('a consent write that never settles does not hold the person back', async () => {
    h.hang = true;
    mount('signup');
    await waitFor(() => expect(screen.getByTestId('landed')).toBeTruthy());
  });
});
