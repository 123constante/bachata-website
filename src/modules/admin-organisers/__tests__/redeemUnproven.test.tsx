// @vitest-environment jsdom
/**
 * D56 (release A): redeem_organiser_invite_v1 answers {ok:false, reason:'email_unproven'}
 * when the RIGHT email opens a bound invite in a session that is not a proven mailbox
 * (checked before email_mismatch, never with a hint). The landing must say "Sign in with
 * the email link to accept this invite." and offer the one way there, the link unused -- never
 * "this link is not yours", never the generic "Something went wrong". Mockups 2d / 2e: the button
 * signs out FIRST (a plain /auth link loops a signed-in person straight back here, review F1);
 * 2e also emails the sign-in code to the same address and lands on the code box.
 * One table over every sign-in-again refusal.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const TOKEN = 'ef'.repeat(32);
const h = vi.hoisted(() => ({ rpc: vi.fn(), signOut: vi.fn(), otp: vi.fn(), answer: {} as Record<string, unknown> }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u-a', email: 'ana@example.com', user_metadata: {} }, session: null, isLoading: false, authStatus: 'ready', signOut: h.signOut }),
}));
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: () => ({ status: 'complete', missing: [], profileId: 'p-a', refetch: async () => ({ status: 'complete', missing: [], profileId: 'p-a' }) }),
}));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    auth: { signInWithOtp: (...a: unknown[]) => h.otp(...a) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { first_name: 'Ana', display_name: null }, error: null }) }) }) }),
  },
}));

import InviteRedeemPage from '../InviteRedeemPage';
import { CODE_STEP_KEY } from '@/components/MagicLinkConfirmation';
import { interpretRedeem, reasonScreen } from '../inviteModel';

// Approved mockup wording (invite-flows-mockups.html 2d / 2e).
const UNPROVEN = 'This link is for your email, but you signed in another way.';
const MISMATCH_GENERIC = 'It was sent to another email address.';

/** reason x answer extras -> the words the person reads and the button that gets them there. */
const ROWS: Array<[name: string, answer: Record<string, unknown>, body: string, button: string]> = [
  ['email_unproven', { ok: false, reason: 'email_unproven' }, UNPROVEN, 'Email me a sign-in link'],
  // D56: no hint on email_unproven, even if one rides along.
  ['email_unproven with a stray hint', { ok: false, reason: 'email_unproven', invite_email_hint: 'a***@e***.com' }, UNPROVEN, 'Email me a sign-in link'],
  ['email_mismatch with no hint', { ok: false, reason: 'email_mismatch' }, MISMATCH_GENERIC, 'Sign in with that email'],
  ['email_mismatch with a masked hint', { ok: false, reason: 'email_mismatch', invite_email_hint: 'j***@gmail.com' }, 'It was sent to j***@gmail.com.', 'Sign in with that email'],
];

function mount() {
  function Probe() {
    const { pathname, search } = useLocation();
    return <p data-testid="location">{`${pathname}${search}`}</p>;
  }
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/invite/${TOKEN}`]}>
        <Probe />
        <Routes>
          <Route path="/invite/:token" element={<InviteRedeemPage />} />
          <Route path="/account/o" element={<p data-testid="landed">dashboard</p>} />
          <Route path="/auth" element={<p data-testid="auth">auth</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.rpc.mockReset();
  h.rpc.mockImplementation((fn: string) =>
    fn === 'redeem_organiser_invite_v1' ? Promise.resolve({ data: h.answer, error: null }) : Promise.reject(new Error(fn)),
  );
  h.signOut.mockReset();
  h.signOut.mockResolvedValue('signed-out');
  h.otp.mockReset();
  h.otp.mockResolvedValue({ data: {}, error: null });
  sessionStorage.clear();
  window.history.replaceState(null, '', `/invite/${TOKEN}`);
});
afterEach(cleanup);

const redeemCalls = () => h.rpc.mock.calls.filter((c) => c[0] === 'redeem_organiser_invite_v1');

describe('sign-in-again refusals: the words, and the one control that leads there', () => {
  it.each(ROWS)('%s: interpreted as a refusal that keeps the link', (_n, answer, body) => {
    const out = interpretRedeem(answer, null);
    expect(out.kind).toBe('refused');
    if (out.kind !== 'refused') return;
    expect(out.reason).toBe(answer.reason);
    const shown = reasonScreen(out.reason, { emailHint: out.emailHint });
    expect(shown.body).toBe(body);
    expect(shown.title).not.toBe('Something went wrong');
    expect(shown.terminal).toBe(false);
    expect(shown.action).toBe('switch_account');
    expect(`${shown.title} ${shown.body}`).not.toMatch(/a\*\*\*@/);
    expect(`${shown.title} ${shown.body}`).toMatch(/^[\x20-\x7e]*$/);
  });

  it.each(ROWS)('%s: the landing shows the words and its button signs out to this invite\'s sign-in, link unused', async (_n, answer, body, button) => {
    h.answer = answer;
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    expect(await screen.findByText(body)).toBeTruthy();
    const btn = screen.getByTestId('invite-switch-account');
    expect(btn.textContent).toBe(button);
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(`/auth?mode=signin&returnTo=${encodeURIComponent(`/invite/${TOKEN}`)}`));
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(redeemCalls()).toHaveLength(1);
    if (answer.reason === 'email_unproven') {
      // 2e: the code goes to the signed-in (right) address, coming back to this invite, and /auth reopens the code box.
      expect(h.otp).toHaveBeenCalledTimes(1);
      const arg = h.otp.mock.calls[0][0] as { email: string; options: { shouldCreateUser: boolean; emailRedirectTo: string } };
      expect(arg.email).toBe('ana@example.com');
      expect(arg.options.shouldCreateUser).toBe(false);
      expect(new URL(arg.options.emailRedirectTo).searchParams.get('returnTo')).toBe(`/invite/${TOKEN}`);
      expect(JSON.parse(sessionStorage.getItem(CODE_STEP_KEY) ?? '{}')).toMatchObject({ email: 'ana@example.com', mode: 'signin', wrong: 0 });
    } else {
      expect(h.otp).not.toHaveBeenCalled();
    }
  });

  it('F1: a failed sign-out stays on the screen and says so (no loop to /auth while still signed in)', async () => {
    h.answer = { ok: false, reason: 'email_mismatch' };
    h.signOut.mockResolvedValue('failed');
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    fireEvent.click(await screen.findByTestId('invite-switch-account'));
    expect((await screen.findByTestId('invite-switch-error')).textContent).toMatch(/still signed in/);
    expect(screen.getByTestId('location').textContent).toBe(`/invite/${TOKEN}`);
  });

  it('2e: a failed send keeps the person signed in and on the screen', async () => {
    h.answer = { ok: false, reason: 'email_unproven' };
    h.otp.mockResolvedValue({ data: null, error: { message: 'rate limit' } });
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    fireEvent.click(await screen.findByTestId('invite-switch-account'));
    expect((await screen.findByTestId('invite-switch-error')).textContent).toMatch(/could not send/);
    expect(h.signOut).not.toHaveBeenCalled();
  });
});
