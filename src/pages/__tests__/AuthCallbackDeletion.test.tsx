// @vitest-environment jsdom
/**
 * Review B1: EVERY sign-in restores a deleted (= hidden) account first -- with a returnTo on the
 * link, a returnTo stashed before the e-mail went out, or none. The sign-in that is meant to undo
 * a delete must never land on a page and leave the account hidden. The returnTo rides along to
 * /account/restore, whose Continue goes there once restored. A failed status read never blocks.
 * The Supabase client and rpcLoose are mocked; nothing here touches a network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  status: null as unknown,
  statusFails: false,
  restore: { restored: true, code: null } as unknown,
  user: { id: 'u1', user_metadata: {} as Record<string, unknown> },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    auth: {
      getSession: async () => ({ data: { session: { user: h.user } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: async (fn: string) => {
    if (fn === 'my_account_deletion_status_v1') return h.statusFails ? { data: null, error: { message: 'offline' } } : { data: h.status, error: null };
    if (fn === 'my_account_restore_v1') return { data: h.restore, error: null };
    return { data: null, error: { message: `not mocked: ${fn}` } };
  },
}));
vi.mock('@/lib/featureFlags', () => ({ flags: { organiserSelfServe: true } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));

import AuthCallback from '../AuthCallback';
import { AccountRestoreScreen } from '../AccountRestore';

const PENDING = { state: 'pending', requested_at: '2026-10-01T10:00:00Z', restore_until: '2026-10-31T10:00:00Z' };
const EXPIRED = { state: 'expired', requested_at: '2026-08-01T10:00:00Z', restore_until: '2026-08-31T10:00:00Z' };
const NONE = { state: 'none', requested_at: null, restore_until: null };

function Landed() {
  const location = useLocation();
  return <div data-testid="landed">{`${location.pathname}${location.search}`}</div>;
}

const mount = (at: string, ui: ReactNode, path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<Landed />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  h.status = NONE;
  h.statusFails = false;
  h.restore = { restored: true, code: null };
});
afterEach(cleanup);

// [label, link returnTo, stashed returnTo, the returnTo the restore page must carry]
const ROUTES: Array<[string, string | null, string | null, string | null]> = [
  ['returnTo on the link (an event page)', '/event/e1', null, '/event/e1'],
  ['returnTo stashed before the e-mail', null, '/event/e1', '/event/e1'],
  ['no returnTo', null, null, null],
];

describe('AuthCallback: a deleted account restores before anything else', () => {
  it.each(ROUTES.flatMap(([l, link, stash, carry]) => [[`pending x ${l}`, PENDING, link, stash, carry] as const, [`expired x ${l}`, EXPIRED, link, stash, carry] as const]))(
    '%s -> /account/restore',
    async (_l, status, link, stash, carry) => {
      h.status = status;
      if (stash) localStorage.setItem('auth_pending_return_to', stash);
      mount(`/auth/callback?mode=signin${link ? `&returnTo=${encodeURIComponent(link)}` : ''}`, <AuthCallback />, '/auth/callback');
      const landed = await screen.findByTestId('landed');
      const want = carry ? `/account/restore?returnTo=${encodeURIComponent(carry)}` : '/account/restore';
      await waitFor(() => expect(landed.textContent).toBe(want));
    },
  );

  it.each([
    ['none', () => { h.status = NONE; }],
    ['a failed status read', () => { h.statusFails = true; }],
  ])('%s carries on to the returnTo, never the restore page', async (_l, arrange) => {
    arrange();
    mount(`/auth/callback?mode=signin&returnTo=${encodeURIComponent('/event/e1')}`, <AuthCallback />, '/auth/callback');
    const landed = await screen.findByTestId('landed');
    await waitFor(() => expect(landed.textContent).not.toBe(''));
    expect(landed.textContent).not.toMatch(/^\/account\/restore/);
  });
});

describe('/account/restore: Continue goes where the sign-in was headed', () => {
  it.each([
    ['/account/restore?returnTo=%2Fevent%2Fe1', '/event/e1'],
    ['/account/restore', '/account/continue'],
    ['/account/restore?returnTo=%2F%2Fevil.com', '/account/continue'],
  ])('%s -> Continue to %s', async (at, to) => {
    h.status = PENDING;
    mount(at, <AccountRestoreScreen />, '/account/restore');
    const link = await screen.findByTestId('restore-continue');
    expect(link.getAttribute('href')).toBe(to);
  });
});
