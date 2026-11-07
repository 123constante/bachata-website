// @vitest-environment jsdom
/**
 * JoinGetPaidNext -- organiser Get paid link, part B, case 3b: a person with NO login gets the admin invite link
 * (/invite/<token>, the JoinPage) with ONE optional param, `next=get-paid`. When present AND the redeemed seat is
 * owner or manager AND the redeem names an organiser, Done goes to `/account/p3/get-paid?o=<id>` and reads
 * "Set up payments". Any other `next`, a contributor seat or no id: today's Done (home, today's words).
 * `next` survives the in-page code step (in the address and in the emailed link's returnTo), the already-signed-in
 * Join tap and the already_member answer. Everything is MOCKED (no real account state assumed).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ProfileCompletion } from '@/lib/profileCompletion';

const TOKEN = 'cd'.repeat(32);
const ORG = 'Sensual Vibes';
const ME = { id: 'u1', email: 'ana@example.com' };

const h = vi.hoisted(() => ({
  auth: { user: null as null | { id: string; email: string }, authStatus: 'ready' as 'ready' | 'resolving', signOut: vi.fn(async () => 'signed-out' as string) },
  completion: { status: 'signed_out', missing: [], profileId: null } as ProfileCompletion,
  rpc: vi.fn(),
  otp: vi.fn(),
  verify: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => h.auth }));
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: (opts: { paused?: boolean } = {}) => ({ ...h.completion, status: opts.paused ? 'loading' : h.completion.status, refetch: async () => h.completion }),
  profileCompletionQueryKey: (id: string | null) => ['profile-completion', id],
}));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  return { ...real, flags: { ...real.flags, organiserSelfServe: true } };
});
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/claimMyDancerProfile', () => ({ claimAtSignIn: async () => ({ status: 'not_applicable', profileId: null }) }));
vi.mock('@/lib/reportClientErrorLazy', () => ({ reportClientErrorLazy: () => undefined }));
vi.mock('@/modules/organiser/shared/selfServeApi', () => ({
  ORGANISER_HOME_KEY: ['organiser-home'],
  organiserHomeQueryKey: (id: string | undefined) => ['organiser-home', id ?? null],
  fetchOrganiserHome: async () => ({ organisers: [] }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    auth: { signInWithOtp: (...a: unknown[]) => h.otp(...a), verifyOtp: (...a: unknown[]) => h.verify(...a), getSession: async () => ({ data: { session: null } }) },
  },
}));

import InviteRedeemPage from '../../InviteRedeemPage';
import { JOIN_COPY } from '../joinCopy';
import { JOIN_ROLES, codeStepSearch, searchAfterCodeStep } from '../joinModel';
import { getPaidStartPath } from '@/lib/auth-otp-routing';

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const COMPLETE: ProfileCompletion = { status: 'complete', missing: [], profileId: 'p1' };
let preview: Record<string, unknown>;
let redeem: Record<string, unknown>;

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname}{l.search}</p>; }
const mount = (url: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Where />
        <Routes>
          <Route path="/invite/:token" element={<InviteRedeemPage />} />
          <Route path="/invite" element={<InviteRedeemPage />} />
          <Route path="*" element={<p data-testid="elsewhere">elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
const stepIs = (step: string) => waitFor(() => expect(screen.getByTestId('join-step').getAttribute('data-step')).toBe(step), { timeout: 4000 });
const where = () => screen.getByTestId('where').textContent;

beforeEach(() => {
  h.auth.user = null;
  h.auth.authStatus = 'ready';
  h.completion = { status: 'signed_out', missing: [], profileId: null };
  preview = { status: 'open', organiser_name: ORG, inviter_first_name: 'Ricky', email_hint: null };
  redeem = { ok: true, status: 'redeemed', organiser_id: 'o1', member_role: 'owner' };
  h.rpc.mockReset().mockImplementation((fn: string) => {
    if (fn === 'organiser_invite_preview_v1') return ok(preview);
    if (fn === 'redeem_organiser_invite_v1') return ok(redeem);
    if (fn === 'bind_organiser_invite_email_v1') return ok({ status: 'bound' });
    if (fn === 'organiser_onboarding_status_v1') return ok(null);
    if (fn === 'set_my_role_intent_v1') return ok({ ok: true, roles: [...JOIN_ROLES] });
    return Promise.reject(new Error(`unexpected rpc ${fn}`));
  });
  h.otp.mockReset().mockResolvedValue({ data: {}, error: null });
  h.verify.mockReset().mockImplementation(async () => {
    h.auth.user = ME;
    h.completion = COMPLETE;
    return { data: { user: { ...ME, email_confirmed_at: '2026-11-07T10:00:00Z', last_sign_in_at: null } }, error: null };
  });
  localStorage.clear();
  window.history.replaceState(null, '', `/invite/${TOKEN}`);
});
afterEach(cleanup);

describe('the code step keeps other params (pure)', () => {
  it.each([
    ['', `?step=code&email=ana%40example.com`],
    ['?next=get-paid', `?step=code&email=ana%40example.com&next=get-paid`],
    ['?next=other', `?step=code&email=ana%40example.com&next=other`],
    // a resend from inside the step replaces its own params, never doubles them
    ['?step=code&email=old%40x.com&next=get-paid', `?step=code&email=ana%40example.com&next=get-paid`],
  ])('from %j', (from, to) => {
    expect(codeStepSearch(' Ana@Example.com ', from)).toBe(to);
  });
  it.each([
    ['?step=code&email=a%40b.co&next=get-paid', '?next=get-paid'],
    ['?step=code&email=a%40b.co', ''],
  ])('leaving %j gives %j', (from, to) => expect(searchAfterCodeStep(from)).toBe(to));
});

type Next = 'get-paid' | 'absent' | 'other';
type Seat = 'owner' | 'manager' | 'contributor' | 'no id';
type Path = 'code step' | 'signed in' | 'already_member';

const NEXTS: Next[] = ['get-paid', 'absent', 'other'];
const SEATS: Seat[] = ['owner', 'manager', 'contributor', 'no id'];
const PATHS: Path[] = ['code step', 'signed in', 'already_member'];
const query = (n: Next) => (n === 'absent' ? '' : `?next=${n}`);
const seatAnswer = (s: Seat, status: string) =>
  s === 'no id' ? { ok: true, status, member_role: 'owner' } : { ok: true, status, organiser_id: 'o1', member_role: s };

// Expected landing: get-paid only for next=get-paid + owner/manager + an id. Otherwise today's.
const ROWS = PATHS.flatMap((p) => NEXTS.flatMap((n) => SEATS.map((s) => [p, n, s] as const)));

describe.each(ROWS)('%s, next=%s, %s seat', (path, next, seat) => {
  const getPaid = next === 'get-paid' && (seat === 'owner' || seat === 'manager');
  const today = seat === 'no id' ? '/account/o' : '/account/o/welcome?o=o1';
  const expected = getPaid ? getPaidStartPath('o1') : today;

  it(`Done goes to ${expected}`, async () => {
    if (path === 'already_member') {
      // A used link opened by its own member: redeem answers already_member with the page; the page goes
      // straight to Done's target (no button).
      h.auth.user = ME;
      h.completion = COMPLETE;
      preview = { ...preview, status: 'used' };
      redeem = seatAnswer(seat, 'already_member');
      mount(`/invite/${TOKEN}${query(next)}`);
      await waitFor(() => expect(where()).toBe(expected), { timeout: 4000 });
      return;
    }
    redeem = seatAnswer(seat, 'redeemed');
    if (path === 'signed in') {
      h.auth.user = ME;
      h.completion = COMPLETE;
      mount(`/invite/${TOKEN}${query(next)}`);
    } else {
      mount(`/invite/${TOKEN}${query(next)}`);
      await stepIs('email');
      fireEvent.change(await screen.findByTestId('join-email-input'), { target: { value: ME.email } });
      fireEvent.click(screen.getByTestId('join-send'));
      await stepIs('code');
      // `next` survives the code step in the address...
      expect(where()).toBe(`/invite/${TOKEN}?step=code&email=${encodeURIComponent(ME.email)}${next === 'absent' ? '' : `&next=${next}`}`);
      // ...and in the emailed link's returnTo (only the honoured value rides it).
      const [arg] = h.otp.mock.calls[0] as [{ options: { emailRedirectTo: string } }];
      const returnTo = new URL(arg.options.emailRedirectTo).searchParams.get('returnTo');
      expect(returnTo).toBe(`/invite/${TOKEN}${next === 'get-paid' ? '?next=get-paid' : ''}`);
      await waitFor(() => expect(document.querySelector('input[autocomplete="one-time-code"]')).toBeTruthy());
      fireEvent.change(document.querySelector('input[autocomplete="one-time-code"]')!, { target: { value: '12345678' } });
      await stepIs('join');
      // leaving the code step keeps it too
      expect(where()).toBe(`/invite/${TOKEN}${query(next)}`);
    }
    await stepIs('join');
    fireEvent.click(screen.getByTestId('invite-join'));
    await stepIs('done');
    const done = screen.getByTestId('join-done-home') as HTMLAnchorElement;
    expect(done.getAttribute('href')).toBe(expected);
    expect(done.textContent).toBe(expected === getPaidStartPath('o1') ? JOIN_COPY.done.buttonGetPaid : JOIN_COPY.done.button);
  });
});

describe('already_member on the Join tap (no new seat)', () => {
  it.each(['owner', 'manager'])('%s with next=get-paid: the plain organiser home, as today (doneTarget picks no id)', async (role) => {
    h.auth.user = ME;
    h.completion = COMPLETE;
    redeem = { ok: true, status: 'already_member', organiser_id: 'o1', member_role: role };
    mount(`/invite/${TOKEN}?next=get-paid`);
    fireEvent.click(await screen.findByTestId('invite-join'));
    await stepIs('done');
    const done = screen.getByTestId('join-done-home') as HTMLAnchorElement;
    expect(done.getAttribute('href')).toBe('/account/o');
    expect(done.textContent).toBe(JOIN_COPY.done.button);
  });
});

it('the button words are the brief’s', () => {
  expect(JOIN_COPY.done.buttonGetPaid).toBe('Set up payments');
  expect(getPaidStartPath('o1')).toBe('/account/p3/get-paid?o=o1');
});
