// @vitest-environment jsdom
/**
 * Arc 1 PR 2A: every reason x every screen. ONE mapping (reasonScreen) feeds the pre-sign-in
 * preview screen AND the post-Join refusal screen, so the same fact has the same words on both.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const TOKEN = 'ab'.repeat(32);
const h = vi.hoisted(() => ({
  auth: { user: null as null | { id: string; email: string }, authStatus: 'ready' as const },
  rpc: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ ...h.auth, signOut: async () => 'signed_out' }) }));
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: () => ({ status: 'complete', missing: [], profileId: 'p1', refetch: async () => ({ status: 'complete' }) }),
}));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { first_name: 'Ana', display_name: null }, error: null }) }) }) }),
  },
}));

import InviteRedeemPage from '../InviteRedeemPage';
import { reasonScreen, newLinkLabel, TRY_LATER_COPY } from '../inviteModel';
import { readInvitePrefill } from '@/lib/invitePrefill';

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const PREVIEW = { status: 'open', organiser_name: 'Salsa Norte', inviter_first_name: 'Marta', email_hint: null as string | null };
let preview: Record<string, unknown>;
let redeem: unknown;
let newLink: unknown;
let home: () => Promise<unknown> = () => Promise.reject(new Error('no list'));

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/invite/${TOKEN}`]}>
        <Routes>
          <Route path="/invite/:token" element={<InviteRedeemPage />} />
          <Route path="/account/o" element={<p data-testid="landed">home</p>} />
          <Route path="/account/o/welcome" element={<p data-testid="landed">welcome</p>} />
          <Route path="*" element={<p data-testid="elsewhere">elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  h.auth.user = null;
  preview = { ...PREVIEW };
  redeem = { ok: true, status: 'redeemed', organiser_id: 'o1' };
  newLink = { ok: true };
  home = () => Promise.reject(new Error('no list'));
  h.rpc.mockReset();
  h.rpc.mockImplementation((fn: string) => {
    if (fn === 'organiser_invite_preview_v1') return ok(preview);
    if (fn === 'redeem_organiser_invite_v1') return ok(redeem);
    if (fn === 'request_new_invite_v1') return ok(newLink);
    if (fn === 'organiser_home_v1') return home();
    return Promise.reject(new Error(`unexpected rpc ${fn}`));
  });
});
afterEach(cleanup);

const BROKEN_PREVIEW = ['used', 'revoked', 'expired'] as const;
const POST_JOIN = ['used', 'revoked', 'expired', 'email_mismatch', 'email_unproven', 'invalid'] as const;
const ASKABLE = new Set(['used', 'revoked', 'expired', 'email_mismatch']);

describe('preview screen (signed out): broken links', () => {
  it.each(BROKEN_PREVIEW)('%s: the shared title, the sender named on the ask button', async (status) => {
    preview = { ...PREVIEW, status };
    mount();
    expect((await screen.findByTestId('invite-title')).textContent).toBe(reasonScreen(status).title);
    expect(screen.getByTestId('invite-new-link').textContent).toBe('Ask Marta for a new one');
    expect(screen.getByTestId('invite-home')).toBeTruthy();
    expect(h.rpc).not.toHaveBeenCalledWith('redeem_organiser_invite_v1', expect.anything());
  });

  it('no inviter on file: the plain "Request a new link"', async () => {
    preview = { ...PREVIEW, status: 'expired', inviter_first_name: null };
    mount();
    expect((await screen.findByTestId('invite-new-link')).textContent).toBe('Request a new link');
    expect(newLinkLabel(null)).toBe('Request a new link');
  });

  // {} is an unknown link on the arc-1 server, AND a used / revoked / expired one on the pre-arc-1 server (prod
  // today). Neither is called garbled on a guess: the plain flow, and redeem's answer after Join decides.
  it('no preview ({}): the plain sign-in card, no ask button, the link unused', async () => {
    preview = {};
    mount();
    expect(await screen.findByTestId('invite-sign-in')).toBeTruthy();
    expect(screen.getByTestId('invite-title').textContent).not.toBe(reasonScreen('invalid').title);
    expect(screen.queryByTestId('invite-new-link')).toBeNull();
    expect(h.rpc).not.toHaveBeenCalledWith('redeem_organiser_invite_v1', expect.anything());
  });

  it('no preview, signed in: Join, then redeem invalid shows 2f with no ask button', async () => {
    preview = {};
    h.auth.user = { id: 'u1', email: 'ana@example.com' };
    redeem = { ok: false, reason: 'invalid' };
    mount();
    (await screen.findByTestId('invite-join')).click();
    await waitFor(() => expect(screen.getByTestId('invite-title').textContent).toBe(reasonScreen('invalid').title));
    expect(screen.queryByTestId('invite-new-link')).toBeNull();
  });
});

describe('post-Join refusal screen: the same words', () => {
  it.each(POST_JOIN)('%s', async (reason) => {
    h.auth.user = { id: 'u1', email: 'ana@example.com' };
    redeem = { ok: false, reason, invite_email_hint: 'j***@gmail.com' };
    mount();
    expect((await screen.findByTestId('invite-title')).textContent).toBe('Join Salsa Norte');
    fireEvent.click(await screen.findByTestId('invite-join'));
    await waitFor(() => expect(screen.getByTestId('invite-title').textContent).toBe(reasonScreen(reason, { emailHint: 'j***@gmail.com' }).title));
    expect(!!screen.queryByTestId('invite-new-link')).toBe(ASKABLE.has(reason));
    if (reason === 'email_mismatch') expect(screen.getByTestId('invite-body').textContent).toContain('j***@gmail.com');
    if (reason === 'email_unproven') expect(screen.getByTestId('invite-title').textContent).toBe('Use the email link to sign in');
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });
});

describe('the reason mapping itself (every reason x ask button x copy rules)', () => {
  const ALL = ['sign_in_required', 'authentication_required', 'unconfirmed_account', 'rate_limited', 'profile_incomplete', 'invalid', 'used', 'revoked', 'expired', 'email_mismatch', 'email_unproven', 'team_full'];
  it.each(ALL)('%s has a title and body, and never names a control', (reason) => {
    const s = reasonScreen(reason, { inviterFirstName: 'Marta' });
    expect(s.title.length).toBeGreaterThan(3);
    // Mockup 2c (withdrawn) has no body; every other screen has one.
    if (reason === 'revoked') expect(s.body).toBe('');
    else expect(s.body.length).toBeGreaterThan(15);
    expect(s.body).not.toMatch(/\b(tap|click|press|button|menu|tab)\b/i);
    expect(s.offerNewLink).toBe(ASKABLE.has(reason));
  });
  it('an unknown reason is the retryable fallback', () => {
    expect(reasonScreen('nope').action).toBe('retry');
  });
});

describe('asking for a new link', () => {
  const cases: [string, unknown, string, string][] = [
    ['sent', { ok: true }, 'invite-new-link-done', 'Request sent'],
    ['already requested', { ok: false, reason: 'already_requested' }, 'invite-new-link-done', 'You already asked'],
    ['rate limited', { ok: false, reason: 'rate_limited' }, 'invite-new-link-error', TRY_LATER_COPY],
    ['refused', { ok: false, reason: 'invalid' }, 'invite-new-link-error', 'cannot be renewed'],
  ];
  it.each(cases)('%s', async (_n, answer, testid, text) => {
    preview = { ...PREVIEW, status: 'expired' };
    newLink = answer;
    mount();
    fireEvent.click(await screen.findByTestId('invite-new-link'));
    expect((await screen.findByTestId(testid)).textContent).toContain(text);
    expect(h.rpc).toHaveBeenCalledWith('request_new_invite_v1', { p_token: TOKEN });
  });
});

describe('already a member / used by me -> Home', () => {
  it('a used link opened by a person the server knows as a member goes Home with no error', async () => {
    h.auth.user = { id: 'u1', email: 'ana@example.com' };
    preview = { ...PREVIEW, status: 'used' };
    redeem = { ok: true, status: 'already_member', organiser_id: 'o1', member_role: 'owner' };
    mount();
    expect(await screen.findByTestId('landed')).toBeTruthy();
  });
  it('a used link opened by someone else shows the used screen', async () => {
    h.auth.user = { id: 'u2', email: 'bob@example.com' };
    preview = { ...PREVIEW, status: 'used' };
    redeem = { ok: false, reason: 'used' };
    mount();
    expect((await screen.findByTestId('invite-title')).textContent).toBe(reasonScreen('used').title);
  });
  it('an open link for a person already on the team goes Home on Join', async () => {
    h.auth.user = { id: 'u1', email: 'ana@example.com' };
    redeem = { ok: true, status: 'already_member', organiser_id: 'o1' };
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    expect(await screen.findByTestId('landed')).toBeTruthy();
  });
});

describe('the open link names the page and the sender (screen 2a)', () => {
  it('signed out', async () => {
    mount();
    expect((await screen.findByTestId('invite-title')).textContent).toBe('You\u2019ve been invited to manage Salsa Norte');
  });
  it('signed in: the Join card names both', async () => {
    h.auth.user = { id: 'u1', email: 'ana@example.com' };
    mount();
    expect((await screen.findByTestId('invite-title')).textContent).toBe('Join Salsa Norte');
    expect(screen.getByTestId('invite-body').textContent).toContain('Marta');
  });
});

describe('prefill rides from redeem to the dancer questions', () => {
  it('a bound link redeems and stores the sender\'s name + city', async () => {
    h.auth.user = { id: 'u1', email: 'ana@example.com' };
    preview = { ...PREVIEW, email_hint: 'a**@example.com' };
    redeem = { ok: true, status: 'redeemed', organiser_id: 'o1', prefill: { first_name: 'Ana', city_id: 'c1' } };
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await screen.findByTestId('landed');
    expect(readInvitePrefill('u1')).toEqual({ firstName: 'Ana', cityId: 'c1' });
  });
  it('a link with no prefill stores nothing', async () => {
    h.auth.user = { id: 'u1', email: 'ana@example.com' };
    redeem = { ok: true, status: 'redeemed', organiser_id: 'o1', prefill: { first_name: null, city_id: null } };
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await screen.findByTestId('landed');
    expect(readInvitePrefill('u1')).toBeNull();
  });
});

describe('A: a bound link on the signed-in card (arc 1 prefill fix 2)', () => {
  const BOUND = { ...PREVIEW, email_hint: 'z...@example.test' };
  it('matching mask: the hint line, no "whoever", the sender named, Join offered', async () => {
    h.auth.user = { id: 'u1', email: 'zed@example.test' };
    preview = BOUND;
    mount();
    expect((await screen.findByTestId('invite-email-hint')).textContent).toBe('This invite is for z...@example.test.');
    expect(screen.getByTestId('invite-body').textContent).toBe('Marta invited you to manage it on Bachata Calendar.');
    expect(screen.getByTestId('invite-join')).toBeTruthy();
  });
  it('matching mask, no inviter on file', async () => {
    h.auth.user = { id: 'u1', email: 'zed@example.test' };
    preview = { ...BOUND, inviter_first_name: null };
    mount();
    expect((await screen.findByTestId('invite-body')).textContent).toBe('You were invited to manage it on Bachata Calendar.');
  });
  it('different email: says so, no Join, sign in with that email + home', async () => {
    h.auth.user = { id: 'u2', email: 'amy@example.test' };
    preview = BOUND;
    mount();
    expect((await screen.findByTestId('invite-title')).textContent).toBe('This link is for a different email');
    expect(screen.getByTestId('invite-body').textContent).toBe('You are signed in as amy@example.test. Sign in with the email this link was sent to.');
    expect(screen.queryByTestId('invite-join')).toBeNull();
    expect(screen.getByTestId('invite-switch-account').textContent).toBe('Sign in with that email');
    expect(screen.getByTestId('invite-home').textContent).toBe('Go to Bachata Calendar');
  });
  it('unbound link keeps the "whoever" wording', async () => {
    h.auth.user = { id: 'u1', email: 'ana@example.com' };
    preview = { ...PREVIEW, inviter_first_name: null };
    mount();
    expect((await screen.findByTestId('invite-body')).textContent).toContain('Whoever uses this link joins the team');
    expect(screen.queryByTestId('invite-email-hint')).toBeNull();
  });
  it('the server refusal after Join still works when the masks match', async () => {
    h.auth.user = { id: 'u1', email: 'zed@example.test' };
    preview = BOUND;
    redeem = { ok: false, reason: 'email_mismatch', invite_email_hint: 'z...@example.test' };
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    expect((await screen.findByTestId('invite-title')).textContent).toBe(reasonScreen('email_mismatch').title);
  });
});

describe('B: already on the team (arc 1 prefill fix 2)', () => {
  const list = (names: string[]) => () => ok({ today: '2026-10-22', organisers: names.map((name, i) => ({ id: `o${i}`, name, role: 'owner', series: [] })) });
  beforeEach(() => { h.auth.user = { id: 'u1', email: 'ana@example.com' }; });
  it('owner of that page: already-on card, Go to, no Join, nothing redeemed', async () => {
    home = list(['Other', ' salsa norte ']);
    mount();
    expect((await screen.findByTestId('invite-title')).textContent).toBe('You are already on Salsa Norte');
    expect(screen.getByTestId('invite-body').textContent).toBe('This link is not needed. You already manage this page.');
    expect(screen.getByTestId('invite-go-page').textContent).toBe('Go to Salsa Norte');
    expect(screen.queryByTestId('invite-join')).toBeNull();
    expect(h.rpc).not.toHaveBeenCalledWith('redeem_organiser_invite_v1', expect.anything());
  });
  it.each([
    ['a different page with a similar name', () => list(['Salsa Norte Kids'])],
    ['no organisers', () => list([])],
    ['the list failing', () => () => Promise.reject(new Error('boom'))],
  ])('%s: today\'s Join card', async (_l, make) => {
    home = make();
    mount();
    expect(await screen.findByTestId('invite-join')).toBeTruthy();
    expect(screen.getByTestId('invite-title').textContent).toBe('Join Salsa Norte');
  });
  it('a slow list never blocks the card past the short wait', async () => {
    home = () => new Promise(() => {});
    mount();
    expect(screen.queryByTestId('invite-join')).toBeNull();
    expect(await screen.findByTestId('invite-join', undefined, { timeout: 3000 })).toBeTruthy();
  });
});
