// @vitest-environment jsdom
/**
 * Self-bound links (owner decision 2026-10-22): only a link bound by the SENDER skips the dancer-profile gate.
 * Self-bound and unbound links finish the profile first; a pre-#956 server (no self_bound key) behaves as before.
 * Redeem happens only from the Join click.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ProfileCompletion } from '@/lib/profileCompletion';

const TOKEN = 'cd'.repeat(32);
const h = vi.hoisted(() => ({
  completion: { status: 'complete', missing: [], profileId: 'p1' } as ProfileCompletion,
  rpc: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'ana@example.com' }, authStatus: 'ready', signOut: async () => 'signed_out' }) }));
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: () => ({ ...h.completion, refetch: async () => h.completion }),
  profileCompletionQueryKey: (id: string) => ['profile-completion', id],
}));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  },
}));

import InviteRedeemPage from '../InviteRedeemPage';

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const HINT = 'a***@example.com';
const LINKS: Array<[string, Record<string, unknown>, boolean]> = [
  ['unbound', {}, true],
  ['admin-bound', { email_hint: HINT, self_bound: false }, false],
  ['self-bound', { email_hint: HINT, self_bound: true }, true],
  ['bound, key absent (pre-#956)', { email_hint: HINT }, false],
];

beforeEach(() => {
  h.rpc.mockReset();
  window.history.replaceState(null, '', `/invite/${TOKEN}`);
});
afterEach(cleanup);

describe.each(LINKS)('%s link', (_name, extra, gated) => {
  const mount = (link: Record<string, unknown>) => {
    h.rpc.mockImplementation((fn: string) => (fn === 'organiser_invite_preview_v1' ? ok({ status: 'open', organiser_name: 'Ritmo', ...link }) : ok({})));
    return render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[`/invite/${TOKEN}`]}>
          <Routes>
            <Route path="/invite/:token" element={<InviteRedeemPage />} />
            <Route path="/finish-profile" element={<p data-testid="finish">finish</p>} />
            <Route path="*" element={<p data-testid="elsewhere">elsewhere</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('profile complete: the Join card renders, no redeem without a click', async () => {
    h.completion = { status: 'complete', missing: [], profileId: 'p1' };
    mount(extra);
    expect(await screen.findByTestId('invite-join')).toBeTruthy();
    expect(h.rpc).not.toHaveBeenCalledWith('redeem_organiser_invite_v1', expect.anything());
  });

  it(`profile incomplete: ${gated ? 'sent to finish the profile' : 'straight to the Join card'}`, async () => {
    h.completion = { status: 'incomplete', missing: ['first_name'], profileId: 'p1' };
    mount(extra);
    if (gated) {
      expect(await screen.findByTestId('finish')).toBeTruthy();
      expect(screen.queryByTestId('invite-join')).toBeNull();
    } else {
      expect(await screen.findByTestId('invite-join')).toBeTruthy();
    }
    expect(h.rpc).not.toHaveBeenCalledWith('redeem_organiser_invite_v1', expect.anything());
  });
});
