// @vitest-environment jsdom
/**
 * Magic-link return for a ticket buyer. /auth carries returnTo=/account/my-tickets into the
 * emailRedirectTo of signInWithOtp; /auth/callback then lands on /account/my-tickets.
 * Everything is MOCKED. This pins what the code does today; the gap (nothing in the
 * ticketing flow SETS that returnTo yet) is in the PR body.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { installJsdomPolyfills } from './jsdomPolyfills';

const signInWithOtp = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const rpcLoose = vi.hoisted(() => vi.fn());
const flagState = vi.hoisted(() => ({ organiserSelfServe: false }));
const row = vi.hoisted(() => ({ v: null as unknown }));
const user = vi.hoisted(() => ({
  id: 'u1',
  user_metadata: {} as Record<string, unknown>,
  email_confirmed_at: '2026-09-01T10:00:00Z',
  last_sign_in_at: '2026-11-14T10:00:00Z',
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row.v, error: null }) }) }) }),
    auth: { signInWithOtp, getSession, onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose }));
vi.mock('@/lib/featureFlags', () => ({ flags: { get organiserSelfServe() { return flagState.organiserSelfServe; }, organiserP3: false } }));
vi.mock('@/lib/auth-intent', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth-intent')>()),
  checkAccountExistsByEmail: vi.fn(async () => 'existing'),
}));
vi.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: vi.fn() }));
vi.mock('@/lib/claimMyDancerProfile', () => ({
  claimAtSignIn: async () => ({ status: 'no_match', profileId: null }),
  shouldArmFinishHop: () => false,
}));
vi.mock('@/lib/claimMyOrganisers', async (orig) => ({
  ...(await orig<typeof import('@/lib/claimMyOrganisers')>()),
  claimMyOrganisers: async () => [],
  claimOrganisersAtSignIn: async () => [],
}));
vi.mock('@/lib/myPersona', () => ({ fetchMyPersonaId: async () => 'u1' }));
vi.mock('@/lib/accountDeletion', () => ({ signInDeletionTarget: async () => null }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => <div /> }));

import Auth from '@/pages/Auth';
import AuthCallback from '@/pages/AuthCallback';
import { MY_TICKETS_PATH } from '@/modules/tickets/myTicketsModel';
import { isTaskReturnTo } from '@/lib/auth-otp-routing';
import { sanitizeReturnTo } from '@/lib/authRouting';

const COMPLETE = { id: 'u1', first_name: 'Ana', based_city_id: 'c1', dance_role: 'Follower' };
const STUB = { id: 'u1', first_name: null, based_city_id: null, dance_role: null };

function Landed() {
  const l = useLocation();
  return <div data-testid="landed">{`${l.pathname}${l.search}`}</div>;
}

const sendLink = async (authUrl: string) => {
  const u = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[authUrl]}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </MemoryRouter>,
  );
  await u.type(await screen.findByLabelText('Email'), 'buyer@example.com');
  await u.click(screen.getByRole('button', { name: /email me a sign-in link/i }));
  await screen.findByText('Check your email');
  return new URL(signInWithOtp.mock.calls[0][0].options.emailRedirectTo as string);
};

const land = (cbUrl: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[cbUrl]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<Landed />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  installJsdomPolyfills();
  document.elementFromPoint = () => null;
  localStorage.clear();
  sessionStorage.clear();
  flagState.organiserSelfServe = false;
  row.v = COMPLETE;
  user.user_metadata = {};
  signInWithOtp.mockReset().mockResolvedValue({ error: null });
  getSession.mockReset().mockResolvedValue({ data: { session: { user } } });
  rpc.mockReset().mockResolvedValue({ data: { organisers: [] }, error: null });
  rpcLoose.mockReset().mockResolvedValue({ data: null, error: null });
});
afterEach(cleanup);

describe('the return target for a my-tickets sign-in', () => {
  it('is a plain, kept path: sanitised as-is and a task return (so a sign-up keeps it too)', () => {
    expect(MY_TICKETS_PATH).toBe('/account/my-tickets');
    expect(sanitizeReturnTo(MY_TICKETS_PATH)).toBe(MY_TICKETS_PATH);
    expect(isTaskReturnTo(MY_TICKETS_PATH)).toBe(true);
  });

  it('a protocol-relative or absolute returnTo is dropped, never followed', () => {
    expect(sanitizeReturnTo('//evil.example/account/my-tickets')).toBeNull();
    expect(sanitizeReturnTo('https://evil.example/account/my-tickets')).toBeNull();
  });
});

describe('/auth builds the magic-link redirect', () => {
  it('sign-in with returnTo=/account/my-tickets: emailRedirectTo is /auth/callback?mode=signin&returnTo=<encoded path>', async () => {
    const url = await sendLink(`/auth?mode=signin&returnTo=${encodeURIComponent(MY_TICKETS_PATH)}`);
    expect(url.pathname).toBe('/auth/callback');
    expect(url.searchParams.get('mode')).toBe('signin');
    expect(url.searchParams.get('returnTo')).toBe(MY_TICKETS_PATH);
    expect(url.search).toContain('returnTo=%2Faccount%2Fmy-tickets');
    expect(url.origin).toBe(window.location.origin);
    expect(signInWithOtp.mock.calls[0][0].options.shouldCreateUser).toBe(false);
  });

  it('GAP (pins today): with no returnTo on /auth the redirect carries none, so nothing returns the buyer to my-tickets', async () => {
    const url = await sendLink('/auth?mode=signin');
    expect(url.searchParams.has('returnTo')).toBe(false);
  });

  it('an off-site returnTo is not put in the redirect', async () => {
    const url = await sendLink(`/auth?mode=signin&returnTo=${encodeURIComponent('https://evil.example/x')}`);
    expect(url.searchParams.has('returnTo')).toBe(false);
  });
});

describe('/auth/callback lands on /account/my-tickets', () => {
  const cb = (mode: string) => `/auth/callback?mode=${mode}&returnTo=${encodeURIComponent(MY_TICKETS_PATH)}`;

  it.each([
    ['sign-in, profile complete', 'signin', COMPLETE],
    ['sign-in, incomplete stub (a guest buyer\u2019s thin account)', 'signin', STUB],
  ] as const)('%s', async (_name, mode, r) => {
    row.v = r;
    land(cb(mode));
    expect((await screen.findByTestId('landed')).textContent).toBe(MY_TICKETS_PATH);
  });

  it('sign-up with organiserSelfServe ON also lands there', async () => {
    flagState.organiserSelfServe = true;
    land(cb('signup'));
    expect((await screen.findByTestId('landed')).textContent).toBe(MY_TICKETS_PATH);
  });

  it('a sign-up with organiserSelfServe OFF now keeps the my-tickets returnTo (the gap is closed)', async () => {
    land(cb('signup'));
    expect((await screen.findByTestId('landed')).textContent).toBe(MY_TICKETS_PATH);
  });

  it('without a returnTo it does NOT land on my-tickets (the gap)', async () => {
    land('/auth/callback?mode=signin');
    expect((await screen.findByTestId('landed')).textContent).not.toBe(MY_TICKETS_PATH);
  });

  it('an off-site returnTo is ignored, not followed', async () => {
    land(`/auth/callback?mode=signin&returnTo=${encodeURIComponent('https://evil.example/x')}`);
    const t = (await screen.findByTestId('landed')).textContent ?? '';
    expect(t.startsWith('/')).toBe(true);
    expect(t).not.toContain('evil.example');
  });
});
