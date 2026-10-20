// @vitest-environment jsdom
/**
 * Signing in with a recorded claim email claims the organiser page(s) automatically
 * (claim_my_organisers_v1) and lands on /account/o with "You now manage X. Not you? Tell us".
 * Any error, timeout or missing function keeps today's routing and never blocks sign-in.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

const maybeSingle = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const rpcLoose = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
const user = vi.hoisted(() => ({ id: 'u1', user_metadata: {} as Record<string, unknown> }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    auth: { getSession, onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose }));
vi.mock('@/lib/claimMyDancerProfile', () => ({
  claimAtSignIn: async () => ({ status: 'no_match', profileId: null }),
  shouldArmFinishHop: () => false,
}));
vi.mock('@/lib/myPersona', () => ({ fetchMyPersonaId: async () => 'p1' }));
vi.mock('@/lib/accountDeletion', () => ({ signInDeletionTarget: async () => null }));
vi.mock('@/hooks/use-toast', () => ({ toast }));
vi.mock('@/lib/featureFlags', () => ({ flags: { organiserSelfServe: true } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

import AuthCallback from '../AuthCallback';
import { CLAIM_ORGANISERS_TIMEOUT_MS, CLAIM_TOAST_MS, claimedNoticeText, readClaimNotice } from '@/lib/claimMyOrganisers';
import { AUTH_PENDING_RETURN_TO_KEY } from '@/lib/authRouting';

const COMPLETE = { id: 'p1', first_name: 'Ana', based_city_id: 'c1', dance_role: 'follower' };
const INCOMPLETE = { id: 'p1', first_name: null, based_city_id: null, dance_role: null };
const ok = (claimed: unknown) => rpcLoose.mockResolvedValue({ data: { status: 'claimed', claimed }, error: null });
/** The notice kept for organiser Home (review finding 7: Home draws it in flow, no toast over it). */
const homeNotice = () => (readClaimNotice().length ? claimedNoticeText(readClaimNotice()) : null);
const EVENT_RETURN = `/auth/callback?mode=signin&returnTo=${encodeURIComponent('/event/e1')}`;

const CASES: { label: string; arrange: () => void; claimed: string[]; lands: string }[] = [
  { label: 'claimed 0 pages', arrange: () => ok([]), claimed: [], lands: '/account/continue' },
  { label: 'claimed 1 page', arrange: () => ok([{ organiser_id: 'o1', name: 'Ritmo' }]), claimed: ['You now manage Ritmo.'], lands: '/account/o' },
  {
    label: 'claimed 2 pages',
    arrange: () => ok([{ organiser_id: 'o1', name: 'Ritmo' }, { organiser_id: 'o2', name: 'Salsa Club' }]),
    claimed: ['You now manage Ritmo and Salsa Club.'],
    lands: '/account/o',
  },
  { label: 'rpc error', arrange: () => rpcLoose.mockResolvedValue({ data: null, error: { message: 'boom' } }), claimed: [], lands: '/account/continue' },
  { label: 'function missing (PGRST202)', arrange: () => rpcLoose.mockResolvedValue({ data: null, error: { message: 'Could not find the function public.claim_my_organisers_v1' } }), claimed: [], lands: '/account/continue' },
  { label: 'rpc throws', arrange: () => rpcLoose.mockRejectedValue(new Error('network')), claimed: [], lands: '/account/continue' },
  { label: 'malformed answer', arrange: () => ok('nope'), claimed: [], lands: '/account/continue' },
  { label: 'rows without a name are dropped', arrange: () => ok([{ organiser_id: 'o1' }]), claimed: [], lands: '/account/continue' },
];

function Landed() {
  const l = useLocation();
  return <div data-testid="landed">{l.pathname}</div>;
}

const mount = (entry = '/auth/callback?mode=signin') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
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
  rpcLoose.mockReset();
  toast.mockReset();
  maybeSingle.mockReset();
  getSession.mockResolvedValue({ data: { session: { user } } });
});
afterEach(cleanup);

describe('AuthCallback organiser auto-claim', () => {
  for (const profile of [{ name: 'complete profile', row: COMPLETE }, { name: 'incomplete profile', row: INCOMPLETE }]) {
    for (const c of CASES) {
      it(`${profile.name} x ${c.label}`, async () => {
        maybeSingle.mockResolvedValue({ data: profile.row, error: null });
        c.arrange();
        mount();
        const landed = await screen.findByTestId('landed');
        const claimedSomething = c.claimed.length > 0;
        // Today's routing for a complete profile is /account/continue; for an incomplete one, home.
        const expected = claimedSomething ? c.lands : profile.row === COMPLETE ? c.lands : '/';
        await waitFor(() => expect(landed.textContent).toBe(expected));
        // These land on organiser Home, which shows the notice itself: no toast over its rows.
        expect(toast).not.toHaveBeenCalled();
        expect(homeNotice()).toBe(claimedSomething ? c.claimed[0] : null);
      });
    }
  }

  it('off Home, the toast says it there, and its Tell us action is a WhatsApp link naming the page', async () => {
    maybeSingle.mockResolvedValue({ data: COMPLETE, error: null });
    ok([{ organiser_id: 'o1', name: 'Ritmo' }]);
    mount(EVENT_RETURN);
    await screen.findByTestId('landed');
    expect(render(toast.mock.calls[0][0].description).container.textContent).toBe('Not you? Tell us');
    const { container } = render(toast.mock.calls[0][0].description);
    const href = container.querySelector('a')!.getAttribute('href') as string;
    expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(decodeURIComponent(href)).toContain('Ritmo');
  });

  // Review finding 7: the shared toast sits mid-screen with a 20 px invisible close, so it is short;
  // the notice that stays until closed is Home's own line (home/__tests__/ClaimNotice.test.tsx).
  it('the Tell us link is a 44 px tap target and the toast is short, never Infinity', async () => {
    maybeSingle.mockResolvedValue({ data: COMPLETE, error: null });
    ok([{ organiser_id: 'o1', name: 'Ritmo' }]);
    mount(EVENT_RETURN);
    await screen.findByTestId('landed');
    const { container } = render(toast.mock.calls[0][0].description);
    expect(container.querySelector('a')!.className).toMatch(/(^|\s)min-h-\[44px\](\s|$)/);
    expect(toast.mock.calls[0][0].duration).toBe(CLAIM_TOAST_MS);
    expect(homeNotice()).toBe('You now manage Ritmo.');
  });
});

// D37: an explicit returnTo, then a stashed return path, wins over the auto-claim landing; the
// notice still shows wherever they land. /account/o only when there was no return path at all.
const INVITE = `/invite/${'ab'.repeat(32)}`;
describe('AuthCallback organiser auto-claim x return path (D37)', () => {
  const ROUTES: { label: string; entry: string; stash: string | null; lands: string }[] = [
    { label: 'returnTo an invite link', entry: `/auth/callback?mode=signin&returnTo=${encodeURIComponent(INVITE)}`, stash: null, lands: INVITE },
    { label: 'returnTo an event page', entry: `/auth/callback?mode=signin&returnTo=${encodeURIComponent('/event/e1')}`, stash: null, lands: '/event/e1' },
    { label: 'stashed invite link', entry: '/auth/callback?mode=signin', stash: INVITE, lands: INVITE },
    { label: 'no return path', entry: '/auth/callback?mode=signin', stash: null, lands: '/account/o' },
  ];
  for (const profile of [{ name: 'complete profile', row: COMPLETE }, { name: 'incomplete profile', row: INCOMPLETE }]) {
    for (const r of ROUTES) {
      it(`${profile.name} x claimed 1 x ${r.label}`, async () => {
        maybeSingle.mockResolvedValue({ data: profile.row, error: null });
        ok([{ organiser_id: 'o1', name: 'Ritmo' }]);
        if (r.stash) localStorage.setItem(AUTH_PENDING_RETURN_TO_KEY, r.stash);
        mount(r.entry);
        const landed = await screen.findByTestId('landed');
        await waitFor(() => expect(landed.textContent).toBe(r.lands));
        // Off Home a short toast says it there; on Home, Home's own line does. Home keeps it either way.
        if (r.lands === '/account/o') expect(toast).not.toHaveBeenCalled();
        else {
          expect(toast).toHaveBeenCalledTimes(1);
          expect(toast.mock.calls[0][0].title).toBe('You now manage Ritmo.');
        }
        expect(homeNotice()).toBe('You now manage Ritmo.');
        expect(localStorage.getItem(AUTH_PENDING_RETURN_TO_KEY)).toBeNull();
      });
    }
  }
});

describe('AuthCallback organiser auto-claim never blocks sign-in (mutation M2)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it('a claim call that never answers still lands once its timeout passes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    maybeSingle.mockResolvedValue({ data: COMPLETE, error: null });
    rpcLoose.mockReturnValue(new Promise(() => {}));
    mount();
    await vi.advanceTimersByTimeAsync(CLAIM_ORGANISERS_TIMEOUT_MS + 50);
    vi.useRealTimers();
    expect((await screen.findByTestId('landed')).textContent).toBe('/account/continue');
    expect(toast).not.toHaveBeenCalled();
  });
});
