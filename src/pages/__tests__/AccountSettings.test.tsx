// @vitest-environment jsdom
/**
 * Account settings: every screen x (no profile | unfinished | finished | hidden)
 * x (plain dancer | organiser with co-owner | sole organiser owner | admin).
 * The same fact reads the same on every screen; a control that cannot work is
 * disabled WITH a reason; erase stays disabled until DELETE is typed exactly.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const h = vi.hoisted(() => ({
  visibility: { status: 'visible' as string },
  check: { can_erase: true, blockers: [] as { entity_id: string; name: string }[], code: null as string | null },
  exportData: { exported_at: '2026-10-13T00:00:00Z', email: 'a@b.co', profile: null, roles: {}, ratings: [], attendance: [] } as unknown,
  setDisabled: vi.fn(),
  erase: vi.fn(),
  exportFn: vi.fn(),
  updateUser: vi.fn(),
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
vi.mock('@/integrations/supabase/getSupabase', () => ({
  getSupabase: async () => ({ auth: { updateUser: (...a: unknown[]) => h.updateUser(...a) } }),
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: async () => ({ data: await h.exportFn(), error: null }),
}));
vi.mock('@/lib/accountSettings', async (orig) => {
  const real = await orig<typeof import('@/lib/accountSettings')>();
  return {
    ...real,
    fetchEraseCheck: async () => h.check,
    setProfileDisabled: (v: boolean) => h.setDisabled(v),
    eraseAccount: () => h.erase(),
  };
});

import AccountSettings from '../AccountSettings';
import { ACCOUNT_CONTACT_EMAIL } from '@/lib/accountDeletionCopy';

const SETTINGS = '/account/settings';
const mount = (at: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/account/settings" element={<AccountSettings view="home" />} />
          <Route path="/account/settings/ownership" element={<AccountSettings view="ownership" />} />
          <Route path="/account/settings/delete" element={<AccountSettings view="delete" />} />
          <Route path="/account/deleted" element={<p>deleted-page</p>} />
          <Route path="/" element={<p>start</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  h.visibility = { status: 'visible' };
  h.check = { can_erase: true, blockers: [], code: null };
  h.user = { id: 'u1', email: 'me@x.co', new_email: undefined };
  h.setDisabled.mockReset();
  h.erase.mockReset();
  h.exportFn.mockReset().mockResolvedValue(h.exportData);
  h.updateUser.mockReset();
  h.signOut.mockReset().mockResolvedValue('signed-out');
});
afterEach(cleanup);

const PROFILE_STATES = ['none', 'unfinished', 'finished', 'hidden'] as const;
const ROLES = {
  'plain dancer': { can_erase: true, blockers: [], code: null },
  'organiser with co-owner': { can_erase: true, blockers: [], code: null },
  'sole organiser owner': { can_erase: false, blockers: [{ entity_id: 'o1', name: 'Salsa Nights' }], code: 'sole_organiser_owner' },
  admin: { can_erase: false, blockers: [], code: 'admin_account' },
} as const;
const visibilityFor = (p: (typeof PROFILE_STATES)[number]) => (p === 'none' ? 'none' : p === 'hidden' ? 'hidden' : 'visible');

describe('settings home', () => {
  for (const p of PROFILE_STATES) {
    it(`${p}: sign out, email, export and ownership are always there`, async () => {
      h.visibility = { status: visibilityFor(p) };
      mount(SETTINGS);
      expect(await screen.findByTestId('settings-signout')).toBeTruthy();
      expect(screen.getByTestId('settings-email-input')).toBeTruthy();
      expect(screen.getByTestId('settings-export')).toBeTruthy();
      expect(screen.getByTestId('settings-ownership-link').getAttribute('href')).toBe('/account/settings/ownership');
    });
  }

  it('no profile: the hide control is replaced by a reason, never a dead button', async () => {
    h.visibility = { status: 'none' };
    mount(SETTINGS);
    expect(await screen.findByTestId('settings-disable-none')).toBeTruthy();
    expect(screen.queryByTestId('settings-disable-toggle')).toBeNull();
    expect(screen.getByTestId('settings-disable-none').textContent).toMatch(/no dancer profile/i);
  });

  it('visible: offers Hide; confirming calls the RPC with true and shows the hidden state', async () => {
    h.setDisabled.mockResolvedValue({ ok: true, disabled: true });
    mount(SETTINGS);
    fireEvent.click(await screen.findByTestId('settings-disable-toggle'));
    fireEvent.click(await screen.findByTestId('settings-disable-confirm'));
    await waitFor(() => expect(h.setDisabled).toHaveBeenCalledWith(true));
    expect((await screen.findByTestId('settings-disable-state')).textContent).toMatch(/hidden/i);
  });

  it('hidden: says so and offers to show it again (RPC with false)', async () => {
    h.visibility = { status: 'hidden' };
    h.setDisabled.mockResolvedValue({ ok: true, disabled: false });
    mount(SETTINGS);
    expect((await screen.findByTestId('settings-disable-state')).textContent).toMatch(/hidden/i);
    fireEvent.click(screen.getByTestId('settings-disable-toggle'));
    await waitFor(() => expect(h.setDisabled).toHaveBeenCalledWith(false));
  });

  it('a no_profile error from the RPC shows the reason', async () => {
    h.setDisabled.mockResolvedValue({ ok: false, code: 'no_profile' });
    mount(SETTINGS);
    fireEvent.click(await screen.findByTestId('settings-disable-toggle'));
    fireEvent.click(await screen.findByTestId('settings-disable-confirm'));
    expect((await screen.findByTestId('settings-disable-error')).textContent).toMatch(/no dancer profile/i);
  });

  it('change email: invalid is disabled with a reason; valid calls updateUser and shows the check-both-inboxes state', async () => {
    h.updateUser.mockResolvedValue({ data: { user: {} }, error: null });
    mount(SETTINGS);
    const input = await screen.findByTestId('settings-email-input');
    const btn = screen.getByTestId('settings-email-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByTestId('settings-email-reason').textContent).toMatch(/new email/i);
    fireEvent.change(input, { target: { value: 'me@x.co' } });
    expect(btn.disabled).toBe(true); // same as the current address
    fireEvent.change(input, { target: { value: 'new@x.co' } });
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => expect(h.updateUser).toHaveBeenCalledWith({ email: 'new@x.co' }));
    expect((await screen.findByTestId('settings-email-pending')).textContent).toMatch(/both/i);
    expect(screen.getByTestId('settings-email-pending').textContent).toContain('new@x.co');
  });

  it('change email: an account with a not-yet-confirmed change shows the pending state on arrival', async () => {
    h.user = { id: 'u1', email: 'me@x.co', new_email: 'later@x.co' };
    mount(SETTINGS);
    expect((await screen.findByTestId('settings-email-pending')).textContent).toContain('later@x.co');
  });

  it('change email: an error is shown in plain words', async () => {
    h.updateUser.mockResolvedValue({ data: null, error: { message: 'A user with this email address has already been registered' } });
    mount(SETTINGS);
    fireEvent.change(await screen.findByTestId('settings-email-input'), { target: { value: 'new@x.co' } });
    fireEvent.click(screen.getByTestId('settings-email-submit'));
    expect((await screen.findByTestId('settings-email-error')).textContent).toMatch(/could not|already/i);
  });

  it('export: downloads a JSON file named for today, also with a null profile', async () => {
    const created: Blob[] = [];
    const url = { createObjectURL: vi.fn((b: Blob) => (created.push(b), 'blob:x')), revokeObjectURL: vi.fn() };
    Object.assign(URL, url);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    mount(SETTINGS);
    fireEvent.click(await screen.findByTestId('settings-export'));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(JSON.parse(await created[0].text()).profile).toBeNull();
    click.mockRestore();
  });

  it('export failure says what to do', async () => {
    h.exportFn.mockRejectedValue(new Error('x'));
    mount(SETTINGS);
    fireEvent.click(await screen.findByTestId('settings-export'));
    expect((await screen.findByTestId('settings-export-error')).textContent).toMatch(/try again/i);
  });

  it('sign out asks first, then signs out', async () => {
    mount(SETTINGS);
    fireEvent.click(await screen.findByTestId('settings-signout'));
    fireEvent.click(await screen.findByTestId('settings-signout-yes'));
    await waitFor(() => expect(h.signOut).toHaveBeenCalled());
    expect(await screen.findByText('start')).toBeTruthy();
  });

  it('sign out of all devices: global sign-out, then home; a failure says so and stays', async () => {
    mount(SETTINGS);
    fireEvent.click(await screen.findByTestId('settings-signout-all'));
    await waitFor(() => expect(h.signOut).toHaveBeenCalledWith({ everywhere: true }));
    expect(await screen.findByText('start')).toBeTruthy();
  });

  it('sign out of all devices failing keeps the person here with a reason', async () => {
    h.signOut.mockResolvedValue('failed');
    mount(SETTINGS);
    fireEvent.click(await screen.findByTestId('settings-signout-all'));
    expect((await screen.findByTestId('settings-signout-all-error')).textContent).toMatch(/did not complete/i);
  });

  it('settings is not behind the dancer-first gate (an unfinished profile can reach it)', () => {
    const src = readFileSync(path.resolve(__dirname, '../AccountSettings.tsx'), 'utf8');
    expect(src).not.toMatch(/DancerProfileGate/);
  });
});

describe('ownership + delete: the same fact on both screens', () => {
  for (const [role, check] of Object.entries(ROLES)) {
    for (const p of PROFILE_STATES) {
      it(`${role} x ${p}: ownership offers Delete account, delete screen reads the check`, async () => {
        h.visibility = { status: visibilityFor(p) };
        h.check = { ...check, blockers: [...check.blockers] };
        mount('/account/settings/ownership');
        expect(await screen.findByTestId('ownership-delete-link')).toBeTruthy();
        cleanup();
        mount('/account/settings/delete');
        const erase = (await screen.findByTestId('delete-confirm')) as HTMLButtonElement;
        expect(erase.disabled).toBe(true);
        if (check.code === 'sole_organiser_owner') {
          expect((await screen.findByTestId('delete-blocked')).textContent).toContain('Salsa Nights');
          expect(screen.getByTestId('delete-blocked').textContent).toMatch(/another owner/i);
          expect(screen.queryByTestId('delete-type-input')).toBeNull();
          expect(screen.getByTestId('delete-blocked-reason').textContent).toMatch(/cannot/i);
        } else if (check.code === 'admin_account') {
          expect((await screen.findByTestId('delete-blocked')).textContent).toMatch(/admin/i);
          expect(screen.queryByTestId('delete-type-input')).toBeNull();
        } else {
          expect(await screen.findByTestId('delete-type-input')).toBeTruthy();
          expect(screen.queryByTestId('delete-blocked')).toBeNull();
        }
        // Disable stays offered whenever erase is blocked and always points to settings.
        expect(screen.getByTestId('delete-hide-instead').getAttribute('href')).toBe('/account/settings');
        // The download offer is always there.
        expect(screen.getByTestId('delete-export')).toBeTruthy();
      });
    }
  }

  // Delete = hide (admin PR #820): the copy may never promise an erase.
  const FORBIDDEN = /erased|permanent|cannot be undone|photos are gone|for good|log back in/i;
  it('says what happens: hidden now, 30 days to undo, ask us for a full erase', async () => {
    mount('/account/settings/delete');
    const lost = await screen.findByTestId('delete-lost');
    expect(lost.textContent).toMatch(/hidden from everyone straight away/i);
    expect(lost.textContent).toMatch(/within 30 days/i);
    expect(lost.textContent).toMatch(/stays hidden/i);
    expect(lost.textContent).toContain(ACCOUNT_CONTACT_EMAIL);
    expect(document.body.textContent).not.toMatch(FORBIDDEN);
  });

  it('ownership: no promise of permanence', async () => {
    mount('/account/settings/ownership');
    expect((await screen.findByTestId('ownership-delete-link')).textContent).toBe('Delete account');
    expect(document.body.textContent).toMatch(/within 30 days/i);
    expect(document.body.textContent).not.toMatch(FORBIDDEN);
  });

  it('delete stays disabled until DELETE is typed exactly; then hides, signs out everywhere, routes to the deleted page', async () => {
    h.erase.mockResolvedValue({ kind: 'hidden' });
    mount('/account/settings/delete');
    const input = await screen.findByTestId('delete-type-input');
    const btn = screen.getByTestId('delete-confirm') as HTMLButtonElement;
    for (const v of ['delete', 'Delete', 'DELETE ', 'DELET']) {
      fireEvent.change(input, { target: { value: v } });
      expect(btn.disabled, v).toBe(true);
    }
    expect(screen.getByTestId('delete-confirm-reason').textContent).toMatch(/DELETE/);
    fireEvent.change(input, { target: { value: 'DELETE' } });
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => expect(h.erase).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(h.signOut).toHaveBeenCalledWith({ everywhere: true }));
    expect(await screen.findByText('deleted-page')).toBeTruthy();
  });

  it('a failed sign-out after hiding is ignored', async () => {
    h.erase.mockResolvedValue({ kind: 'hidden' });
    h.signOut.mockRejectedValue(new Error('session gone'));
    mount('/account/settings/delete');
    fireEvent.change(await screen.findByTestId('delete-type-input'), { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByTestId('delete-confirm'));
    expect(await screen.findByText('deleted-page')).toBeTruthy();
  });

  // Each refusal code has its own words; the person stays, signed in, with nothing changed.
  const REFUSALS: Array<[string, unknown, RegExp, string | null]> = [
    ['admin_account', { kind: 'refused', code: 'admin_account', blockers: [] }, /admin account/i, null],
    ['sole_organiser_owner', { kind: 'refused', code: 'sole_organiser_owner', blockers: [{ entity_id: 'o9', name: 'Late Club' }] }, /only owner/i, 'Late Club'],
    ['already_archived', { kind: 'refused', code: 'already_archived', blockers: [] }, /admin has already hidden/i, null],
    ['rate_limited', { kind: 'refused', code: 'rate_limited', blockers: [] }, /wait until tomorrow/i, null],
  ];
  it.each(REFUSALS)('refused %s at the last moment: its own message, no sign-out', async (_c, out, words, blocker) => {
    h.erase.mockResolvedValue(out);
    mount('/account/settings/delete');
    fireEvent.change(await screen.findByTestId('delete-type-input'), { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByTestId('delete-confirm'));
    const box = await screen.findByTestId('delete-blocked');
    expect(box.textContent).toMatch(words);
    if (blocker) expect(box.textContent).toContain(blocker);
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it('an unknown failure: generic message with retry, nothing deleted, no sign-out', async () => {
    h.erase.mockResolvedValue({ kind: 'failed' });
    mount('/account/settings/delete');
    fireEvent.change(await screen.findByTestId('delete-type-input'), { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByTestId('delete-confirm'));
    const msg = await screen.findByTestId('delete-error');
    expect(msg.textContent).toMatch(/not deleted/i);
    expect(msg.textContent).toMatch(/try again/i);
    expect(h.signOut).not.toHaveBeenCalled();
    expect((screen.getByTestId('delete-confirm') as HTMLButtonElement).disabled).toBe(false);
  });

  it('the erase check failing keeps erase disabled and offers retry', async () => {
    h.check = undefined as never;
    mount('/account/settings/delete');
    expect(await screen.findByTestId('delete-check-failed')).toBeTruthy();
    expect((screen.getByTestId('delete-confirm') as HTMLButtonElement).disabled).toBe(true);
  });
});
