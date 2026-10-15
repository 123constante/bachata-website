// @vitest-environment jsdom
/**
 * TODAY's /auth/callback routing decisions (src/pages/AuthCallback.tsx, untouched
 * by the rebuild), as ONE table: self-claim yes/no, first sign-in (the one-time
 * Finish hop), returnTo (safe / unsafe), a stashed pending return, sign-up vs
 * sign-in link, role (dancer -> "/", organiser-type -> "/account/o", none -> the
 * organiser lookup), the self-serve flag, and the fallback when the profile
 * cannot be filled. Extends the cases in AuthCallbackDanceRole / SignInSelfClaim /
 * AuthCallbackFallback. The expected landing is written out per row, not computed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';

const h = vi.hoisted(() => ({
  row: null as null | Record<string, unknown>,
  persona: 'u1' as string | null,
  claim: 'no_match' as string | null,
  organisers: 0 as number | 'throws',
  selfServe: true,
  saved: null as null | Record<string, unknown>,
  cityResolves: true,
}));
const user = vi.hoisted(() => ({
  id: 'u1',
  user_metadata: {} as Record<string, unknown>,
  email_confirmed_at: null as string | null,
  last_sign_in_at: null as string | null,
}));
const saveMyDancerProfile = vi.hoisted(() => vi.fn());

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.row, error: null }) }) }) }),
    auth: {
      getSession: async () => ({ data: { session: { user } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: async (fn: string) => {
    if (fn === 'claim_my_dancer_profile_v1')
      return h.claim === null ? { data: null, error: { message: 'missing' } } : { data: { ok: true, status: h.claim, profile_id: h.claim === 'linked' ? 'admin-p' : null }, error: null };
    if (fn === '_my_dancer_profile_id_v1') return { data: h.persona, error: null };
    return { data: null, error: null };
  },
}));
vi.mock('@/lib/saveMyDancerProfile', () => ({ saveMyDancerProfile }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => (h.cityResolves ? { cityId: 'c1' } : null) }));
vi.mock('@/modules/organiser-self-serve/selfServeApi', () => ({
  fetchOrganiserHome: async () => {
    if (h.organisers === 'throws') throw new Error('boom');
    return { organisers: Array.from({ length: h.organisers }) };
  },
}));
vi.mock('@/lib/featureFlags', () => ({ flags: { get organiserSelfServe() { return h.selfServe; } } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

import AuthCallback from '@/pages/AuthCallback';
import { POST_LOGIN_PROMPT_KEY } from '@/lib/auth-otp-routing';
import { AUTH_PENDING_RETURN_TO_KEY } from '@/lib/authRouting';

const FIRST = { email_confirmed_at: '2026-10-10T10:00:00Z', last_sign_in_at: '2026-10-10T10:00:02Z' };
const LATER = { email_confirmed_at: '2026-09-01T10:00:00Z', last_sign_in_at: '2026-10-10T10:00:00Z' };
const COMPLETE = { id: 'u1', first_name: 'Ana', based_city_id: 'c1', dance_role: 'Follower', meta_data: null };
const STUB = { id: 'u1', first_name: null, based_city_id: null, dance_role: null, meta_data: null };

type Row = {
  name: string;
  stamps?: typeof FIRST;
  claim?: string | null;
  mode?: 'signin' | 'signup';
  returnTo?: string;
  pending?: string;
  pendingRole?: string;
  meta?: Record<string, unknown>;
  row?: Record<string, unknown> | null;
  persona?: string | null;
  organisers?: number | 'throws';
  selfServe?: boolean;
  cityResolves?: boolean;
  /** Where the person ends up. */
  lands: string;
  /** Is the one-time Finish-profile hop armed. */
  armed: boolean;
  /** Does the stashed pending return survive. */
  pendingKept?: boolean;
};

const ROWS: Row[] = [
  { name: 'dancer, first sign-in, no claim: home, hop armed', meta: { user_type: 'dancer' }, lands: '/', armed: true },
  { name: 'dancer, later sign-in: home, no hop', stamps: LATER, meta: { user_type: 'dancer' }, lands: '/', armed: false },
  { name: 'first sign-in that LINKED an admin profile: hop not armed', claim: 'linked', meta: { user_type: 'dancer' }, lands: '/', armed: false },
  { name: 'claim already_linked, first sign-in: hop armed', claim: 'already_linked', meta: { user_type: 'dancer' }, lands: '/', armed: true },
  { name: 'claim function missing (unavailable): sign-in still lands, hop armed', claim: null, meta: { user_type: 'dancer' }, lands: '/', armed: true },
  { name: 'safe returnTo on a sign-in link: honoured', mode: 'signin', returnTo: '/event/e1', meta: { user_type: 'dancer' }, lands: '/event/e1', armed: true },
  { name: 'safe returnTo on a sign-up link, self-serve ON: honoured', mode: 'signup', returnTo: '/event/e1', meta: { user_type: 'dancer' }, lands: '/event/e1', armed: true },
  { name: 'safe returnTo on a sign-up link, self-serve OFF: ignored, dancer home', mode: 'signup', returnTo: '/event/e1', selfServe: false, meta: { user_type: 'dancer' }, lands: '/', armed: true },
  { name: 'unsafe returnTo (other origin): ignored', returnTo: 'https://evil.example/x', meta: { user_type: 'dancer' }, lands: '/', armed: true },
  { name: 'pending return stashed, no returnTo: used and cleared', pending: '/dancers', meta: { user_type: 'dancer' }, lands: '/dancers', armed: true, pendingKept: false },
  { name: 'returnTo beats the stashed pending return (which stays stashed)', returnTo: '/event/e1', pending: '/dancers', meta: { user_type: 'dancer' }, lands: '/event/e1', armed: true, pendingKept: true },
  { name: 'organiser-type (metadata): /account/o', meta: { user_type: 'organiser' }, lands: '/account/o', armed: true },
  { name: 'organiser-type (pending_profile_role): /account/o', pendingRole: 'organiser', meta: {}, lands: '/account/o', armed: true },
  { name: 'videographer-type, self-serve ON: /account/o', meta: { user_type: 'videographer' }, lands: '/account/o', armed: true },
  { name: 'organiser-type, self-serve OFF: legacy create page', selfServe: false, meta: { user_type: 'organiser' }, lands: '/create-organiser-profile', armed: true },
  { name: 'no role, manages an organiser: /account/o', organisers: 1, meta: {}, lands: '/account/o', armed: true },
  { name: 'no role, manages none: home', organisers: 0, meta: {}, lands: '/', armed: true },
  { name: 'no role, organiser lookup fails: /account decides', organisers: 'throws', meta: {}, lands: '/account', armed: true },
  { name: 'no role, self-serve OFF: home (no lookup)', selfServe: false, organisers: 1, meta: {}, lands: '/', armed: true },
  { name: 'dancer with a returnTo to the account area: honoured as given', returnTo: '/account/attendance', meta: { user_type: 'dancer' }, lands: '/account/attendance', armed: true },
  { name: 'stub filled from metadata, then routed by role', row: STUB, meta: { user_type: 'dancer', first_name: 'Ana', city: 'London', dance_role: 'Follower' }, lands: '/', armed: true },
  { name: 'stub, city cannot be resolved: fallback (returnTo, else home)', row: STUB, cityResolves: false, returnTo: '/event/e1', meta: { user_type: 'dancer', first_name: 'Ana', city: 'Nowhere' }, lands: '/event/e1', armed: true },
  { name: 'stub, metadata too thin to fill it: fallback home', row: STUB, meta: { user_type: 'organiser' }, lands: '/', armed: true },
  { name: 'stub, thin metadata, pending return: fallback uses it and clears it', row: STUB, pending: '/dancers', meta: {}, lands: '/dancers', armed: true, pendingKept: false },
  { name: 'no persona row at all: fallback home', row: null, persona: null, meta: { user_type: 'dancer' }, lands: '/', armed: true },
];

let here = '';
function Probe() {
  const l = useLocation();
  // In an effect, not during render: the react-hooks globals rule refuses a render-time write to a module variable.
  useEffect(() => {
    here = `${l.pathname}${l.search}`;
  });
  return null;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  here = '';
  saveMyDancerProfile.mockReset().mockImplementation(async () => h.saved ?? { first_name: 'Ana', based_city_id: 'c1' });
});
afterEach(cleanup);

describe('AuthCallback: routing decisions', () => {
  it.each(ROWS)('$name', async (r) => {
    Object.assign(user, r.stamps ?? FIRST);
    user.user_metadata = { ...(r.meta ?? {}) };
    h.row = r.row === undefined ? { ...COMPLETE } : r.row;
    h.persona = r.persona === undefined ? 'u1' : r.persona;
    h.claim = r.claim === undefined ? 'no_match' : r.claim;
    h.organisers = r.organisers ?? 0;
    h.selfServe = r.selfServe ?? true;
    h.cityResolves = r.cityResolves ?? true;
    if (r.pending) localStorage.setItem(AUTH_PENDING_RETURN_TO_KEY, r.pending);
    if (r.pendingRole) localStorage.setItem('pending_profile_role', r.pendingRole);
    const qs = new URLSearchParams();
    qs.set('mode', r.mode ?? 'signin');
    if (r.returnTo) qs.set('returnTo', r.returnTo);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[`/auth/callback?${qs.toString()}`]}>
          <Probe />
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="*" element={<p data-testid="landed">landed</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByTestId('landed');
    await waitFor(() => expect(here).toBe(r.lands));
    expect(sessionStorage.getItem(POST_LOGIN_PROMPT_KEY) === '1', 'Finish hop armed').toBe(r.armed);
    if (r.pendingKept !== undefined) expect(localStorage.getItem(AUTH_PENDING_RETURN_TO_KEY) !== null, 'pending return kept').toBe(r.pendingKept);
  });
});
