// @vitest-environment jsdom
/**
 * D56 (release A): redeem_organiser_invite_v1 answers {ok:false, reason:'email_unproven'}
 * when the RIGHT email opens a bound invite in a session that is not a proven mailbox
 * (checked before email_mismatch, never with a hint). The landing must say "Sign in with
 * the email link to accept this invite." and offer the one way there (sign out, then this
 * invite's sign-in), the link unused -- never "this link is not yours", never the
 * generic "Something went wrong". One table over every sign-in-again refusal.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const TOKEN = 'ef'.repeat(32);
const h = vi.hoisted(() => ({ rpc: vi.fn(), signOut: vi.fn(), answer: {} as Record<string, unknown> }));
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
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { first_name: 'Ana', display_name: null }, error: null }) }) }) }),
  },
}));

import InviteRedeemPage from '../InviteRedeemPage';
import { interpretRedeemWithMismatch } from '../redeemMismatch';

const UNPROVEN = 'Sign in with the email link to accept this invite.';
const MISMATCH_GENERIC = 'This link was sent to a different email address. Tap Sign out below, then sign in with the email the invite was sent to and the link is used.';

/** reason x answer extras -> the words the person reads and the button that gets them there. */
const ROWS: Array<[name: string, answer: Record<string, unknown>, body: string, button: string]> = [
  ['email_unproven', { ok: false, reason: 'email_unproven' }, UNPROVEN, 'Sign in with the email link'],
  // D56: no hint on email_unproven, even if one rides along.
  ['email_unproven with a stray hint', { ok: false, reason: 'email_unproven', invite_email_hint: 'a***@e***.com' }, UNPROVEN, 'Sign in with the email link'],
  ['email_mismatch with no hint', { ok: false, reason: 'email_mismatch' }, MISMATCH_GENERIC, 'Sign out'],
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
  window.history.replaceState(null, '', `/invite/${TOKEN}`);
});
afterEach(cleanup);

const redeemCalls = () => h.rpc.mock.calls.filter((c) => c[0] === 'redeem_organiser_invite_v1');

describe('sign-in-again refusals: the words, and the one control that leads there', () => {
  it.each(ROWS)('%s: interpreted as a refusal that keeps the link', (_n, answer, body) => {
    const out = interpretRedeemWithMismatch(answer, null);
    expect(out.kind).toBe('refused');
    if (out.kind !== 'refused') return;
    expect(out.reason).toBe(answer.reason);
    expect(out.copy.body).toBe(body);
    expect(out.copy.title).not.toBe('Something went wrong');
    expect(out.copy.terminal).toBe(false);
    expect(`${out.copy.title} ${out.copy.body}`).not.toMatch(/a\*\*\*@/);
    expect(`${out.copy.title} ${out.copy.body}`).toMatch(/^[\x20-\x7e]*$/);
  });

  it.each(ROWS)('%s: the landing shows the words and its button signs out to this invite\'s sign-in, link unused', async (_n, answer, body, button) => {
    h.answer = answer;
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    expect(await screen.findByText(body)).toBeTruthy();
    const btn = screen.getByTestId('invite-mismatch-signout');
    expect(btn.textContent).toBe(button);
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(`/auth?mode=signin&returnTo=${encodeURIComponent(`/invite/${TOKEN}`)}`));
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(redeemCalls()).toHaveLength(1);
  });
});
