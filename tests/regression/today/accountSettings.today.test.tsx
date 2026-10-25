// @vitest-environment jsdom
/**
 * TODAY's /account/settings, /account/settings/ownership, /account/settings/delete
 * and /account/deleted (src/pages/AccountSettings.tsx, AccountDeleted.tsx), pinned
 * as the accessible tree for every view x shape, at 390x844 and desktop, with the
 * hide/show switch states and the delete (= hide, admin PR #820) flow (mocked RPCs, exactly the
 * mocks src/pages/__tests__/AccountSettings.test.tsx uses).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { installJsdomPolyfills } from '../../client/jsdomPolyfills';
import { a11yTree } from './helpers/a11yTree';
import { VIEWPORTS, setViewport } from './helpers/viewports';

const h = vi.hoisted(() => ({
  visibility: { status: 'visible' as string },
  check: { can_erase: true, blockers: [] as { entity_id: string; name: string }[], code: null as string | null },
  setDisabled: vi.fn(),
  erase: vi.fn(),
  signOut: vi.fn(),
  user: { id: 'u1', email: 'me@x.co', new_email: undefined as string | undefined },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: h.user, session: {}, isLoading: false, authStatus: 'ready', signOut: h.signOut }),
}));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/hooks/useMyProfileVisibility', () => ({
  useMyProfileVisibility: () => ({ status: h.visibility.status, refetch: vi.fn() }),
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ auth: { updateUser: vi.fn() } }) }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: async () => ({ data: null, error: null }) }));
vi.mock('@/lib/accountSettings', async (orig) => {
  const real = await orig<typeof import('@/lib/accountSettings')>();
  return {
    ...real,
    fetchEraseCheck: async () => h.check,
    setProfileDisabled: (v: boolean) => h.setDisabled(v),
    eraseAccount: () => h.erase(),
  };
});

import AccountSettings from '@/pages/AccountSettings';
import AccountDeleted from '@/pages/AccountDeleted';

const mount = (at: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/account/settings" element={<AccountSettings view="home" />} />
          <Route path="/account/settings/ownership" element={<AccountSettings view="ownership" />} />
          <Route path="/account/settings/delete" element={<AccountSettings view="delete" />} />
          <Route path="/account/deleted" element={<AccountDeleted />} />
          <Route path="/" element={<p>start</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const settleTree = async (readyTestId: string) => {
  await screen.findByTestId(readyTestId);
  await new Promise((r) => setTimeout(r, 40));
  return a11yTree();
};

const PROFILE_STATES = ['none', 'visible', 'hidden'] as const;
const CHECKS = {
  'plain dancer': { can_erase: true, blockers: [], code: null },
  'sole organiser owner': { can_erase: false, blockers: [{ entity_id: 'o1', name: 'Salsa Nights' }], code: 'sole_organiser_owner' },
  admin: { can_erase: false, blockers: [], code: 'admin_account' },
} as const;

beforeEach(() => {
  installJsdomPolyfills();
  h.visibility = { status: 'visible' };
  h.check = { can_erase: true, blockers: [], code: null };
  h.user = { id: 'u1', email: 'me@x.co', new_email: undefined };
  h.setDisabled.mockReset();
  h.erase.mockReset();
  h.signOut.mockReset().mockResolvedValue('signed-out');
});
afterEach(cleanup);

describe.each(VIEWPORTS)('account settings at $name', (vp) => {
  beforeEach(() => setViewport(vp));

  describe('/account/settings (home)', () => {
    it.each(PROFILE_STATES)('profile %s', async (status) => {
      h.visibility = { status };
      mount('/account/settings');
      expect(await settleTree('settings-signout')).toMatchSnapshot();
    });
    it('pending email change on arrival', async () => {
      h.user = { id: 'u1', email: 'me@x.co', new_email: 'later@x.co' };
      mount('/account/settings');
      expect(await settleTree('settings-email-pending')).toMatchSnapshot();
    });
    it('hide switch: confirm step, then the hidden state', async () => {
      h.setDisabled.mockResolvedValue({ ok: true, disabled: true });
      mount('/account/settings');
      fireEvent.click(await screen.findByTestId('settings-disable-toggle'));
      await screen.findByTestId('settings-disable-confirm');
      expect(a11yTree()).toMatchSnapshot('confirm step');
      fireEvent.click(screen.getByTestId('settings-disable-confirm'));
      await waitFor(() => expect(h.setDisabled).toHaveBeenCalledWith(true));
      await screen.findByTestId('settings-disable-state');
      expect(a11yTree()).toMatchSnapshot('after hide');
    });
    it('show switch: hidden profile, one tap calls the RPC with false', async () => {
      h.visibility = { status: 'hidden' };
      h.setDisabled.mockResolvedValue({ ok: true, disabled: false });
      mount('/account/settings');
      fireEvent.click(await screen.findByTestId('settings-disable-toggle'));
      await waitFor(() => expect(h.setDisabled).toHaveBeenCalledWith(false));
    });
    it('hide with no_profile error shows the reason', async () => {
      h.setDisabled.mockResolvedValue({ ok: false, code: 'no_profile' });
      mount('/account/settings');
      fireEvent.click(await screen.findByTestId('settings-disable-toggle'));
      fireEvent.click(await screen.findByTestId('settings-disable-confirm'));
      // Review S5: the open sheet says it once; the line under the section waits until the sheet closes.
      await screen.findByTestId('settings-disable-sheet-error');
      expect(screen.queryByTestId('settings-disable-error')).toBeNull();
      expect(screen.getAllByRole('alert').filter((n) => /nothing to hide/.test(n.textContent ?? ''))).toHaveLength(1);
      expect(a11yTree()).toMatchSnapshot();
    });
  });

  describe.each(Object.entries(CHECKS))('check: %s', (_role, check) => {
    it('/account/settings/ownership', async () => {
      h.check = { ...check, blockers: [...check.blockers] };
      // Audit M21: the ownership step is gone; its old address shows the delete view.
      mount('/account/settings/ownership');
      expect(await settleTree('delete-confirm')).toMatchSnapshot();
    });
    it('/account/settings/delete', async () => {
      h.check = { ...check, blockers: [...check.blockers] };
      mount('/account/settings/delete');
      await screen.findByTestId('delete-confirm');
      expect((screen.getByTestId('delete-confirm') as HTMLButtonElement).disabled).toBe(true);
      expect(await settleTree('delete-confirm')).toMatchSnapshot();
    });
  });

  describe('/account/settings/delete: the delete (= hide) flow', () => {
    it('delete is disabled until DELETE is typed exactly, then hides, signs out, lands on /account/deleted', async () => {
      h.erase.mockResolvedValue({ kind: 'hidden' });
      mount('/account/settings/delete');
      const input = await screen.findByTestId('delete-type-input');
      const btn = screen.getByTestId('delete-confirm') as HTMLButtonElement;
      // Audit L19: surrounding spaces are trimmed (' DELETE ' arms it; AccountSliceB pins that).
      for (const v of ['', 'delete', 'Delete', 'DELET']) {
        fireEvent.change(input, { target: { value: v } });
        expect(btn.disabled, `"${v}"`).toBe(true);
      }
      fireEvent.change(input, { target: { value: 'DELETE' } });
      expect(btn.disabled).toBe(false);
      expect(a11yTree()).toMatchSnapshot('armed');
      fireEvent.click(btn);
      await waitFor(() => expect(h.erase).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(h.signOut).toHaveBeenCalled());
      await screen.findByRole('heading', { level: 1 });
      expect(a11yTree()).toMatchSnapshot('deleted page');
    });
    it.each([
      ['sole_organiser_owner', { kind: 'refused', code: 'sole_organiser_owner', blockers: [{ entity_id: 'o1', name: 'Salsa Nights' }] }],
      ['admin_account', { kind: 'refused', code: 'admin_account', blockers: [] }],
      ['already_archived', { kind: 'refused', code: 'already_archived', blockers: [] }],
      ['rate_limited', { kind: 'refused', code: 'rate_limited', blockers: [] }],
      ['failed', { kind: 'failed' }],
    ])('a %s delete stays on the page, does not sign out, and says so', async (_n, outcome) => {
      h.erase.mockResolvedValue(outcome);
      mount('/account/settings/delete');
      fireEvent.change(await screen.findByTestId('delete-type-input'), { target: { value: 'DELETE' } });
      fireEvent.click(screen.getByTestId('delete-confirm'));
      await waitFor(() => expect(h.erase).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 60));
      expect(h.signOut).not.toHaveBeenCalled();
      expect(a11yTree()).toMatchSnapshot();
    });
  });

  it('/account/deleted', async () => {
    mount('/account/deleted');
    await screen.findByRole('heading', { level: 1 });
    expect(a11yTree()).toMatchSnapshot();
  });
});
