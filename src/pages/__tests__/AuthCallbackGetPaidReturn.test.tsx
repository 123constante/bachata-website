// @vitest-environment jsdom
/**
 * Get paid link, part B, case 3a: a person who ALREADY has a login taps a
 * sign-in link whose returnTo is the Get paid start path
 * (`/account/p3/get-paid?o=<organiserId>`) and must land there -- whether the
 * dancer profile is complete or still an incomplete stub (the fix-up branch).
 * A sign-up with the same returnTo keeps today's behaviour.
 *
 * Everything is MOCKED: nothing here assumes a real account's state.
 *
 * Red-first record (2026-11-07, unfixed origin/main e4689df, literal path):
 * 0 of 6 landing rows failed -- /account is already a task path, so neither
 * branch drops this returnTo and isTaskReturnTo needed no change.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

type Row = { id: string; first_name: string | null; based_city_id: string | null; dance_role: string | null };

const h = vi.hoisted(() => ({ row: null as unknown }));
const getSession = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const rpcLoose = vi.hoisted(() => vi.fn());
const saveMyDancerProfile = vi.hoisted(() => vi.fn());
const resolveCanonicalCity = vi.hoisted(() => vi.fn());
const user = vi.hoisted(() => ({
  id: 'u1',
  user_metadata: {} as Record<string, unknown>,
  // A returning account: confirmed long ago, signing in now.
  email_confirmed_at: '2026-09-01T10:00:00Z',
  last_sign_in_at: '2026-11-07T10:00:00Z',
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.row, error: null }) }) }) }),
    auth: { getSession, onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose }));
vi.mock('@/lib/claimMyDancerProfile', () => ({
  claimAtSignIn: async () => ({ status: 'no_match', profileId: null }),
  shouldArmFinishHop: () => false,
}));
vi.mock('@/lib/claimMyOrganisers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/claimMyOrganisers')>()),
  claimMyOrganisers: async () => [],
  claimOrganisersAtSignIn: async () => [],
}));
vi.mock('@/lib/myPersona', () => ({ fetchMyPersonaId: async () => 'u1' }));
vi.mock('@/lib/accountDeletion', () => ({ signInDeletionTarget: async () => null }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/lib/termsConsent', () => ({ acceptTerms: async () => true }));
vi.mock('@/lib/saveMyDancerProfile', () => ({ saveMyDancerProfile }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity }));
vi.mock('@/lib/featureFlags', () => ({ flags: { organiserSelfServe: true, organiserP3: true } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

import AuthCallback from '../AuthCallback';
import { GET_PAID_START_PATH, getPaidStartPath, isTaskReturnTo } from '@/lib/auth-otp-routing';

// An id that needs encoding, so a missing encodeURIComponent shows.
const ORG_ID = 'org 1/&x';
const GET_PAID = `/account/p3/get-paid?o=${encodeURIComponent(ORG_ID)}`;

const COMPLETE: Row = { id: 'u1', first_name: 'Ana', based_city_id: 'c1', dance_role: 'Follower' };
const STUB: Row = { id: 'u1', first_name: null, based_city_id: null, dance_role: null };
const FULL_META = { first_name: 'Ana', city: 'London', dance_role: 'Follower' };

function Landed() {
  const l = useLocation();
  return <div data-testid="landed">{`${l.pathname}${l.search}`}</div>;
}

const mount = (mode: 'signin' | 'signup') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/auth/callback?mode=${mode}&returnTo=${encodeURIComponent(GET_PAID)}`]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<Landed />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  h.row = COMPLETE;
  user.user_metadata = {};
  getSession.mockReset().mockResolvedValue({ data: { session: { user } } });
  rpc.mockReset().mockResolvedValue({ data: { organisers: [] }, error: null });
  rpcLoose.mockReset().mockResolvedValue({ data: null, error: null });
  resolveCanonicalCity.mockReset().mockResolvedValue({ cityId: 'c1' });
  saveMyDancerProfile.mockReset().mockImplementation(async (p: Record<string, string>) => ({
    first_name: p.first_name ?? 'kept',
    based_city_id: p.based_city_id ?? 'kept',
  }));
});
afterEach(cleanup);

describe('the Get paid start path', () => {
  it('is built as exactly /account/p3/get-paid?o=<encoded id>', () => {
    expect(GET_PAID_START_PATH).toBe('/account/p3/get-paid');
    expect(getPaidStartPath(ORG_ID)).toBe(GET_PAID);
    expect(getPaidStartPath('o1')).toBe('/account/p3/get-paid?o=o1');
  });
  it('is a task returnTo (an organiser sign-up keeps it too)', () => {
    expect(isTaskReturnTo(getPaidStartPath('o1'))).toBe(true);
  });
});

describe.each([
  // [name, mode, profile row, sign-up metadata, does the fix-up save run]
  ['sign-in, dancer profile complete', 'signin', COMPLETE, {}, false],
  ['sign-in, incomplete stub filled from metadata (fix-up branch)', 'signin', STUB, FULL_META, true],
  ['sign-in, incomplete stub too thin to fill (signed-in fallback)', 'signin', STUB, {}, false],
  // Today's behaviour, unchanged: a sign-up honours a task returnTo.
  ['sign-up (dancer), profile complete', 'signup', COMPLETE, {}, false],
  ['sign-up (organiser), profile complete', 'signup', COMPLETE, { user_type: 'organiser' }, false],
  ['sign-up (dancer), incomplete stub filled from metadata', 'signup', STUB, FULL_META, true],
] as [string, 'signin' | 'signup', Row, Record<string, string>, boolean][])('%s', (_name, mode, row, meta, saves) => {
  it('lands on the Get paid start path, query intact', async () => {
    h.row = row;
    user.user_metadata = { ...meta };
    mount(mode);
    expect((await screen.findByTestId('landed')).textContent).toBe(GET_PAID);
    expect(saveMyDancerProfile).toHaveBeenCalledTimes(saves ? 1 : 0);
  });
});
