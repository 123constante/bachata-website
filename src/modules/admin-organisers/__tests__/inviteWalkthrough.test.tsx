// @vitest-environment jsdom
/**
 * The invite walkthrough, as a table: who opens the link x what the link looks
 * like. Rendered against the REAL DancerProfileGate and the REAL InviteRedeemPage;
 * only the network is faked (pages/__tests__/helpers/dancerBackend.ts).
 *
 *   {signed out, signed in no_profile, incomplete, complete} x {valid, malformed token}
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { FULL, makeBackend, type BackendState, type DancerRow } from '@/pages/__tests__/helpers/dancerBackend';

const h = vi.hoisted(() => ({
  backend: null as unknown as { client: unknown },
  user: null as null | { id: string; email: string; is_anonymous: boolean },
  redeem: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return h.backend.client;
  },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => h.backend.client }));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, session: null, isLoading: false, authStatus: 'ready', signOut: async () => 'signed_out' }),
}));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

import InviteRedeemPage from '../InviteRedeemPage';
import { finishProfileHref } from '@/lib/profileCompletion';

const VALID = 'ef'.repeat(32);
const MALFORMED = 'not-a-token';
const SIGNED_IN = { id: 'u1', email: 'ana@example.com', is_anonymous: false };
const STUB: DancerRow = { first_name: null, based_city_id: null, dance_role: null, avatar_url: null, archived_at: null };

const STATES: { name: string; user: typeof h.user; row: DancerRow | null }[] = [
  { name: 'signed out', user: null, row: null },
  { name: 'signed in, no_profile', user: SIGNED_IN, row: null },
  { name: 'signed in, incomplete', user: SIGNED_IN, row: { ...STUB, first_name: 'Ana' } },
  { name: 'signed in, complete', user: SIGNED_IN, row: { ...FULL } },
];

function mount(row: DancerRow | null, at: string) {
  const state: BackendState = { row, organisers: 0, requests: [] };
  const backend = makeBackend(state);
  const baseRpc = backend.client.rpc;
  backend.client.rpc = (name: string, args?: Record<string, unknown>) => {
    if (name === 'redeem_organiser_invite_v1') return h.redeem(args);
    return baseRpc(name, args);
  };
  h.backend = backend;
  const visited: string[] = [];
  function Probe() {
    const { pathname, search } = useLocation();
    const here = `${pathname}${search}`;
    if (visited[visited.length - 1] !== here) visited.push(here);
    return <p data-testid="location">{here}</p>;
  }
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>
        <Probe />
        <Routes>
          <Route path="/invite/:token" element={<InviteRedeemPage />} />
          <Route path="*" element={<p data-testid="elsewhere">elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return visited;
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  h.redeem.mockReset();
  h.redeem.mockResolvedValue({ data: { ok: true, status: 'redeemed', organiser_id: 'org-1' }, error: null });
});
afterEach(cleanup);

describe.each(STATES)('$name', ({ user, row }) => {
  beforeEach(() => { h.user = user; });
  const complete = !!user && !!row && row.first_name && row.based_city_id && row.dance_role && row.avatar_url;

  it('valid token', async () => {
    const visited = mount(row, `/invite/${VALID}`);
    if (!user) {
      expect(await screen.findByTestId('invite-sign-in')).toBeTruthy();
      expect(h.redeem).not.toHaveBeenCalled();
      expect(visited).toEqual([`/invite/${VALID}`]);
    } else if (!complete) {
      await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(finishProfileHref(`/invite/${VALID}`)));
      expect(screen.getByTestId('location').textContent).toBe(`/finish-profile?returnTo=${encodeURIComponent(`/invite/${VALID}`)}`);
      expect(h.redeem).not.toHaveBeenCalled();
    } else {
      // M57: the joining-as card first; the link is used on Join.
      expect((await screen.findByTestId('invite-joining-as')).textContent).toBe('You are joining as Ana');
      expect(h.redeem).not.toHaveBeenCalled();
      fireEvent.click(await screen.findByTestId('invite-join'));
      await waitFor(() => expect(h.redeem).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByTestId('elsewhere')).not.toBeNull());
      expect(h.redeem).toHaveBeenCalledTimes(1);
    }
  });

  it('malformed token: the invalid card, redeem never called, no navigation', async () => {
    const visited = mount(row, `/invite/${MALFORMED}`);
    expect((await screen.findByTestId('invite-title')).textContent).toBe('This link does not work');
    expect(screen.queryByTestId('invite-sign-in')).toBeNull();
    expect(h.redeem).not.toHaveBeenCalled();
    expect(visited).toEqual([`/invite/${MALFORMED}`]);
  });
});

describe('the server refuses with profile_incomplete (a stale client gate)', () => {
  it('shows the finish-profile card, keeps the token, and is not the dead-end fallback', async () => {
    h.user = SIGNED_IN;
    h.redeem.mockResolvedValue({ data: null, error: { message: 'profile_incomplete' } });
    mount({ ...FULL }, `/invite/${VALID}`);
    fireEvent.click(await screen.findByTestId('invite-join'));
    expect((await screen.findByTestId('invite-title')).textContent).toBe('Finish your dancer profile first');
    const link = screen.getByTestId('invite-finish-profile');
    expect(link.getAttribute('href')).toBe(finishProfileHref(`/invite/${VALID}`));
    expect(screen.queryByTestId('invite-retry')).toBeNull();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });
});
