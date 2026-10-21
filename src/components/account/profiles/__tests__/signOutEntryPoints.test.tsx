// @vitest-environment jsdom
/**
 * Review #789 B1: EVERY sign-out button lands where it says, never on the sign-in form.
 *
 * Each row renders the real button inside the REAL AuthGuard, taps it, and reads the final
 * address. Signing out before leaving the guarded page let AuthGuard send the person to
 * /auth?mode=signin ("Welcome back") ahead of our own navigate (audit H10). The rows are the
 * review's list: Options, Account settings (sign out, sign out of all devices, delete),
 * restore (deleted card), plus the old /account home's sign-out, and the organiser area's two
 * (More's Sign out sheet, the first-time screen's "Not you? Sign out").
 */
import { useSyncExternalStore } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => {
  let user: { id: string; email: string } | null = { id: 'me', email: 'me@example.com' };
  const subs = new Set<() => void>();
  const calls: Array<{ everywhere: boolean }> = [];
  return {
    calls,
    get: () => user,
    set: (u: { id: string; email: string } | null) => {
      user = u;
      subs.forEach((f) => f());
    },
    subscribe: (f: () => void) => {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => {
    const user = useSyncExternalStore(store.subscribe, store.get);
    return {
      user,
      session: null,
      isLoading: false,
      authStatus: 'ready',
      retryAuth: () => {},
      // Like the real AuthProvider: the caller's `leave` runs before the in-memory sign-out;
      // then the auth listener nulls `user` (a tick later).
      signOut: async (opts?: { everywhere?: boolean; leave?: () => Promise<void> }) => {
        store.calls.push({ everywhere: Boolean(opts?.everywhere) });
        await opts?.leave?.();
        await new Promise((r) => setTimeout(r, 0));
        setTimeout(() => store.set(null), 0);
        return 'signed-out';
      },
    };
  },
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({}) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/lib/accountSettings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/accountSettings')>()),
  fetchEraseCheck: async () => ({ can_erase: true, blockers: [], code: null }),
  eraseAccount: async () => ({ kind: 'hidden' }),
}));

import { AuthGuard } from '@/components/auth/AuthGuard';
import SignOutConfirm from '@/modules/dancer-app/screens/options/SignOutConfirm';
import { Delete, SignOutSection } from '@/pages/AccountSettings';
import { DeletedCard } from '@/pages/AccountRestore';
import { SignOut as DancerHomeSignOut } from '@/components/account/DancerHome';
import { SignOutSheet as OrganiserMoreSignOut } from '@/modules/organiser/more/SignOutSheet';
import { SignOutLine as OrganiserOnboardingSignOut } from '@/modules/organiser/home/onboarding/SignOutLine';

/** The landing pages are lazy route modules, as in framework mode: the move there is not instant. */
const lazyPage = (testId: string) => async () => {
  await new Promise((r) => setTimeout(r, 40));
  return { Component: () => <p data-testid={testId}>{testId}</p> };
};

const tap = async (id: string) => {
  await waitFor(() => expect(screen.getByTestId(id)).toBeTruthy());
  await act(async () => fireEvent.click(screen.getByTestId(id)));
};

type Row = {
  name: string;
  start: string;
  page: JSX.Element;
  steps: (() => Promise<void>)[];
  lands: string;
  everywhere: boolean;
};

const ROWS: Row[] = [
  {
    name: 'Options: Sign out',
    start: '/app/options',
    page: <SignOutConfirm onBusyChange={() => {}} />,
    steps: [() => tap('opt-signout-confirm')],
    lands: '/',
    everywhere: false,
  },
  {
    name: 'Account settings: Sign out -> Yes, sign out',
    start: '/account/settings?from=app',
    page: <SignOutSection />,
    steps: [() => tap('settings-signout'), () => tap('settings-signout-yes')],
    lands: '/',
    everywhere: false,
  },
  {
    name: 'Account settings: Sign out of all devices',
    start: '/account/settings?from=app',
    page: <SignOutSection />,
    steps: [() => tap('settings-signout-all'), () => tap('settings-signout-all-confirm')],
    lands: '/',
    everywhere: true,
  },
  {
    name: 'Account settings: Delete my account',
    start: '/account/settings/delete?from=app',
    page: <Delete />,
    steps: [
      async () => {
        await waitFor(() => expect(screen.getByTestId('delete-type-input')).toBeTruthy());
        fireEvent.change(screen.getByTestId('delete-type-input'), { target: { value: 'DELETE' } });
      },
      () => tap('delete-confirm'),
    ],
    lands: '/account/deleted',
    everywhere: true,
  },
  {
    name: 'Restore (deleted, expired): Sign out',
    start: '/account/restore',
    page: <DeletedCard deletedAt="2026-08-01T10:00:00Z" />,
    steps: [() => tap('restore-signout')],
    lands: '/',
    everywhere: false,
  },
  {
    name: '/account home: Sign out -> Yes, sign out',
    start: '/account',
    page: <DancerHomeSignOut email="me@example.com" />,
    steps: [() => tap('dancer-home-signout-start'), () => tap('dancer-home-signout-yes')],
    lands: '/',
    everywhere: false,
  },
  {
    name: 'Organiser More: Sign out -> Yes, sign out',
    start: '/account/o/more',
    page: <OrganiserMoreSignOut open onClose={() => {}} />,
    steps: [() => tap('signout-yes')],
    lands: '/',
    everywhere: false,
  },
  {
    name: 'Organiser first-time screen: Not you? Sign out -> Yes, sign out',
    start: '/account/o',
    page: <OrganiserOnboardingSignOut email="me@example.com" />,
    steps: [() => tap('onboarding-signout'), () => tap('onboarding-signout-yes')],
    lands: '/',
    everywhere: false,
  },
];

afterEach(() => {
  cleanup();
  store.calls.length = 0;
});

describe('every sign-out button lands on its page, never /auth (real AuthGuard)', () => {
  it.each(ROWS)('$name', async (row) => {
    store.set({ id: 'me', email: 'me@example.com' });
    const router = createMemoryRouter(
      [
        { path: '/app/*', element: <AuthGuard>{row.page}</AuthGuard> },
        { path: '/account/*', element: <AuthGuard>{row.page}</AuthGuard> },
        { path: '/account/deleted', lazy: lazyPage('deleted') },
        { path: '/', lazy: lazyPage('site-home') },
        { path: '/auth', element: <p data-testid="auth">auth</p> },
      ],
      { initialEntries: [row.start] },
    );
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    for (const step of row.steps) await step();
    await waitFor(() => expect(store.get()).toBeNull());
    await act(async () => new Promise((r) => setTimeout(r, 150)));
    expect(router.state.location.pathname).toBe(row.lands);
    expect(screen.queryByTestId('auth')).toBeNull();
    expect(store.calls).toEqual([{ everywhere: row.everywhere }]);
  });
});
