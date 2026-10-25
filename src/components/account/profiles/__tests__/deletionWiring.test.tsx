// @vitest-environment jsdom
/**
 * Review S1: the REAL useProfileSides (and ContinueAsScreen on top of it) must carry the
 * account gate's `deletion` into the sides facts, so a deleted login lands on restore
 * before any side. Only the network edge is mocked.
 */
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const world = vi.hoisted(() => ({
  deletion: 'none' as 'none' | 'pending' | 'expired' | 'hang',
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
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
  fetchOrganiserHome: async () => ({ organisers: [] }),
  fetchMyAccessRequests: async () => [],
}));

import { ContinueAsScreen } from '../ContinueAsPage';
import { useProfileSides } from '../useProfileSides';

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

const seen = { here: '' };
const Probe = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    seen.here = pathname;
  }, [pathname]);
  return null;
};

const mountScreen = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/account/continue']}>
        <Routes>
          <Route path="*" element={<><ContinueAsScreen /><Probe /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  world.deletion = 'none';
  seen.here = '';
});
afterEach(cleanup);

describe('useProfileSides carries the deletion landing (real hook)', () => {
  it('pending -> restore', async () => {
    world.deletion = 'pending';
    const { result } = renderHook(() => useProfileSides(), { wrapper });
    await waitFor(() => expect(result.current.facts.deletion).toBe('restore'));
  });
  it('expired -> deleted-card', async () => {
    world.deletion = 'expired';
    const { result } = renderHook(() => useProfileSides(), { wrapper });
    await waitFor(() => expect(result.current.facts.deletion).toBe('deleted-card'));
  });
  it('not deleted -> null', async () => {
    const { result } = renderHook(() => useProfileSides(), { wrapper });
    await waitFor(() => expect(result.current.facts.deletion).toBeNull());
  });
  it('read still pending -> loading', () => {
    world.deletion = 'hang';
    const { result } = renderHook(() => useProfileSides(), { wrapper });
    expect(result.current.facts.deletion).toBe('loading');
  });
});

describe('ContinueAsScreen with the real hook', () => {
  it.each(['pending', 'expired'] as const)('a %s deletion navigates to /account/restore', async (d) => {
    world.deletion = d;
    mountScreen();
    await waitFor(() => expect(seen.here).toMatch(/^\/account\/restore/));
  });
  it('shows continue-as-loading while the deletion read is pending, and does not navigate', async () => {
    world.deletion = 'hang';
    mountScreen();
    expect(await screen.findByTestId('continue-as-loading')).toBeTruthy();
    expect(seen.here).toBe('/account/continue');
  });
});
