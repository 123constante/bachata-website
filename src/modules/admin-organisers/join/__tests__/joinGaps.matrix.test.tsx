// @vitest-environment jsdom
/**
 * join-gaps-1 consistency matrix (docs/design/join-gaps-1/INVENTORY.md): every (person P, journey J, data shape S)
 * cell of gaps 2 and 3 -> the exact title, body, buttons and where each button goes. Rows that cannot happen are
 * listed in CANNOT_HAPPEN with the reason. Harness copied from joinJourney.test.tsx (vi.mock is per file).
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
  /** (r2 F3) fetchOrganiserHome never settles. */
  homeHang: false,
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => h.auth }));
// Unlike joinJourney's, refetch re-renders (as the real query does), so a save can carry the page on to Join.
vi.mock('@/hooks/useProfileCompletion', async () => {
  const { useReducer } = await import('react');
  return {
  useProfileCompletion: (opts: { paused?: boolean } = {}) => {
    const [, bump] = useReducer((x: number) => x + 1, 0);
    if (h.auth.user) h.reads.push(Boolean(opts.paused));
    const status = opts.paused ? 'loading' : h.completion.status;
    return { ...h.completion, status, refetch: async () => { bump(); return h.completion; } };
  },
  profileCompletionQueryKey: (id: string | null) => ['profile-completion', id],
  };
});
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
  fetchOrganiserHome: async () => { h.home(); if (h.homeHang) await new Promise(() => undefined); return { organisers: h.organisers }; },
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
/** When set, redeem_organiser_invite_v1 answers with this error (e.g. the profile gate's RAISE). */
let redeemError: { message: string } | null;

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
  redeem = { ok: true, status: 'redeemed' };
  bind = { status: 'bound' };
  newLink = { ok: true };
  redeemError = null;
  h.homeHang = false;
  h.rpc.mockReset().mockImplementation((fn: string) => {
    if (fn === 'organiser_invite_preview_v1') return ok(preview);
    if (fn === 'redeem_organiser_invite_v1') return redeemError ? Promise.resolve({ data: null, error: redeemError }) : ok(redeem);
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

const HINT = 'd***@ritmo.example';
const LONG_HINT = 'a***@a-very-long-organiser-domain-name.example';
const WA = JOIN_COPY.help.url;
const INVITE_ONLY_TITLE = 'We can’t create an account for this email yet';
const INVITE_ONLY_BODY = 'Sign-up isn’t open to this email yet.';
const LOCKED = 'This link is now tied to that email, so it can’t be used with another one. Ask Ricky for a new link, or message us.';
const BLOCKED_TITLE = 'We can’t send a code to this email';
const BLOCKED_BODY = 'Sign-up with this email provider isn’t accepted. Use another email address, or message us and we’ll help.';
const ABOUT_NOTICE = 'A few details are missing. Finish them, then join.';
const STALE_TITLE = 'We couldn’t join you yet';
const STALE_BODY = 'Your details look finished, but we couldn’t confirm them yet. Wait a moment, then try again.';
const INVITE_ONLY_403 = { status: 403, message: 'Sign-up is limited to approved organisers.' };
const BLOCKED_403 = { status: 403, message: 'Sign-up with this email provider is not accepted. Please use another email address.' };

/** Every control on screen, in order: [label, href or null]. A text pointing at a missing control fails here. */
const controls = () => Array.from(screen.getByTestId('join-step').querySelectorAll('button, a'))
  .filter((el) => !el.closest('[data-testid="join-strip"]'))
  .map((el) => [el.textContent?.trim() ?? '', el.getAttribute('href')]);
const lines = () => Array.from(screen.getByTestId('join-step').querySelectorAll('p, h1, h2')).map((el) => el.textContent?.trim() ?? '').filter(Boolean);

type SendRow = { cell: string; hint: string | null; bindAs: 'bound' | 'unavailable'; error: unknown; stop: string; title: string; body: string[]; buttons: [string, string | null][]; dismissTo?: string; typed?: string };
const SEND_ROWS: SendRow[] = [
  { cell: 'P1 x J1 x 403 invite-only x hint masked', hint: HINT, bindAs: 'bound', error: INVITE_ONLY_403, stop: 'invite_only', title: INVITE_ONLY_TITLE,
    body: [INVITE_ONLY_BODY, `This invite was sent to ${HINT}.`], buttons: [['Use the email the invite was sent to', null], ['Message us on WhatsApp', WA]], dismissTo: 'email' },
  { cell: 'P1 x J1 x 403 invite-only x the typed email IS the invited one (review r1 F1): only help', hint: HINT, bindAs: 'bound', error: INVITE_ONLY_403, stop: 'invite_only', title: INVITE_ONLY_TITLE, typed: 'dee@ritmo.example',
    body: [INVITE_ONLY_BODY, `This invite was sent to ${HINT}.`, 'That\u2019s the email the invite was sent to. Message us and we\u2019ll open it for you.'], buttons: [['Message us on WhatsApp', WA], ['Go to Bachata Calendar', '/']] },
  { cell: 'P1 x J1 x 403 invite-only x long hint', hint: LONG_HINT, bindAs: 'bound', error: INVITE_ONLY_403, stop: 'invite_only', title: INVITE_ONLY_TITLE,
    body: [INVITE_ONLY_BODY, `This invite was sent to ${LONG_HINT}.`], buttons: [['Use the email the invite was sent to', null], ['Message us on WhatsApp', WA]], dismissTo: 'email' },
  { cell: 'P1 x J1 x 403 bare (no text: cannot tell) x hint masked -> the combined honest words', hint: HINT, bindAs: 'bound', error: { status: 403, message: '' }, stop: 'invite_only', title: INVITE_ONLY_TITLE,
    body: [INVITE_ONLY_BODY, `This invite was sent to ${HINT}.`], buttons: [['Use the email the invite was sent to', null], ['Message us on WhatsApp', WA]], dismissTo: 'email' },
  { cell: 'P1 x J1 x 403 invite-only x hint null, the bind tied the link to the refused email', hint: null, bindAs: 'bound', error: INVITE_ONLY_403, stop: 'invite_only', title: INVITE_ONLY_TITLE,
    body: [INVITE_ONLY_BODY, LOCKED], buttons: [['Message us on WhatsApp', WA], ['Go to Bachata Calendar', '/']] },
  { cell: 'P1 x J1 x 403 invite-only x hint null, bind not on the server (link not tied)', hint: null, bindAs: 'unavailable', error: INVITE_ONLY_403, stop: 'invite_only', title: INVITE_ONLY_TITLE,
    body: [INVITE_ONLY_BODY, 'Try another email, or message us and we’ll help.'], buttons: [['Use another email', null], ['Message us on WhatsApp', WA]], dismissTo: 'email' },
  { cell: 'P1 x J1 x 403 blocked domain x hint masked (words unchanged)', hint: HINT, bindAs: 'bound', error: BLOCKED_403, stop: 'blocked_domain', title: BLOCKED_TITLE,
    body: [BLOCKED_BODY], buttons: [['Message us on WhatsApp', WA], ['Use another email', null]], dismissTo: 'email' },
  { cell: 'P1 x J1 x 403 blocked domain x hint null, the bind tied the link', hint: null, bindAs: 'bound', error: BLOCKED_403, stop: 'blocked_domain', title: BLOCKED_TITLE,
    body: [BLOCKED_BODY, LOCKED], buttons: [['Message us on WhatsApp', WA], ['Go to Bachata Calendar', '/']] },
  { cell: 'P1 x J1 x 429', hint: HINT, bindAs: 'bound', error: { status: 429, message: 'email rate limit exceeded' }, stop: 'rate_limited', title: JOIN_COPY.rateLimited.heading,
    body: [JOIN_COPY.rateLimited.bodyCode], buttons: [['Try again', null], ['Go to Bachata Calendar', '/']], dismissTo: 'email' },
  { cell: 'P1 x J1 x network', hint: HINT, bindAs: 'bound', error: { message: 'Failed to fetch' }, stop: 'network', title: JOIN_COPY.network.heading,
    body: [JOIN_COPY.network.body], buttons: [['Try again', null], ['Go to Bachata Calendar', '/']], dismissTo: 'email' },
];

describe('gap 3: the send refusals, each cell its exact screen', () => {
  it.each(SEND_ROWS)('$cell', async (row) => {
    preview = open({ email_hint: row.hint });
    h.rpc.mockImplementation((fn: string) => {
      if (fn === 'organiser_invite_preview_v1') return ok(preview);
      if (fn === 'bind_organiser_invite_email_v1') return row.bindAs === 'bound' ? ok({ status: 'bound' }) : Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
      return Promise.reject(new Error(`unexpected rpc ${fn}`));
    });
    h.otp.mockResolvedValue({ data: null, error: row.error });
    mount();
    await sendEmail(row.typed ?? 'ana@ritmo.example');
    await stopIs(row.stop);
    expect(screen.getByRole('heading', { name: row.title })).toBeTruthy();
    const shown = lines();
    for (const l of row.body) expect(shown).toContain(l);
    expect(shown.some((l) => /email provider/i.test(l))).toBe(row.stop === 'blocked_domain');
    expect(controls()).toEqual(row.buttons);
    if (row.dismissTo) {
      fireEvent.click(screen.getByRole('button', { name: row.buttons.find(([, href]) => href === null)![0] }));
      await stepIs(row.dismissTo);
      expect(screen.getByTestId('join-step').getAttribute('data-stop')).toBeNull();
    }
  });

  it.each([
    ['P1 x J1 x hint masked: the email step names the invited email', HINT, `This invite was sent to ${HINT}.`],
    ['P6 x J1 x person-bound, hint masked: the same line', HINT, `This invite was sent to ${HINT}.`],
    ['P1 x J1 x hint null: no line (nothing to name)', null, null],
  ])('%s', async (_cell, hint, line) => {
    preview = open({ email_hint: hint, ...(_cell.startsWith('P6') ? PERSON : {}) });
    mount();
    await stepIs('email');
    const hits = lines().filter((l) => l.startsWith('This invite was sent to'));
    expect(hits).toEqual(line ? [line] : []);
  });
});

describe('gap 2: the Join tap refused with profile_incomplete is never silent', () => {
  const INCOMPLETE: ProfileCompletion = { status: 'incomplete', missing: ['dance_role'], profileId: 'p1' };
  const COMPLETE: ProfileCompletion = { status: 'complete', missing: [], profileId: 'p1' };
  const refuseWith = (shape: 'error' | 'reason', after: ProfileCompletion | 'stays') => {
    let calls = 0;
    h.rpc.mockImplementation((fn: string) => {
      if (fn === 'organiser_invite_preview_v1') return ok(preview);
      if (fn === 'redeem_organiser_invite_v1') {
        calls += 1;
        if (calls > 1) return ok({ ok: true, status: 'redeemed' });
        if (after !== 'stays') h.completion = after;
        return shape === 'error' ? Promise.resolve({ data: null, error: { message: 'profile_incomplete' } }) : ok({ ok: false, reason: 'profile_incomplete' });
      }
      return Promise.reject(new Error(`unexpected rpc ${fn}`));
    });
  };

  it.each([
    ['P3 x J2 x profile_incomplete as ERROR (the prod shape)', 'error'],
    ['P3 x J2 x profile_incomplete as REASON (not on prod; same handling)', 'reason'],
  ] as const)('%s -> About with what to do; saving lands on the Join card again', async (_cell, shape) => {
    signedIn(COMPLETE);
    refuseWith(shape, INCOMPLETE);
    h.save.mockImplementation(async () => { h.completion = COMPLETE; });
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await stepIs('about');
    expect(lines()).toContain(ABOUT_NOTICE);
    // ONE button: the About step's own Continue (the notice names no other control).
    expect(controls().map(([l]) => l)).toEqual([JOIN_COPY.about.button]);
    fireEvent.change(screen.getByTestId('join-role-input'), { target: { value: 'leader' } });
    fireEvent.click(screen.getByRole('button', { name: JOIN_COPY.about.button }));
    await stepIs('join');
    expect(screen.getByTestId('invite-join')).toBeTruthy();
    expect(lines()).not.toContain(ABOUT_NOTICE);
  });

  it('P4 x J2 x stale completion (says complete, server refuses): a plain retry message, Try again redeems again', async () => {
    signedIn(COMPLETE);
    refuseWith('error', 'stays');
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await stopIs('profile_stale');
    expect(screen.getByRole('heading', { name: STALE_TITLE })).toBeTruthy();
    expect(lines()).toContain(STALE_BODY);
    expect(controls()).toEqual([['Try again', null], ['Go to Bachata Calendar', '/']]);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await stepIs('done');
    expect(redeems()).toHaveLength(2);
  });

  it('P2 x J2 x profile_incomplete, the re-read finds no dancer profile: the no-profile screen, not the card', async () => {
    signedIn(COMPLETE);
    refuseWith('error', { status: 'no_profile', missing: [], profileId: null });
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await stepIs('no_profile');
    expect(screen.getByRole('heading', { name: JOIN_COPY.noProfile.heading })).toBeTruthy();
  });

  it('P4 x J2 x ok, P5 x J2 x already_member: done, unchanged', async () => {
    for (const status of ['redeemed', 'already_member']) {
      signedIn(COMPLETE);
      redeem = { ok: true, status };
      const { unmount } = mount();
      fireEvent.click(await screen.findByTestId('invite-join'));
      await stepIs('done');
      unmount();
    }
  });

  it('P7 x J2 x email_mismatch: the wrong-account screen names the invited email', async () => {
    signedIn(COMPLETE);
    redeem = { ok: false, reason: 'email_mismatch', invite_email_hint: HINT };
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await stopIs('wrong_account');
    expect(lines().join(' ')).toContain(HINT);
  });
});

/** Cells with no row, each with why it cannot happen (counted in INVENTORY.md). */
export const CANNOT_HAPPEN: readonly [string, string][] = [
  ['P1 x J2 (any redeem answer)', 'no account: the Join card needs a session; the email step comes first'],
  ['P2..P7 x J1 (any send answer)', 'signed in: the email step is not shown (deriveJoinStep goes to about / join / wrong_account)'],
  ['P5 x J2 x profile_incomplete', 'redeem runs _require_complete_dancer_profile_v1 BEFORE it reads membership, so a member with an incomplete profile IS the P3 row (same answer, same code path)'],
  ['P6 x J1 x hint null', 'a person-bound invite always carries the profile, and prod has 0 open person-bound invites; the hint-null rows are the same screen'],
  ['P1 x J1 x 403 invite-only on prod today', 'dancer_area_open = true, so hook v2 skips the v1 refusal; it returns when the flag is off'],
];
