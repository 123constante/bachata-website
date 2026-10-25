// @vitest-environment jsdom
/**
 * RELEASE-A-WEB review, group A fix pass, AuthCallback side:
 * - finding 7: the "You now manage X" notice never sits over Home. Landing on organiser Home, no
 *   toast is raised at all; the notice is kept (sessionStorage) for Home to draw in its own flow
 *   with a 44 px Close. Landing anywhere else (an explicit or stashed return path, D37), a SHORT
 *   toast says it there; no claim toast ever has `duration: Infinity`.
 * - finding 15: the deleted-account restore check runs BEFORE the organiser claim; a hidden
 *   account goes to restore without claiming anything.
 * - finding 17: a mixed claim answer (one good row + one nameless) keeps the good page.
 * The Supabase client, rpcLoose and the deletion read are mocked; nothing touches a network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const h = vi.hoisted(() => ({
  order: [] as string[],
  restoreTo: null as string | null,
  rpcLoose: vi.fn(),
  toast: vi.fn(),
  maybeSingle: vi.fn(),
  user: { id: 'u1', user_metadata: {} as Record<string, unknown> },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: h.maybeSingle }) }) }),
    auth: {
      getSession: async () => ({ data: { session: { user: h.user } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: (fn: string) => {
    h.order.push(fn);
    return h.rpcLoose(fn);
  },
}));
vi.mock('@/lib/claimMyDancerProfile', () => ({
  claimAtSignIn: async () => ({ status: 'no_match', profileId: null }),
  shouldArmFinishHop: () => false,
}));
vi.mock('@/lib/myPersona', () => ({ fetchMyPersonaId: async () => 'p1' }));
vi.mock('@/lib/accountDeletion', () => ({
  signInDeletionTarget: async () => {
    h.order.push('signInDeletionTarget');
    return h.restoreTo;
  },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: h.toast }));
vi.mock('@/lib/featureFlags', () => ({ flags: { organiserSelfServe: true } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

import AuthCallback from '../AuthCallback';
import * as claimLib from '@/lib/claimMyOrganisers';
import { AUTH_PENDING_RETURN_TO_KEY } from '@/lib/authRouting';

const COMPLETE = { id: 'p1', first_name: 'Ana', based_city_id: 'c1', dance_role: 'follower' };
const CLAIM = 'claim_my_organisers_v1';
const answer = (claimed: unknown) => h.rpcLoose.mockImplementation(async (fn: string) => (fn === CLAIM ? { data: { status: 'claimed', claimed }, error: null } : { data: null, error: { message: 'not mocked' } }));

function Landed() {
  const l = useLocation();
  return <div data-testid="landed">{l.pathname}</div>;
}
const mount = (entry = '/auth/callback?mode=signin') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<Landed />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
const landedAt = async (path: string) => {
  const landed = await screen.findByTestId('landed');
  await waitFor(() => expect(landed.textContent).toBe(path));
};
const stashed = () => (typeof claimLib.readClaimNotice === 'function' ? claimLib.readClaimNotice() : []);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  h.order = [];
  h.restoreTo = null;
  h.rpcLoose.mockReset();
  h.toast.mockReset();
  h.maybeSingle.mockReset();
  h.maybeSingle.mockResolvedValue({ data: COMPLETE, error: null });
});
afterEach(cleanup);

describe('claim notice never covers Home (finding 7)', () => {
  it('landing on organiser Home: no toast, the notice is kept for Home to draw in flow', async () => {
    answer([{ organiser_id: 'o1', name: 'Ritmo' }]);
    mount();
    await landedAt('/account/o');
    expect(h.toast).not.toHaveBeenCalled();
    expect(stashed()).toEqual([{ organiserId: 'o1', name: 'Ritmo' }]);
  });

  it.each([
    ['returnTo an event page', `/auth/callback?mode=signin&returnTo=${encodeURIComponent('/event/e1')}`, null, '/event/e1'],
    ['stashed return path', '/auth/callback?mode=signin', '/event/e2', '/event/e2'],
  ])('%s: a short toast says it there, and Home keeps it too', async (_label, entry, stash, lands) => {
    answer([{ organiser_id: 'o1', name: 'Ritmo' }]);
    if (stash) localStorage.setItem(AUTH_PENDING_RETURN_TO_KEY, stash);
    mount(entry);
    await landedAt(lands);
    expect(h.toast).toHaveBeenCalledTimes(1);
    const t = h.toast.mock.calls[0][0];
    expect(t.title).toBe('You now manage Ritmo.');
    expect(Number.isFinite(t.duration)).toBe(true);
    expect(t.duration).toBeLessThanOrEqual(10_000);
    expect(stashed()).toEqual([{ organiserId: 'o1', name: 'Ritmo' }]);
  });

  it('no claim: nothing kept, no toast', async () => {
    answer([]);
    mount();
    await landedAt('/account/continue');
    expect(h.toast).not.toHaveBeenCalled();
    expect(stashed()).toEqual([]);
  });

  it('no claim toast is ever raised with duration Infinity', () => {
    const src = readFileSync(join(__dirname, '..', 'AuthCallback.tsx'), 'utf8');
    expect(src).not.toMatch(/duration:\s*Infinity/);
  });
});

describe('restore check runs before the organiser claim (finding 15)', () => {
  it('a hidden account goes to restore and claims nothing', async () => {
    h.restoreTo = '/account/restore';
    answer([{ organiser_id: 'o1', name: 'Ritmo' }]);
    mount();
    await landedAt('/account/restore');
    expect(h.order).toContain('signInDeletionTarget');
    expect(h.order).not.toContain(CLAIM);
    expect(h.toast).not.toHaveBeenCalled();
    expect(stashed()).toEqual([]);
  });
  it('an account that is not hidden: the restore check first, then the claim', async () => {
    answer([{ organiser_id: 'o1', name: 'Ritmo' }]);
    mount();
    await landedAt('/account/o');
    expect(h.order.indexOf('signInDeletionTarget')).toBeGreaterThanOrEqual(0);
    expect(h.order.indexOf('signInDeletionTarget')).toBeLessThan(h.order.indexOf(CLAIM));
  });
});

describe('mixed claim answer (finding 17)', () => {
  const MIXED = [{ organiser_id: 'o1', name: 'Ritmo' }, { organiser_id: 'o2' }, { organiser_id: 'o3', name: '   ' }, null, { name: 'No id' }];
  it('the parser keeps the good row and drops the rest without throwing', () => {
    expect(claimLib.parseClaimedOrganisers({ status: 'claimed', claimed: MIXED })).toEqual([{ organiserId: 'o1', name: 'Ritmo' }]);
  });
  it('sign-in keeps "You now manage Ritmo."', async () => {
    answer(MIXED);
    mount(`/auth/callback?mode=signin&returnTo=${encodeURIComponent('/event/e1')}`);
    await landedAt('/event/e1');
    expect(h.toast.mock.calls[0]?.[0].title).toBe('You now manage Ritmo.');
  });
});
