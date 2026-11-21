// @vitest-environment jsdom
/**
 * Dancer layout C, S3: Sign out is ONE quiet link at the very bottom of Account settings
 * when DANCER_LAYOUT_C_ENABLED (or dashboardSwitchR4) is on. Flag matrix x control count x position x flow.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const h = vi.hoisted(() => ({
  signOut: vi.fn(),
  c: false,
  r4: false,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'me@x.co' }, session: {}, isLoading: false, authStatus: 'ready', signOut: h.signOut }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/hooks/useMyProfileVisibility', () => ({ useMyProfileVisibility: () => ({ status: 'visible', refetch: vi.fn() }) }));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ auth: { updateUser: vi.fn() } }) }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: async () => ({ data: {}, error: null }) }));
vi.mock('@/lib/accountSettings', async (orig) => ({
  ...(await orig<typeof import('@/lib/accountSettings')>()),
  fetchEraseCheck: async () => ({ can_erase: true, blockers: [], code: null }),
}));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  return { ...real, flags: new Proxy(real.flags, { get: (t, k) => (k === 'dashboardSwitchR4' ? h.r4 : (t as Record<string | symbol, unknown>)[k]) }) };
});
vi.mock('@/modules/dancer-app/screens/home/layoutCFlag', () => ({
  get DANCER_LAYOUT_C_ENABLED() {
    return h.c;
  },
}));

const mount = async () => {
  const { default: AccountSettings } = await import('@/pages/AccountSettings');
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/account/settings']}>
        <Routes>
          <Route path="/account/settings" element={<AccountSettings view="home" />} />
          <Route path="/" element={<p>start</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  h.signOut.mockReset().mockResolvedValue('signed-out');
});
afterEach(cleanup);

const signOutControls = () =>
  screen.getAllByRole('button').filter((b) => (b.textContent ?? '').trim() === 'Sign out');

describe('Account settings Sign out x layout C flag x dashboardSwitchR4', () => {
  for (const c of [false, true]) {
    for (const r4 of [false, true]) {
      it(`C=${c} R4=${r4}: exactly one Sign out control${c || r4 ? ', last on the page, quiet' : ', the card button'}`, async () => {
        h.c = c;
        h.r4 = r4;
        await mount();
        await screen.findByTestId('settings-delete');
        expect(signOutControls()).toHaveLength(1);
        const btn = signOutControls()[0];
        expect(screen.getAllByTestId('settings-signout')).toHaveLength(1);
        const all = screen.getByTestId('settings-signout-all');
        const del = screen.getByTestId('settings-delete');
        const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
        if (c || r4) {
          expect(screen.getByTestId('settings-signout-foot')).toBeTruthy();
          expect(follows(all, btn)).toBe(true);
          expect(follows(del, btn)).toBe(true);
          const buttons = screen.getAllByRole('button');
          expect(buttons[buttons.length - 1]).toBe(btn);
        } else {
          expect(screen.queryByTestId('settings-signout-foot')).toBeNull();
          expect(follows(del, btn)).toBe(true);
        }
        // "Sign out of all devices" stays in the page either way.
        expect(all).toBeTruthy();
      });
    }
  }

  it('C on: tap asks "Sign out?", confirm signs out and leaves to home', async () => {
    h.c = true;
    h.r4 = false;
    await mount();
    fireEvent.click(await screen.findByTestId('settings-signout'));
    expect(h.signOut).not.toHaveBeenCalled();
    expect(await screen.findByText('Sign out?')).toBeTruthy();
    fireEvent.click(screen.getByTestId('settings-signout-yes'));
    await waitFor(() => expect(h.signOut).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('start')).toBeTruthy();
  });

  it('C on: a failed sign out shows SIGN_OUT_FAILED inline', async () => {
    h.c = true;
    h.r4 = false;
    h.signOut.mockResolvedValue('failed');
    const { SIGN_OUT_FAILED } = await import('@/components/account/profiles/signOutToHome');
    await mount();
    fireEvent.click(await screen.findByTestId('settings-signout'));
    fireEvent.click(await screen.findByTestId('settings-signout-yes'));
    expect((await screen.findByRole('alert')).textContent).toBe(SIGN_OUT_FAILED);
  });
});
