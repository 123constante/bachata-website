// @vitest-environment jsdom
/**
 * W1 Option B join on /invite: the journey, screen by screen, against mocked RPCs. Carries the intents
 * of the pre-Option-B specs that still hold (routes.matrix, inviteReasons, inviteJoiningAs,
 * redeemUnproven, inviteWalkthrough, invitePrefillJourney): the masked hint is never a full email,
 * nothing is redeemed without the Join tap, the token leaves the address bar on a terminal screen,
 * a dead link offers "Ask <inviter> for a new one", a used link opened by its member is the done
 * screen, and every refusal after Join has its own screen. Plus the Option B facts: one
 * signInWithOtp path (no account_exists_by_email), the claim runs BEFORE any persona read, the roles
 * are written silently, the safety stop on not_linked, and sign-out never leaves the page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ProfileCompletion } from '@/lib/profileCompletion';

const TOKEN = 'ab'.repeat(32);
const ORG = 'Sensual Vibes';
const ME = { id: 'u1', email: 'ana@example.com' };
const FIRST_SIGN_IN = { ...ME, email_confirmed_at: '2026-10-23T10:00:00Z', last_sign_in_at: null };

const h = vi.hoisted(() => ({
  auth: { user: null as null | { id: string; email: string }, authStatus: 'ready' as 'ready' | 'resolving', signOut: vi.fn(async () => 'signed-out' as string) },
  completion: { status: 'signed_out', missing: [], profileId: null } as ProfileCompletion,
  /** Every useProfileCompletion call while a user is present: was it paused? */
  reads: [] as boolean[],
  rpc: vi.fn(),
  otp: vi.fn(),
  verify: vi.fn(),
  claim: vi.fn(),
  report: vi.fn(),
  save: vi.fn(),
  organisers: [] as { id: string; name: string }[],
  home: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => h.auth }));
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: (opts: { paused?: boolean } = {}) => {
    if (h.auth.user) h.reads.push(Boolean(opts.paused));
    const status = opts.paused ? 'loading' : h.completion.status;
    return { ...h.completion, status, refetch: async () => h.completion };
  },
  profileCompletionQueryKey: (id: string | null) => ['profile-completion', id],
}));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  return { ...real, flags: { ...real.flags, organiserSelfServe: true } };
});
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({
  default: ({ children, breadcrumbs }: { children: ReactNode; breadcrumbs?: { label: string }[] }) => (
    <div data-testid="layout" data-crumbs={(breadcrumbs ?? []).map((b) => b.label).join('>')}>{children}</div>
  ),
}));
vi.mock('@/lib/claimMyDancerProfile', () => ({ claimAtSignIn: (...a: unknown[]) => h.claim(...a) }));
vi.mock('@/lib/reportClientErrorLazy', () => ({ reportClientErrorLazy: (...a: unknown[]) => h.report(...a) }));
vi.mock('@/lib/saveMyDancerProfile', () => ({ saveMyDancerProfile: (...a: unknown[]) => h.save(...a) }));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) => <input id={id} data-testid="join-city-input" value={value} onChange={(e) => onChange(e.target.value)} />,
}));
vi.mock('@/components/profile/DanceRolePicker', () => ({
  DanceRolePicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <input data-testid="join-role-input" value={value} onChange={(e) => onChange(e.target.value)} />,
}));
vi.mock('@/components/profile/AvatarUpload', () => ({
  AvatarUpload: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <input data-testid="join-avatar-input" value={value} onChange={(e) => onChange(e.target.value)} />,
}));
vi.mock('@/modules/organiser/shared/selfServeApi', () => ({
  ORGANISER_HOME_KEY: ['organiser-home'],
  organiserHomeQueryKey: (id: string | undefined) => ['organiser-home', id ?? null],
  fetchOrganiserHome: async () => { h.home(); return { organisers: h.organisers }; },
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
import { JOIN_ROLES } from '../joinModel';

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const open = (extra: Record<string, unknown> = {}) => ({ status: 'open', organiser_name: ORG, inviter_first_name: 'Ricky', email_hint: null, ...extra });
const PERSON = { person: { first_name: 'Papacito', avatar_url: 'https://cdn.example/p.jpg', city: 'London' } };

let preview: unknown;
let redeem: unknown;
let bind: unknown;
let newLink: unknown;

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname}{l.search}</p>; }
function mount(url = `/invite/${TOKEN}`, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(
    <QueryClientProvider client={client}>
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
}

const stepIs = async (step: string) => waitFor(() => expect(screen.getByTestId('join-step').getAttribute('data-step')).toBe(step), { timeout: 4000 });
const stopIs = async (stop: string) => waitFor(() => expect(screen.getByTestId('join-step').getAttribute('data-stop')).toBe(stop), { timeout: 4000 });
const redeems = () => h.rpc.mock.calls.filter((c) => c[0] === 'redeem_organiser_invite_v1');
const signedIn = (completion: ProfileCompletion = { status: 'complete', missing: [], profileId: 'p1' }) => {
  h.auth.user = ME;
  h.completion = completion;
};
const sendEmail = async (email = ME.email) => {
  fireEvent.change(await screen.findByTestId('join-email-input'), { target: { value: email } });
  fireEvent.click(screen.getByTestId('join-send'));
};
const codeInput = () => document.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!;
const typeCode = async (code = '12345678') => {
  await waitFor(() => expect(codeInput()).toBeTruthy());
  fireEvent.change(codeInput(), { target: { value: code } });
};

beforeEach(() => {
  h.auth.user = null;
  h.auth.authStatus = 'ready';
  h.auth.signOut.mockReset().mockResolvedValue('signed-out');
  h.completion = { status: 'signed_out', missing: [], profileId: null };
  h.reads = [];
  h.organisers = [];
  preview = open();
  redeem = { ok: true, status: 'redeemed', organiser_id: 'o1' };
  bind = { status: 'bound' };
  newLink = { ok: true };
  h.rpc.mockReset().mockImplementation((fn: string) => {
    if (fn === 'organiser_invite_preview_v1') return ok(preview);
    if (fn === 'redeem_organiser_invite_v1') return ok(redeem);
    if (fn === 'bind_organiser_invite_email_v1') return ok(bind);
    if (fn === 'request_new_invite_v1') return ok(newLink);
    if (fn === 'set_my_role_intent_v1') return ok({ ok: true, roles: [...JOIN_ROLES] });
    return Promise.reject(new Error(`unexpected rpc ${fn}`));
  });
  h.otp.mockReset().mockResolvedValue({ data: {}, error: null });
  h.verify.mockReset().mockImplementation(async () => {
    h.auth.user = ME;
    h.completion = { status: 'complete', missing: [], profileId: 'p1' };
    return { data: { user: FIRST_SIGN_IN }, error: null };
  });
  h.claim.mockReset().mockResolvedValue({ status: 'not_applicable', profileId: null });
  h.report.mockReset();
  h.save.mockReset().mockResolvedValue(undefined);
  h.home.mockReset();
  localStorage.clear();
  window.history.replaceState(null, '', `/invite/${TOKEN}`);
});
afterEach(cleanup);

describe('signed out: the email step', () => {
  it('names the page and the sender, asks for an email, and never redeems or leaves the page', async () => {
    mount();
    await stepIs('email');
    expect(screen.getByTestId('join-strip').textContent).toContain('Ricky invited you to manage Sensual Vibes');
    expect(screen.getByTestId('join-progress-count').textContent).toBe('Step 1 of 3');
    expect(redeems()).toHaveLength(0);
    expect(screen.queryByTestId('elsewhere')).toBeNull();
    expect(screen.getByTestId('layout').getAttribute('data-crumbs')).not.toBe('');
  });

  it('a bound link shows only the masked hint, never a full email', async () => {
    preview = open({ email_hint: 'a***@example.com' });
    mount();
    await stepIs('email');
    expect(document.body.textContent).not.toContain(ME.email);
  });

  it('a person-bound invite greets the person with their profile (first name, city), no email, no id', async () => {
    preview = open({ ...PERSON, email_hint: 'p***@sensualvibes.example' });
    mount();
    await stepIs('email');
    expect(screen.getByTestId('join-person-hi').textContent).toBe('Hi Papacito');
    expect(screen.getByTestId('join-person-card').textContent).toContain('London');
    expect(screen.getByTestId('join-person-card').textContent).toContain(JOIN_COPY.person.tag);
    expect(document.body.textContent).not.toMatch(/@/);
  });

  it('a page invite shows no person card', async () => {
    mount();
    await stepIs('email');
    expect(screen.queryByTestId('join-person-card')).toBeNull();
  });

  it('send: binds the email on the server first, then ONE signInWithOtp with shouldCreateUser, then the code step in the URL', async () => {
    mount();
    await sendEmail('  Ana@Example.com ');
    await stepIs('code');
    expect(h.rpc).toHaveBeenCalledWith('bind_organiser_invite_email_v1', { p_token: TOKEN, p_email: ME.email });
    expect(h.rpc.mock.calls.findIndex((c) => c[0] === 'bind_organiser_invite_email_v1')).toBeLessThan(h.otp.mock.invocationCallOrder[0]);
    expect(h.otp).toHaveBeenCalledTimes(1);
    const [arg] = h.otp.mock.calls[0] as [{ email: string; options: { shouldCreateUser: boolean; emailRedirectTo: string } }];
    expect(arg.email).toBe(ME.email);
    expect(arg.options.shouldCreateUser).toBe(true);
    expect(decodeURIComponent(arg.options.emailRedirectTo)).toContain(`returnTo=/invite/${TOKEN}`);
    expect(h.rpc).not.toHaveBeenCalledWith('account_exists_by_email', expect.anything());
    expect(screen.getByTestId('where').textContent).toBe(`/invite/${TOKEN}?step=code&email=${encodeURIComponent(ME.email)}`);
    expect(screen.getByTestId('join-sent-to').textContent).toContain(ME.email);
    expect(JSON.parse(localStorage.getItem('pending_role_intent') ?? '[]')).toEqual([...JOIN_ROLES]);
  });

  it('an already-bound link skips the bind and still sends the code', async () => {
    preview = open({ email_hint: 'a***@example.com' });
    mount();
    await sendEmail();
    await stepIs('code');
    expect(h.rpc).not.toHaveBeenCalledWith('bind_organiser_invite_email_v1', expect.anything());
    expect(h.otp).toHaveBeenCalledTimes(1);
  });

  it('a malformed address is refused inline with what to type, nothing sent', async () => {
    mount();
    await sendEmail('ana-at-example');
    expect((await screen.findByTestId('join-email-error')).textContent).toBe(JOIN_COPY.email.badShape);
    expect(h.otp).not.toHaveBeenCalled();
  });

  it('an empty Send shows the bad-shape error and sends nothing', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('join-send'));
    expect((await screen.findByTestId('join-email-error')).textContent).toBe(JOIN_COPY.email.badShape);
    expect(h.otp).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalledWith('bind_organiser_invite_email_v1', expect.anything());
  });

  it('the link was bound to another address meanwhile: tied-to-another-email screen', async () => {
    bind = { status: 'already_bound' };
    let served = 0;
    const base = h.rpc.getMockImplementation()!;
    h.rpc.mockImplementation((fn: string, a: Record<string, unknown>) => (fn === 'organiser_invite_preview_v1' ? ok(served++ === 0 ? open() : open({ email_hint: 'z***@other.com' })) : base(fn, a)));
    mount();
    await sendEmail();
    await stopIs('already_bound');
    expect(h.otp).not.toHaveBeenCalled();
    expect(screen.getByText(JOIN_COPY.alreadyBound.body('Ricky'))).toBeTruthy();
  });
});

describe('refusals when the code is sent: each its own screen, each says what to do next', () => {
  it('blocked email domain (403): WhatsApp help and "Use another email" back to the box', async () => {
    h.otp.mockResolvedValue({ data: null, error: { status: 403, message: 'Sign-up with this email provider is not accepted' } });
    mount();
    await sendEmail('ana@blocked.example');
    await stopIs('blocked_domain');
    expect(screen.getByTestId('join-help').getAttribute('href')).toBe(JOIN_COPY.blockedDomain.helpUrl);
    expect(h.report).toHaveBeenCalledWith(expect.objectContaining({ message: 'invite_join:send:blocked_domain' }), 'error');
    fireEvent.click(screen.getByTestId('join-dismiss'));
    await stepIs('email');
    expect(screen.getByTestId('join-step').getAttribute('data-stop')).toBeNull();
  });

  it('rate limited: the shared OTP rate-limit words and Try again', async () => {
    h.otp.mockResolvedValue({ data: null, error: { status: 429, message: 'over_email_send_rate_limit' } });
    mount();
    await sendEmail();
    await stopIs('rate_limited');
    expect(screen.getByText(JOIN_COPY.rateLimited.bodyCode)).toBeTruthy();
    fireEvent.click(screen.getByTestId('join-retry'));
    await stepIs('email');
  });

  it('a network failure: Try again returns to the email box', async () => {
    h.otp.mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
    mount();
    await sendEmail();
    await stopIs('network');
    fireEvent.click(screen.getByTestId('join-retry'));
    await stepIs('email');
    expect(screen.getByTestId('join-email-input')).toBeTruthy();
  });

  it('the error reporter never sees the token or the email', async () => {
    h.otp.mockResolvedValue({ data: null, error: { status: 429, message: 'rate limit' } });
    mount();
    await sendEmail();
    await stopIs('rate_limited');
    for (const call of h.report.mock.calls) expect(JSON.stringify(call) + String((call[0] as Error).message)).not.toMatch(new RegExp(`${TOKEN}|${ME.email}`));
  });
});

describe('the code step', () => {
  it('8 boxes, "Sent to <full email>", change email goes back, resend waits 60 s', async () => {
    mount(`/invite/${TOKEN}?step=code&email=${encodeURIComponent(ME.email)}`);
    await stepIs('code');
    expect(screen.getByTestId('join-sent-to').textContent).toContain(ME.email);
    expect(codeInput().maxLength).toBe(8);
    const resend = screen.getByTestId('join-resend') as HTMLButtonElement;
    expect(resend.disabled).toBe(false);
    fireEvent.click(resend);
    await waitFor(() => expect(h.otp).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(resend.textContent).toMatch(/Resend code in \d+s/));
    expect(resend.disabled).toBe(true);
    expect(await screen.findByTestId('join-code-notice')).toBeTruthy();
    fireEvent.click(screen.getByTestId('join-change-email'));
    await stepIs('email');
    expect(screen.getByTestId('where').textContent).toBe(`/invite/${TOKEN}`);
  });

  it('a wrong code stays on the boxes with what to do', async () => {
    h.verify.mockResolvedValue({ data: {}, error: { status: 403, message: 'Token has expired or is invalid' } });
    mount(`/invite/${TOKEN}?step=code&email=${encodeURIComponent(ME.email)}`);
    await typeCode();
    expect((await screen.findByTestId('join-code-error')).textContent).toBe(JOIN_COPY.code.wrong);
    await stepIs('code');
  });

  it('verified: the claim runs BEFORE any persona read, then the roles are written, then the step follows the profile', async () => {
    let settleClaim: (v: unknown) => void = () => undefined;
    h.claim.mockImplementation(() => new Promise((r) => { settleClaim = r; }));
    mount(`/invite/${TOKEN}?step=code&email=${encodeURIComponent(ME.email)}`);
    await typeCode();
    await waitFor(() => expect(h.claim).toHaveBeenCalledTimes(1));
    // The session exists, the claim has not answered: every completeness read so far was paused.
    await act(async () => { await Promise.resolve(); });
    expect(h.reads.length).toBeGreaterThan(0);
    expect(h.reads.every(Boolean)).toBe(true);
    expect(h.rpc).not.toHaveBeenCalledWith('set_my_role_intent_v1', expect.anything());
    await act(async () => { settleClaim({ status: 'not_applicable', profileId: null }); });
    await stepIs('join');
    expect(h.reads.some((paused) => !paused)).toBe(true);
    expect(h.rpc).toHaveBeenCalledWith('set_my_role_intent_v1', { p_roles: [...JOIN_ROLES] });
    expect(localStorage.getItem('pending_role_intent')).toBeNull();
    expect(screen.getByTestId('where').textContent).toBe(`/invite/${TOKEN}`);
    expect(redeems()).toHaveLength(0);
  });

  it('a returning person (not a first sign-in) keeps their stored roles: nothing written', async () => {
    h.verify.mockImplementation(async () => {
      h.auth.user = ME;
      h.completion = { status: 'complete', missing: [], profileId: 'p1' };
      return { data: { user: { ...FIRST_SIGN_IN, last_sign_in_at: '2026-01-01T00:00:00Z' } }, error: null };
    });
    mount(`/invite/${TOKEN}?step=code&email=${encodeURIComponent(ME.email)}`);
    await typeCode();
    await stepIs('join');
    expect(h.rpc).not.toHaveBeenCalledWith('set_my_role_intent_v1', expect.anything());
  });

  it('verified with an unfinished profile: About you, step 2 of 3', async () => {
    h.verify.mockImplementation(async () => {
      h.auth.user = ME;
      h.completion = { status: 'incomplete', missing: ['first_name', 'based_city_id', 'dance_role', 'avatar_url'], profileId: 'p1' };
      return { data: { user: FIRST_SIGN_IN }, error: null };
    });
    mount(`/invite/${TOKEN}?step=code&email=${encodeURIComponent(ME.email)}`);
    await typeCode();
    await stepIs('about');
    expect(screen.getByTestId('join-progress-count').textContent).toBe('Step 2 of 3');
  });

  it('person-bound, the claim found no match: the safety stop, one redeem so the server records the attempt, no duplicate join', async () => {
    preview = open(PERSON);
    redeem = { ok: false, reason: 'not_linked' };
    h.claim.mockResolvedValue({ status: 'no_match', profileId: null });
    mount(`/invite/${TOKEN}?step=code&email=${encodeURIComponent(ME.email)}`);
    await typeCode();
    await stopIs('not_linked');
    expect(screen.getByTestId('join-not-linked-body').textContent).toBe(JOIN_COPY.notLinked.body('Ricky'));
    expect(redeems()).toHaveLength(1);
    expect(screen.queryByTestId('join-done')).toBeNull();
    expect(h.report).toHaveBeenCalledWith(expect.objectContaining({ message: 'invite_join:claim:not_linked' }), 'error');
  });

  // Post-sign-in safety stop: every redeem answer shows ITS screen; "told" copy only when the server really recorded not_linked.
  it.each([
    [{ ok: false, reason: 'email_mismatch', invite_email_hint: 'a***@x.com' }, 'wrong_account'],
    [{ ok: false, reason: 'email_unproven' }, 'email_unproven'],
    [{ ok: false, reason: 'rate_limited' }, 'rate_limited'],
    [{ ok: false, reason: 'team_full' }, 'refused'],
    [{ ok: false, reason: 'not_linked' }, 'not_linked'],
  ])('person-bound, claim no_match, redeem %j -> the %s screen, "told" only for not_linked', async (answer, stop) => {
    preview = open(PERSON);
    redeem = answer;
    h.claim.mockResolvedValue({ status: 'no_match', profileId: null });
    mount(`/invite/${TOKEN}?step=code&email=${encodeURIComponent(ME.email)}`);
    await typeCode();
    await stopIs(stop);
    const text = screen.getByTestId('join-step').textContent ?? '';
    expect(/told/i.test(text)).toBe(stop === 'not_linked');
    expect(redeems()).toHaveLength(1);
    expect(screen.queryByTestId('join-done')).toBeNull();
  });

  it('person-bound, claim no_match, redeem invalid -> the dead screen, not a safety stop', async () => {
    preview = open(PERSON);
    redeem = { ok: false, reason: 'invalid' };
    h.claim.mockResolvedValue({ status: 'no_match', profileId: null });
    mount(`/invite/${TOKEN}?step=code&email=${encodeURIComponent(ME.email)}`);
    await typeCode();
    await waitFor(() => expect(redeems()).toHaveLength(1));
    expect(screen.queryByTestId('join-done')).toBeNull();
    expect(/told/i.test(screen.getByTestId('join-step').textContent ?? '')).toBe(false);
  });

  it('person-bound, claim no_match, redeem throws (network) -> the network stop, Try again redeems and lands on done', async () => {
    preview = open(PERSON);
    h.claim.mockResolvedValue({ status: 'no_match', profileId: null });
    let first = true;
    const base = h.rpc.getMockImplementation()!;
    h.rpc.mockImplementation((fn: string, a: Record<string, unknown>) => (fn === 'redeem_organiser_invite_v1' && first ? ((first = false), Promise.reject(new Error('Failed to fetch'))) : base(fn, a)));
    mount(`/invite/${TOKEN}?step=code&email=${encodeURIComponent(ME.email)}`);
    await typeCode();
    await stopIs('network');
    expect(/told/i.test(screen.getByTestId('join-step').textContent ?? '')).toBe(false);
    fireEvent.click(screen.getByTestId('join-retry'));
    await stepIs('done');
    expect(redeems()).toHaveLength(2);
  });

  it('person-bound, claim no_match, the server seats them: the organiser-home cache is invalidated on the claim path too', async () => {
    preview = open(PERSON);
    h.claim.mockResolvedValue({ status: 'no_match', profileId: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(client, 'invalidateQueries');
    mount(`/invite/${TOKEN}?step=code&email=${encodeURIComponent(ME.email)}`, client);
    await typeCode();
    await stepIs('done');
    expect(spy).toHaveBeenCalledWith({ queryKey: ['organiser-home'] });
  });

  it('person-bound, the claim linked the profile: no stop, straight on', async () => {
    preview = open(PERSON);
    h.claim.mockResolvedValue({ status: 'linked', profileId: 'p1' });
    mount(`/invite/${TOKEN}?step=code&email=${encodeURIComponent(ME.email)}`);
    await typeCode();
    await stepIs('join');
    expect(redeems()).toHaveLength(0);
  });

  it('a page invite never stops on the claim', async () => {
    h.claim.mockResolvedValue({ status: 'no_match', profileId: null });
    mount(`/invite/${TOKEN}?step=code&email=${encodeURIComponent(ME.email)}`);
    await typeCode();
    await stepIs('join');
    expect(screen.getByTestId('join-step').getAttribute('data-stop')).toBeNull();
  });
});

describe('About you (inline, the same four fields as /finish-profile)', () => {
  it('asks only the missing fields, pre-fills from the preview prefill, and saves only those fields', async () => {
    preview = open({ prefill: { first_name: 'Ana', city_id: 'c1' } });
    signedIn({ status: 'incomplete', missing: ['first_name', 'based_city_id'], profileId: 'p1' });
    mount();
    await stepIs('about');
    expect((screen.getByTestId('join-about-first-name') as HTMLInputElement).value).toBe('Ana');
    expect((screen.getByTestId('join-city-input') as HTMLInputElement).value).toBe('c1');
    expect(screen.queryByTestId('join-role-input')).toBeNull();
    expect(screen.queryByTestId('join-avatar-input')).toBeNull();
    fireEvent.click(screen.getByTestId('join-about-save'));
    await waitFor(() => expect(h.save).toHaveBeenCalledWith({ first_name: 'Ana', based_city_id: 'c1' }));
  });

  it('Continue is disabled with what is still to add until every asked field is filled', async () => {
    signedIn({ status: 'incomplete', missing: ['dance_role'], profileId: 'p1' });
    mount();
    await stepIs('about');
    const save = screen.getByTestId('join-about-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByTestId('join-about-why').textContent).toMatch(/^Still to add: /);
    fireEvent.change(screen.getByTestId('join-role-input'), { target: { value: 'leader' } });
    expect(save.disabled).toBe(false);
    expect(screen.getByTestId('join-about-why').textContent).toBe('');
  });

  it('a failed save says so and keeps the answers', async () => {
    h.save.mockRejectedValue(new Error('down'));
    signedIn({ status: 'incomplete', missing: ['first_name'], profileId: 'p1' });
    mount();
    await stepIs('about');
    fireEvent.change(screen.getByTestId('join-about-first-name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByTestId('join-about-save'));
    expect((await screen.findByText(JOIN_COPY.about.saveFailed)).textContent).toBeTruthy();
    expect((screen.getByTestId('join-about-first-name') as HTMLInputElement).value).toBe('Ana');
  });
});

describe('the Join tap', () => {
  it('signed in, complete: the Join card names the page; one tap redeems ONCE, the done screen, the token gone, the home list refreshed', async () => {
    signedIn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['organiser-home', ME.id], { organisers: [] });
    mount(undefined, client);
    await stepIs('join');
    expect(screen.getByTestId('join-org-card').textContent).toContain(ORG);
    expect(screen.getByTestId('join-progress-count').textContent).toBe('Step 2 of 2');
    expect(redeems()).toHaveLength(0);
    fireEvent.click(screen.getByTestId('invite-join'));
    await stepIs('done');
    expect(redeems()).toHaveLength(1);
    expect(h.rpc).toHaveBeenCalledWith('redeem_organiser_invite_v1', { p_token: TOKEN });
    expect(screen.getByTestId('join-done').textContent).toContain(ORG);
    expect((screen.getByTestId('join-done-home') as HTMLAnchorElement).getAttribute('href')).toBe('/account/o/welcome?o=o1');
    expect(screen.getByTestId('join-done-home').textContent).toBe('Open your organiser home');
    expect(window.location.pathname).toBe('/invite');
    // F1 (fixup1): the cached "no organisers" home list is refetched, so the organiser home shows the new seat.
    await waitFor(() => expect(h.home).toHaveBeenCalledTimes(1));
  });

  it('a double mount (StrictMode) makes one redeem call', async () => {
    signedIn();
    const { StrictMode } = await import('react');
    render(
      <StrictMode>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter initialEntries={[`/invite/${TOKEN}`]}><Routes><Route path="/invite/:token" element={<InviteRedeemPage />} /></Routes></MemoryRouter>
        </QueryClientProvider>
      </StrictMode>,
    );
    fireEvent.click(await screen.findByTestId('invite-join'));
    await stepIs('done');
    expect(redeems()).toHaveLength(1);
  });

  it('already a member (server says so): the same done screen', async () => {
    signedIn();
    redeem = { ok: true, status: 'already_member', organiser_id: 'o1' };
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await stepIs('done');
    // Already on the team (not a new seat): the plain organiser home, not the new-seat Welcome.
    expect((screen.getByTestId('join-done-home') as HTMLAnchorElement).getAttribute('href')).toBe('/account/o');
  });

  it('already on the team (own page list): the done screen without a tap, nothing redeemed', async () => {
    signedIn();
    h.organisers = [{ id: 'o1', name: ORG }];
    mount();
    await stepIs('done');
    expect(redeems()).toHaveLength(0);
  });

  it.each([
    ['email_mismatch', 'wrong_account', 'invite-switch-account'],
    ['email_unproven', 'email_unproven', 'invite-switch-account'],
    ['rate_limited', 'rate_limited', 'join-retry'],
    ['team_full', 'refused', 'invite-home'],
  ])('refused with %s after Join: its screen and its one control', async (reason, stop, control) => {
    signedIn();
    redeem = { ok: false, reason, invite_email_hint: 'z***@other.com' };
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await stopIs(stop);
    expect(screen.getByTestId(control)).toBeTruthy();
    expect(screen.queryByTestId('elsewhere')).toBeNull();
    expect(document.body.textContent).not.toContain(reason);
  });

  it('rate_limited after Join (login audit L6): Try again is disabled with its reason, nothing redeems again', async () => {
    signedIn();
    redeem = { ok: false, reason: 'rate_limited' };
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await stopIs('rate_limited');
    const btn = screen.getByTestId('join-retry') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByTestId('join-retry-why').textContent).toBe('Please wait an hour before trying again.');
    fireEvent.click(btn);
    expect(redeems()).toHaveLength(1);
  });

  it('unconfirmed_account after Join (login audit L3): its own screen, the person is NOT signed out', async () => {
    signedIn();
    redeem = { ok: false, reason: 'unconfirmed_account' };
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await stopIs('refused');
    expect(screen.getByRole('heading').textContent).toBe('Confirm your account first');
    expect(h.auth.signOut).not.toHaveBeenCalled();
    expect(screen.getByTestId('invite-home')).toBeTruthy();
  });

  it('team_full after Join (login audit L2): the WhatsApp help link as well as home', async () => {
    signedIn();
    redeem = { ok: false, reason: 'team_full' };
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await stopIs('refused');
    expect(screen.getByTestId('join-help').getAttribute('href')).toBe(JOIN_COPY.help.url);
    expect(screen.getByTestId('invite-home')).toBeTruthy();
  });

  it('an unknown refusal after Join (login audit L4): Try again redeems again and can land on done', async () => {
    signedIn();
    redeem = { ok: false, reason: 'brand_new_reason' };
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await stopIs('refused');
    expect(screen.getByTestId('invite-home')).toBeTruthy();
    redeem = { ok: true, status: 'redeemed', organiser_id: 'o1' };
    fireEvent.click(screen.getByTestId('join-retry'));
    await stepIs('done');
    expect(redeems()).toHaveLength(2);
  });

  it('not_linked after Join (A2 refused the seat): the safety stop, the invite stays usable', async () => {
    signedIn();
    preview = open(PERSON);
    redeem = { ok: false, reason: 'not_linked' };
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await stopIs('not_linked');
    expect(screen.getByText(JOIN_COPY.notLinked.note)).toBeTruthy();
    expect(window.location.pathname).toBe(`/invite/${TOKEN}`);
  });

  it('a dead answer after Join (someone else used it meanwhile): the preview is read again and the dead screen shows', async () => {
    signedIn();
    redeem = { ok: false, reason: 'used' };
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await waitFor(() => expect(h.rpc.mock.calls.filter((c) => c[0] === 'organiser_invite_preview_v1').length).toBeGreaterThanOrEqual(2));
  });

  it('a network failure after Join: Try again redeems again and lands on done', async () => {
    signedIn();
    let first = true;
    const base = h.rpc.getMockImplementation()!;
    h.rpc.mockImplementation((fn: string, a: Record<string, unknown>) => (fn === 'redeem_organiser_invite_v1' && first ? ((first = false), Promise.reject(new Error('Failed to fetch'))) : base(fn, a)));
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await stopIs('network');
    fireEvent.click(screen.getByTestId('join-retry'));
    await stepIs('done');
    expect(redeems()).toHaveLength(2);
  });

  it('the server says profile_incomplete (a stale client): the completeness is re-read, the token kept', async () => {
    signedIn();
    redeem = { ok: false, reason: 'profile_incomplete' };
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await waitFor(() => expect(redeems()).toHaveLength(1));
    expect(window.location.pathname).toBe(`/invite/${TOKEN}`);
    expect(screen.queryByTestId('elsewhere')).toBeNull();
  });

  it('"Not you? Use another email": signs out and shows the email step on THIS page, link unused', async () => {
    signedIn();
    h.auth.signOut.mockImplementation(async () => { h.auth.user = null; h.completion = { status: 'signed_out', missing: [], profileId: null }; return 'signed-out'; });
    mount();
    fireEvent.click(await screen.findByTestId('invite-not-you'));
    await stepIs('email');
    expect(h.auth.signOut).toHaveBeenCalledTimes(1);
    expect(redeems()).toHaveLength(0);
    expect(screen.queryByTestId('elsewhere')).toBeNull();
  });

  it('a failed sign-out stays on the card and says so', async () => {
    signedIn();
    h.auth.signOut.mockResolvedValue('failed');
    mount();
    fireEvent.click(await screen.findByTestId('invite-not-you'));
    expect((await screen.findByText(JOIN_COPY.signOutFailed)).textContent).toBeTruthy();
    await stepIs('join');
  });
});

describe('wrong account', () => {
  it('signed in as someone else: says who and for whom (masked), sign out continues here', async () => {
    signedIn();
    preview = open({ email_hint: 'z***@other.com' });
    h.auth.signOut.mockImplementation(async () => { h.auth.user = null; return 'signed-out'; });
    mount();
    await stepIs('wrong_account');
    expect(screen.getByTestId('invite-email-hint').textContent).toBe(JOIN_COPY.wrongAccount.body(ME.email, 'z***@other.com'));
    expect(redeems()).toHaveLength(0);
    fireEvent.click(screen.getByTestId('invite-switch-account'));
    await stepIs('email');
    expect(screen.queryByTestId('elsewhere')).toBeNull();
  });
});

describe('dead and broken links', () => {
  it.each(['used', 'expired', 'revoked'])('%s, signed out: why, and "Ask Ricky for a new one" that really asks', async (status) => {
    preview = { ...open(), status };
    mount();
    await stepIs('dead');
    const ask = screen.getByTestId('invite-new-link');
    expect(ask.textContent).toContain('Ricky');
    expect(window.location.pathname).toBe('/invite');
    fireEvent.click(ask);
    expect(await screen.findByTestId('invite-new-link-done')).toBeTruthy();
    expect(h.rpc).toHaveBeenCalledWith('request_new_invite_v1', expect.objectContaining({ p_token: TOKEN }));
    expect(redeems()).toHaveLength(0);
  });

  it('a used link opened by the person who used it: the done screen, no error', async () => {
    signedIn();
    preview = { ...open(), status: 'used' };
    redeem = { ok: true, status: 'already_member', organiser_id: 'o4' };
    mount();
    await stepIs('done');
    expect((screen.getByTestId('join-done-home') as HTMLAnchorElement).getAttribute('href')).toBe('/account/o');
  });

  it('a used link opened by someone else: the used screen', async () => {
    signedIn();
    preview = { ...open(), status: 'used' };
    redeem = { ok: false, reason: 'used' };
    mount();
    await stepIs('dead');
  });

  it('unknown link: the invalid screen, no ask button', async () => {
    preview = {};
    mount();
    await stepIs('dead');
    expect(screen.queryByTestId('invite-new-link')).toBeNull();
  });

  it.each(['not-a-token', 'ab'.repeat(31), 'AB'.repeat(32)])('a malformed token (%s) never reaches the server', async (token) => {
    mount(`/invite/${token}`);
    await stepIs('dead');
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('the preview lookup failed: Try again asks again', async () => {
    let first = true;
    const base = h.rpc.getMockImplementation()!;
    h.rpc.mockImplementation((fn: string, a: Record<string, unknown>) => (fn === 'organiser_invite_preview_v1' && first ? ((first = false), Promise.reject(new Error('Failed to fetch'))) : base(fn, a)));
    mount();
    await stepIs('unreachable');
    fireEvent.click(screen.getByTestId('join-retry'));
    await stepIs('email');
  });

  it('sets a no-referrer policy while mounted and removes it after', async () => {
    const view = mount();
    expect(document.head.querySelector('meta[name="referrer"][content="no-referrer"]')).toBeTruthy();
    view.unmount();
    expect(document.head.querySelector('meta[name="referrer"]')).toBeNull();
  });
});

describe('the Done link: where the organiser id comes from', () => {
  const codeUrl = `/invite/${TOKEN}?step=code&email=${encodeURIComponent(ME.email)}`;

  it('person-bound, the claim found no match but the server seats them: the link carries the redeem id', async () => {
    preview = open(PERSON);
    redeem = { ok: true, status: 'redeemed', organiser_id: 'o7' };
    h.claim.mockResolvedValue({ status: 'no_match', profileId: null });
    mount(codeUrl);
    await typeCode();
    await stepIs('done');
    expect((screen.getByTestId('join-done-home') as HTMLAnchorElement).getAttribute('href')).toBe('/account/o/welcome?o=o7');
  });

  it('already on the team by name (nothing redeemed): the one matching page of the person is the link', async () => {
    signedIn();
    h.organisers = [{ id: 'own1', name: ' sensual vibes ' }];
    mount();
    await stepIs('done');
    expect(redeems()).toHaveLength(0);
    expect((screen.getByTestId('join-done-home') as HTMLAnchorElement).getAttribute('href')).toBe('/account/o/welcome?o=own1');
  });

  it('two of the person\'s pages share the invite\'s name: no guess, the plain organiser home', async () => {
    signedIn();
    h.organisers = [{ id: 'A', name: ORG }, { id: 'A2', name: ORG.toUpperCase() }];
    mount();
    await stepIs('done');
    expect((screen.getByTestId('join-done-home') as HTMLAnchorElement).getAttribute('href')).toBe('/account/o');
  });

  it('the server seats them with no organiser id and no page matches: the plain organiser home', async () => {
    signedIn();
    redeem = { ok: true, status: 'redeemed', organiser_id: null };
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await stepIs('done');
    expect((screen.getByTestId('join-done-home') as HTMLAnchorElement).getAttribute('href')).toBe('/account/o');
  });
});
