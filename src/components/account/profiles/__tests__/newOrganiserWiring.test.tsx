// @vitest-environment jsdom
/**
 * F4: /account/continue with the REAL useProfileSides. A brand-new organiser (organiser
 * sign-up metadata, no organiser membership, no open request, dancer profile done) lands
 * on P3's Welcome when the route says P3 is live, and on the R1 organiser home when not.
 * Only the network edge is mocked.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const world = vi.hoisted(() => ({
  deletion: 'none' as 'none' | 'pending' | 'expired' | 'hang',
  userType: 'organiser',
  organisers: [] as Array<{ id: string; name: string; avatar_url: null }>,
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', user_metadata: { user_type: world.userType } } }) }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: async (fn: string) => {
    if (fn === 'my_account_deletion_status_v1') {
      if (world.deletion === 'hang') return new Promise(() => undefined);
      return { data: { state: world.deletion, requested_at: null, restore_until: null }, error: null };
    }
    if (fn === '_my_dancer_profile_id_v1') return { data: 'p1', error: null };
    if (fn === 'profile_complete_v1') return { data: true, error: null };
    return { data: null, error: { message: `unexpected ${fn}` } };
  },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({
  getSupabase: async () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { first_name: 'Ana', based_city_id: null, dance_role: null, avatar_url: null }, error: null }) }) }) }),
  }),
}));
vi.mock('@/modules/dancer-app/gate/useDancerArea', () => ({ useDancerArea: () => ({ status: 'ready', allowed: true }) }));
vi.mock('@/modules/dancer-app/api/rpc', () => ({ fetchMyDancerEdit: async () => ({ first_name: 'Ana', avatar_url: null }) }));
vi.mock('@/modules/admin-organisers/adminApi', () => ({ adminCheckQueryKey: (id: unknown) => ['admin', id], fetchIsAdmin: async () => false }));
vi.mock('@/modules/organiser/shared/selfServeApi', () => ({
  organiserHomeQueryKey: (id: unknown) => ['org-home', id],
  myAccessRequestsQueryKey: (id: unknown) => ['org-req', id],
  fetchOrganiserHome: async () => ({ organisers: world.organisers }),
  fetchMyAccessRequests: async () => [],
}));

import { ContinueAsScreen } from '../ContinueAsPage';

const seen = { here: '' };
const Probe = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    seen.here = pathname;
  }, [pathname]);
  return null;
};

const mount = (p3Live?: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/account/continue']}>
        <Routes>
          <Route path="*" element={<><ContinueAsScreen p3Live={p3Live} /><Probe /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  world.userType = 'organiser';
  world.organisers = [];
  seen.here = '';
});
afterEach(cleanup);

describe('/account/continue: a brand-new organiser x P3 live', () => {
  it.each([
    [true, '/account/p3/start'],
    [false, '/account/o'],
    [undefined, '/account/o'],
  ])('p3Live=%s -> %s', async (p3Live, to) => {
    mount(p3Live);
    await waitFor(() => expect(seen.here).toBe(to));
  });

  it('an existing organiser (page + dancer) still gets "Continue as..." with P3 live', async () => {
    world.organisers = [{ id: 'o1', name: 'A', avatar_url: null }];
    mount(true);
    expect(await screen.findByTestId('continue-as')).toBeTruthy();
    expect(seen.here).toBe('/account/continue');
  });

  it('a dancer keeps the dancer app with P3 live', async () => {
    world.userType = 'dancer';
    mount(true);
    await waitFor(() => expect(seen.here).toBe('/app/home'));
  });
});
