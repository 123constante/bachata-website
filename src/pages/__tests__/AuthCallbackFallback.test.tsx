// @vitest-environment jsdom
/**
 * A sign-in that succeeds but cannot fill in the person's profile used to land
 * on /onboarding?authFallback=<reason>. /onboarding was retired on 2026-09-12,
 * so a signed-in person saw "Page not found" -- the owner hit it signing in as
 * an organiser account with no dancer profile. Every fallback reason, crossed
 * with every shape of returnTo, must end on a route that exists. The Supabase
 * client and the profile helpers are mocked; nothing here touches a network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { isRoutable } from '@/lib/__tests__/routeTable';

const maybeSingle = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const saveMyDancerProfile = vi.hoisted(() => vi.fn());
const resolveCanonicalCity = vi.hoisted(() => vi.fn());
const user = vi.hoisted(() => ({ id: 'u1', user_metadata: {} as Record<string, unknown> }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    auth: {
      getSession,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));
vi.mock('@/lib/saveMyDancerProfile', () => ({ saveMyDancerProfile }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity }));
vi.mock('@/modules/organiser-self-serve/selfServeApi', () => ({ fetchOrganiserHome: vi.fn() }));
vi.mock('@/lib/featureFlags', () => ({ flags: { organiserSelfServe: true } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

import AuthCallback from '../AuthCallback';

const STUB = { id: 'u1', first_name: null, based_city_id: null, meta_data: null };
const FULL_META = { first_name: 'Ana', city: 'London' };

// One row per path through AuthCallback that ends in the fallback, named by the
// reason the code used to put in ?authFallback=.
const REASONS: { reason: string; arrange: () => void }[] = [
  {
    reason: 'profile (no profile row)',
    arrange: () => maybeSingle.mockResolvedValue({ data: null, error: null }),
  },
  {
    reason: 'profile (save threw)',
    arrange: () => {
      maybeSingle.mockResolvedValue({ data: STUB, error: null });
      user.user_metadata = FULL_META;
      resolveCanonicalCity.mockResolvedValue({ cityId: 'c1' });
      saveMyDancerProfile.mockRejectedValue(new Error('boom'));
    },
  },
  {
    reason: 'metadata (sign-up metadata too thin)',
    arrange: () => maybeSingle.mockResolvedValue({ data: STUB, error: null }),
  },
  {
    reason: 'metadata (city did not resolve)',
    arrange: () => {
      maybeSingle.mockResolvedValue({ data: STUB, error: null });
      user.user_metadata = FULL_META;
      resolveCanonicalCity.mockResolvedValue(null);
    },
  },
  {
    reason: 'incomplete (save did not stick)',
    arrange: () => {
      maybeSingle.mockResolvedValue({ data: STUB, error: null });
      user.user_metadata = FULL_META;
      resolveCanonicalCity.mockResolvedValue({ cityId: 'c1' });
      saveMyDancerProfile.mockResolvedValue({ first_name: null, based_city_id: null });
    },
  },
  {
    reason: 'lookup (profile read failed)',
    arrange: () => maybeSingle.mockResolvedValue({ data: null, error: { message: 'network' } }),
  },
];
// 'timeout' is in the old reason union but no call site ever passed it: the
// 15 s timer goes to /auth?callbackError=timeout, which is routable.

const RETURN_TOS: { label: string; returnTo: string | null; pending?: string; expected: string }[] = [
  { label: 'returnTo /account', returnTo: '/account', expected: '/account' },
  { label: 'returnTo /account/team/o1', returnTo: '/account/team/o1', expected: '/account/team/o1' },
  { label: 'no returnTo', returnTo: null, expected: '/' },
  { label: 'no returnTo, stashed /account', returnTo: null, pending: '/account', expected: '/account' },
  { label: 'protocol-relative //evil.com', returnTo: '//evil.com', expected: '/' },
  { label: 'javascript: URL', returnTo: 'javascript:alert(1)', expected: '/' },
  { label: 'backslash /\\evil.com', returnTo: '/\\evil.com', expected: '/' },
  { label: 'absolute https://evil.com', returnTo: 'https://evil.com', expected: '/' },
];

function Landed() {
  const location = useLocation();
  return <div data-testid="landed">{`${location.pathname}${location.search}`}</div>;
}

function mount(returnTo: string | null) {
  const query = returnTo === null ? '' : `?mode=signin&returnTo=${encodeURIComponent(returnTo)}`;
  return render(
    <MemoryRouter initialEntries={[`/auth/callback${query}`]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Landed />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  maybeSingle.mockReset();
  saveMyDancerProfile.mockReset();
  resolveCanonicalCity.mockReset();
  user.user_metadata = {};
  getSession.mockResolvedValue({ data: { session: { user } } });
});
afterEach(cleanup);

describe('AuthCallback fallback after a successful sign-in', () => {
  for (const { reason, arrange } of REASONS) {
    for (const { label, returnTo, pending, expected } of RETURN_TOS) {
      it(`${reason} x ${label} -> ${expected}`, async () => {
        arrange();
        if (pending) localStorage.setItem('auth_pending_return_to', pending);
        mount(returnTo);
        const landed = await screen.findByTestId('landed');
        await waitFor(() => expect(landed.textContent).toBe(expected));
        expect(landed.textContent).not.toMatch(/^\/onboarding/);
        expect(isRoutable(landed.textContent ?? '')).toBe(true);
        // The stash is consumed, so it cannot hijack a later sign-in.
        expect(localStorage.getItem('auth_pending_return_to')).toBeNull();
      });
    }
  }
});
