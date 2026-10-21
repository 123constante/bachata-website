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

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/invite/${TOKEN}`]}>
        <Routes>
          <Route path="/invite/:token" element={<InviteRedeemPage />} />
          <Route path="/account/o" element={<p data-testid="landed">home</p>} />
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
  h.rpc.mockReset();
  h.rpc.mockImplementation((fn: string) => {
    if (fn === 'organiser_invite_preview_v1') return ok(preview);
    if (fn === 'redeem_organiser_invite_v1') return ok(redeem);
    if (fn === 'request_new_invite_v1') return ok(newLink);
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

  it('unknown or garbled link ({}): the invalid card, no ask button', async () => {
    preview = {};
    mount();
    expect((await screen.findByTestId('invite-title')).textContent).toBe(reasonScreen('invalid').title);
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
    expect((await screen.findByTestId('invite-title')).textContent).toBe('Salsa Norte invited you');
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
    expect(readInvitePrefill()).toEqual({ firstName: 'Ana', cityId: 'c1' });
  });
  it('a link with no prefill stores nothing', async () => {
    h.auth.user = { id: 'u1', email: 'ana@example.com' };
    redeem = { ok: true, status: 'redeemed', organiser_id: 'o1', prefill: { first_name: null, city_id: null } };
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await screen.findByTestId('landed');
    expect(readInvitePrefill()).toBeNull();
  });
});
