// @vitest-environment jsdom
/**
 * M57 (owner decision): a team invite is bearer-style -- whoever is signed in
 * when it is used joins. So BEFORE the link is used, the card names who is
 * joining ("You are joining as <name>": dancer first name, else display name,
 * else the e-mail) and offers "Not you? Sign out", which signs out through the
 * one shared path and goes to this invite's sign-in, the link still unused.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const TOKEN = 'ab'.repeat(32);
const h = vi.hoisted(() => ({
  user: { id: 'u-b', email: 'b@example.com', user_metadata: {} as Record<string, unknown> },
  row: null as null | { first_name: string | null; display_name: string | null },
  rpc: vi.fn(),
  signOut: vi.fn(),
  reads: [] as string[],
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: h.user, session: null, isLoading: false, authStatus: 'ready', signOut: h.signOut }),
}));
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: () => ({ status: 'complete', missing: [], profileId: 'persona-b', refetch: async () => ({ status: 'complete', missing: [], profileId: 'persona-b' }) }),
}));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: (table: string) => ({
      select: () => ({
        eq: (_c: string, id: string) => ({
          maybeSingle: async () => {
            h.reads.push(`${table}:${id}`);
            return { data: h.row, error: null };
          },
        }),
      }),
    }),
  },
}));

import InviteRedeemPage from '../InviteRedeemPage';

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
          {/* Arc 1 7c: a new seat lands on the welcome (1d for a first page, 7c for another). */}
          <Route path="/account/o/welcome" element={<p data-testid="landed">dashboard</p>} />
          <Route path="/auth" element={<p data-testid="auth">auth</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.user = { id: 'u-b', email: 'b@example.com', user_metadata: {} };
  h.row = { first_name: 'Bea', display_name: 'Bea Bloggs' };
  h.reads = [];
  h.rpc.mockReset();
  h.rpc.mockImplementation((fn: string) =>
    fn === 'redeem_organiser_invite_v1'
      ? Promise.resolve({ data: { ok: true, status: 'redeemed', organiser_id: 'o1', member_role: 'owner' }, error: null })
      : Promise.reject(new Error(fn)),
  );
  h.signOut.mockReset();
  h.signOut.mockResolvedValue('signed-out');
  window.history.replaceState(null, '', `/invite/${TOKEN}`);
});
afterEach(cleanup);

const redeemCalls = () => h.rpc.mock.calls.filter((c) => c[0] === 'redeem_organiser_invite_v1');

describe('the invite card names who is joining, before the link is used', () => {
  it.each([
    ['dancer first name', { first_name: 'Bea', display_name: 'Bea Bloggs' }, 'You are joining as Bea'],
    ['display name when no first name', { first_name: '  ', display_name: 'Bea Bloggs' }, 'You are joining as Bea Bloggs'],
    ['the e-mail when no name at all', { first_name: null, display_name: null }, 'You are joining as b@example.com'],
    ['the e-mail when the row cannot be read', null, 'You are joining as b@example.com'],
  ] as const)('%s', async (_n, row, want) => {
    h.row = row;
    mount();
    expect((await screen.findByTestId('invite-joining-as')).textContent).toBe(want);
    expect(screen.getByTestId('invite-not-you').textContent).toMatch(/Not you\? Sign out/);
    // Nothing is used until the person says so.
    expect(redeemCalls()).toHaveLength(0);
    expect(h.reads).toContain('dancer_profiles:persona-b');
  });

  it('Join uses the link once and lands on the organiser home (the bearer joins)', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    expect(await screen.findByTestId('landed')).toBeTruthy();
    expect(redeemCalls()).toHaveLength(1);
    expect(h.rpc).toHaveBeenCalledWith('redeem_organiser_invite_v1', { p_token: TOKEN });
  });

  it('"Not you? Sign out": shared sign-out, then this invite\'s sign-in; the link is not used', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('invite-not-you'));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(`/auth?mode=signin&returnTo=${encodeURIComponent(`/invite/${TOKEN}`)}`));
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(redeemCalls()).toHaveLength(0);
  });

  it('a failed sign-out stays on the card and says so', async () => {
    h.signOut.mockResolvedValue('failed');
    mount();
    fireEvent.click(await screen.findByTestId('invite-not-you'));
    expect((await screen.findByTestId('invite-signout-error')).textContent).toMatch(/still signed in/i);
    expect(screen.getByTestId('location').textContent).toBe(`/invite/${TOKEN}`);
    expect(redeemCalls()).toHaveLength(0);
  });
});
