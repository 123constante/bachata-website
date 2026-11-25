// @vitest-environment jsdom
/** W1c: AddPageScreen hands OnboardingView a null gate for a claimant and the real gate otherwise. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useContext } from 'react';

const REAL = { status: 'incomplete', missing: ['first_name'], isAdmin: false };
const h = vi.hoisted(() => ({ state: undefined as { profileGateApplies: boolean } | undefined, seen: [] as unknown[] }));

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn() } }));
vi.mock('@/hooks/useAuth', async () => {
  const { createContext: cc } = await import('react');
  return {
    useAuth: () => ({ user: { id: 'u1', email: 'sam@example.com' }, session: null }),
    ProfileGateContext: cc<unknown>(null),
  };
});
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: false, isPending: false }) }));
vi.mock('../../data/useP3Data', () => ({
  useP3Home: () => ({ isPending: false, isError: false, data: { today: '2026-11-25', organisers: [] }, refetch: vi.fn() }),
}));
vi.mock('../../../claim-link/onboardingStateApi', () => ({ useOnboardingV2State: () => h.state }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => {
  const actual = await vi.importActual<typeof import('@/modules/organiser/shared/selfServeApi')>('@/modules/organiser/shared/selfServeApi');
  return { ...actual, fetchMyAccessRequests: vi.fn().mockResolvedValue([]) };
});
vi.mock('../../../home/onboarding/OnboardingView', async () => {
  const auth = await import('@/hooks/useAuth');
  return {
    OnboardingView: () => {
      h.seen.push(useContext(auth.ProfileGateContext as never));
      return null;
    },
  };
});

import AddPageScreen from '../AddPageScreen';
import { ProfileGateContext } from '@/hooks/useAuth';

afterEach(() => { cleanup(); h.seen = []; });

function mount() {
  const Seed = ({ children }: { children: React.ReactNode }) => (
    <ProfileGateContext.Provider value={REAL as never}>{children}</ProfileGateContext.Provider>
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><Seed><AddPageScreen /></Seed></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AddPageScreen claimant gate (W1c)', () => {
  it('claimant: null gate', () => {
    h.state = { profileGateApplies: false };
    mount();
    expect(h.seen[h.seen.length - 1]).toBeNull();
  });
  it.each([[{ profileGateApplies: true }], [undefined]])('otherwise the real gate (%j)', (s) => {
    h.state = s;
    mount();
    expect(h.seen[h.seen.length - 1]).toEqual(REAL);
  });
});
