// @vitest-environment jsdom
/**
 * Finding 7 / D36: the signed-out invite landing asks organiser_invite_preview_v1(p_token) for a
 * MASKED hint and says "This invite is for r...@ymail.com" above Sign in. Never the full email,
 * no email field is prefilled, and a missing function or any failure just leaves the line out.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const TOKEN = 'cd'.repeat(32);
const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, session: null, isLoading: false, authStatus: 'ready', signOut: vi.fn() }),
}));
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: () => ({ status: 'signed_out', missing: [], profileId: null, refetch: async () => ({}) }),
}));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/account/DancerProfileGate', () => ({ DancerProfileGate: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...a: unknown[]) => h.rpc(...a), from: () => ({}) },
}));

import InviteRedeemPage from '../InviteRedeemPage';
import { parseInvitePreview } from '../invitePreview';

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/invite/${TOKEN}`]}>
        <Routes>
          <Route path="/invite/:token" element={<InviteRedeemPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  h.rpc.mockReset();
  window.history.replaceState(null, '', `/invite/${TOKEN}`);
});
afterEach(cleanup);

describe('invite landing hint', () => {
  it('asks the preview with the token and shows the masked hint above Sign in', async () => {
    h.rpc.mockResolvedValue({ data: { email_hint: 'r...@ymail.com', organiser_name: 'Ritmo' }, error: null });
    mount();
    const hint = await screen.findByTestId('invite-email-hint');
    expect(hint.textContent).toBe('This invite is for r...@ymail.com. Sign in with that email.');
    expect(h.rpc).toHaveBeenCalledWith('organiser_invite_preview_v1', { p_token: TOKEN });
    // Above the Sign in button, in document order.
    const signIn = screen.getByTestId('invite-sign-in');
    expect(hint.compareDocumentPosition(signIn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Nothing is prefilled: the landing has no email field at all.
    expect(document.querySelector('input[type="email"]')).toBeNull();
    expect(h.rpc).not.toHaveBeenCalledWith('redeem_organiser_invite_v1', expect.anything());
  });

  it.each([
    ['function missing', () => h.rpc.mockResolvedValue({ data: null, error: { message: 'Could not find the function public.organiser_invite_preview_v1' } })],
    ['network failure', () => h.rpc.mockRejectedValue(new Error('network'))],
    ['a full address instead of a hint', () => h.rpc.mockResolvedValue({ data: { email_hint: 'rosa.lima@ymail.com' }, error: null })],
    ['no hint (used or expired token)', () => h.rpc.mockResolvedValue({ data: null, error: null })],
  ])('%s: no hint line, the sign-in card is unchanged', async (_label, arrange) => {
    arrange();
    mount();
    await screen.findByTestId('invite-sign-in');
    await waitFor(() => expect(h.rpc).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('invite-email-hint')).toBeNull();
    expect(document.body.textContent).not.toContain('rosa.lima');
  });
});

describe('parseInvitePreview', () => {
  it.each([
    [{ email_hint: 'r...@ymail.com' }, 'r...@ymail.com'],
    [{ email_hint: 'r***@ymail.com', organiser_name: 'Ritmo' }, 'r***@ymail.com'],
    [{ email_hint: 'rosa@ymail.com' }, null],
    [{ email_hint: 5 }, null],
    [{}, null],
    [null, null],
    ['r...@ymail.com', null],
  ])('%j -> %s', (v, hint) => {
    expect(parseInvitePreview(v)?.emailHint ?? null).toBe(hint);
  });
});
