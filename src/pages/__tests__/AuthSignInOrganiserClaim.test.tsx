// @vitest-environment jsdom
/**
 * Both sign-in paths (emailed link = AuthCallback, typed code = AuthStepper) join the person to the
 * organiser pages claim_my_organisers_v1 returns, store an invite's pre-fill in the ONE prefill
 * store, and NEVER let the claim block or fail the sign-in. The typed-code path calls the claim once.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { installJsdomPolyfills } from '../../../tests/client/jsdomPolyfills';

const m = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  getSession: vi.fn(),
  rpcLoose: vi.fn(),
  toast: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  user: { id: 'u1', user_metadata: {} as Record<string, unknown> },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: m.maybeSingle }) }) }),
    rpc: async () => ({ data: true, error: null }),
    auth: {
      getSession: m.getSession,
      signInWithOtp: m.signInWithOtp,
      verifyOtp: m.verifyOtp,
      updateUser: vi.fn(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: m.rpcLoose }));
vi.mock('@/lib/claimMyDancerProfile', () => ({
  claimAtSignIn: async () => ({ status: 'no_match', profileId: null }),
  shouldArmFinishHop: () => false,
}));
vi.mock('@/lib/myPersona', () => ({ fetchMyPersonaId: async () => 'p1' }));
vi.mock('@/lib/accountDeletion', () => ({ signInDeletionTarget: async () => null }));
vi.mock('@/hooks/use-toast', () => ({ toast: m.toast, useToast: () => ({ toast: m.toast }) }));
vi.mock('@/lib/featureFlags', () => ({ flags: { organiserSelfServe: true } }));
vi.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: vi.fn() }));
vi.mock('@/lib/auth-intent', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth-intent')>()),
  checkAccountExistsByEmail: vi.fn(async () => 'existing'),
}));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => <div /> }));

import AuthCallback from '../AuthCallback';
import { AuthStepper } from '@/components/auth/AuthStepper';
import { AuthFormProvider } from '@/contexts/AuthFormContext';
import { CLAIM_ORGANISERS_TIMEOUT_MS, parseClaimedOrganisers, readClaimNotice } from '@/lib/claimMyOrganisers';
import { readInvitePrefill } from '@/lib/invitePrefill';

const COMPLETE = { id: 'p1', first_name: 'Ana', based_city_id: 'c1', dance_role: 'follower' };
const row = (extra: Record<string, unknown> = {}) => ({ organiser_id: 'o1', name: 'Ritmo', ...extra });
const PREFILL = { first_name: 'Ana', city_id: 'city-1' };

type Claim = { label: string; arrange: () => void; notice: boolean; prefill: boolean };
const answer = (claimed: unknown, status = 'claimed') => () => m.rpcLoose.mockResolvedValue({ data: { status, claimed }, error: null });
const CLAIMS: Claim[] = [
  { label: 'claimed via claim_email', arrange: answer([row({ via: 'claim_email' })]), notice: true, prefill: false },
  { label: 'claimed via invite with prefill', arrange: answer([row({ via: 'invite', prefill: PREFILL })]), notice: true, prefill: true },
  { label: 'claimed via invite, prefill malformed', arrange: answer([row({ via: 'invite', prefill: 'nope' })]), notice: true, prefill: false },
  { label: 'old shape (no via, no prefill)', arrange: answer([row()]), notice: true, prefill: false },
  { label: 'claim_email row ignores a prefill', arrange: answer([row({ via: 'claim_email', prefill: PREFILL })]), notice: true, prefill: false },
  { label: 'nothing_to_claim', arrange: answer([], 'nothing_to_claim'), notice: false, prefill: false },
  { label: 'email_unproven', arrange: answer([], 'email_unproven'), notice: false, prefill: false },
  { label: 'timeout', arrange: () => m.rpcLoose.mockReturnValue(new Promise(() => {})), notice: false, prefill: false },
  { label: 'rpc error', arrange: () => m.rpcLoose.mockResolvedValue({ data: null, error: { message: 'boom' } }), notice: false, prefill: false },
  { label: 'rpc throws', arrange: () => m.rpcLoose.mockRejectedValue(new Error('network')), notice: false, prefill: false },
  { label: 'malformed', arrange: answer('nope'), notice: false, prefill: false },
];

/** The claim toast only (the stepper has its own "Welcome" toast). */
const claimToasts = () => m.toast.mock.calls.filter(([t]) => String(t?.title).startsWith('You now manage'));

function Landed() {
  const l = useLocation();
  return <div data-testid="landed">{l.pathname}</div>;
}

const qc = () => new QueryClient();

const mountLink = (entry = '/auth/callback?mode=signin') =>
  render(
    <QueryClientProvider client={qc()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<Landed />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const typeCode = async (props: { returnTo?: string; onAuthenticated?: () => void } = {}) => {
  render(
    <QueryClientProvider client={qc()}>
      <MemoryRouter initialEntries={['/auth']}>
        <AuthFormProvider>
          <Routes>
            <Route path="/auth" element={<AuthStepper initialIntent="returning" {...props} />} />
            <Route path="*" element={<Landed />} />
          </Routes>
        </AuthFormProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.change(await screen.findByPlaceholderText('you@example.com'), { target: { value: 'ana@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
  fireEvent.click(await screen.findByRole('button', { name: /send code/i }));
  fireEvent.change(await screen.findByPlaceholderText('Enter code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: /verify code/i }));
};

beforeEach(() => {
  vi.useRealTimers();
  installJsdomPolyfills();
  document.elementFromPoint = () => null;
  localStorage.clear();
  sessionStorage.clear();
  for (const f of [m.rpcLoose, m.toast, m.maybeSingle, m.signInWithOtp, m.verifyOtp]) f.mockReset();
  m.maybeSingle.mockResolvedValue({ data: COMPLETE, error: null });
  m.getSession.mockResolvedValue({ data: { session: { user: m.user } } });
  m.signInWithOtp.mockResolvedValue({ error: null });
  m.verifyOtp.mockResolvedValue({ error: null });
});
afterEach(cleanup);

// A timeout case waits out the real 4 s claim timeout, so give those cases room.
const T = CLAIM_ORGANISERS_TIMEOUT_MS + 6000;

describe.each([
  { path: 'emailed link', run: async () => { mountLink(); } },
  { path: 'typed code', run: async () => { await typeCode(); } },
])('$path', ({ path, run }) => {
  for (const c of CLAIMS) {
    it(`x ${c.label}`, async () => {
      c.arrange();
      await run();
      const landed = await screen.findByTestId('landed', {}, { timeout: T });
      // The sign-in is never blocked or failed: it always lands somewhere signed in.
      expect(landed.textContent).toBe(c.notice ? '/account/o' : path === 'typed code' ? '/' : '/account/continue');
      expect(readClaimNotice().length > 0).toBe(c.notice);
      expect(readInvitePrefill('u1')).toEqual(c.prefill ? { firstName: 'Ana', cityId: 'city-1' } : null);
      // On Home the notice is Home's own line: no toast over its rows.
      expect(claimToasts()).toHaveLength(0);
      if (path === 'typed code') expect(m.rpcLoose).toHaveBeenCalledTimes(1);
    }, T + 2000);
  }
});

describe('typed code x return path', () => {
  it('an explicit returnTo wins over the claim landing, the notice is stashed and a toast says it', async () => {
    answer([row({ via: 'claim_email' })])();
    await typeCode({ returnTo: '/event/e1' });
    expect((await screen.findByTestId('landed')).textContent).toBe('/event/e1');
    expect(readClaimNotice()).toHaveLength(1);
    await waitFor(() => expect(claimToasts()).toHaveLength(1));
  });

  it('a stashed return path wins over the claim landing', async () => {
    localStorage.setItem('auth_pending_return_to', '/event/e2');
    answer([row({ via: 'claim_email' })])();
    await typeCode();
    expect((await screen.findByTestId('landed')).textContent).toBe('/event/e2');
    expect(localStorage.getItem('auth_pending_return_to')).toBeNull();
    expect(readClaimNotice()).toHaveLength(1);
  });

  it('an in-page host keeps going in-page after the claim ran: no navigation, notice stashed', async () => {
    answer([row({ via: 'invite', prefill: PREFILL })])();
    const onAuthenticated = vi.fn();
    await typeCode({ onAuthenticated });
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('landed')).toBeNull();
    expect(readClaimNotice()).toHaveLength(1);
    expect(readInvitePrefill('u1')).toEqual({ firstName: 'Ana', cityId: 'city-1' });
  });
});

describe('parseClaimedOrganisers: via and prefill', () => {
  it('reads via and prefill; unknown via is omitted; a shape problem makes prefill null', () => {
    const got = parseClaimedOrganisers({
      claimed: [
        row({ via: 'invite', prefill: PREFILL }),
        row({ organiser_id: 'o2', via: 'sorcery' }),
        row({ organiser_id: 'o3', via: 'invite', prefill: { first_name: 5 } }),
        row({ organiser_id: 'o4', via: 'invite', prefill: [] }),
        { organiser_id: 'o5' },
        { name: 'x' },
      ],
    });
    expect(got).toEqual([
      { organiserId: 'o1', name: 'Ritmo', via: 'invite', prefill: { firstName: 'Ana', cityId: 'city-1' } },
      { organiserId: 'o2', name: 'Ritmo' },
      { organiserId: 'o3', name: 'Ritmo', via: 'invite', prefill: null },
      { organiserId: 'o4', name: 'Ritmo', via: 'invite', prefill: null },
    ]);
  });
});
