// @vitest-environment jsdom
/**
 * /account/restore (delete = hide, admin PR #820): every status x restore-code
 * shape renders its own words, every control the copy names is on screen, and
 * restore runs once.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (fn: string) => h.rpc(fn) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

import AccountRestore from '../AccountRestore';

const NONE = { state: 'none', requested_at: null, restore_until: null };
const PENDING = { state: 'pending', requested_at: '2026-10-01T10:00:00+00:00', restore_until: '2026-10-31T10:00:00+00:00' };
const EXPIRED = { state: 'expired', requested_at: '2026-08-01T10:00:00+00:00', restore_until: '2026-08-31T10:00:00+00:00' };

type Res = { data: unknown; error: unknown };
const arrange = (status: Res, restore?: Res) =>
  h.rpc.mockImplementation(async (fn: string) => (fn === 'my_account_deletion_status_v1' ? status : (restore ?? { data: null, error: { message: 'x' } })));

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/account/restore']}>
        <Routes>
          <Route path="/account/restore" element={<AccountRestore />} />
          <Route path="/account/continue" element={<p>continue-page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const restoreCalls = () => h.rpc.mock.calls.filter(([fn]) => fn === 'my_account_restore_v1').length;

afterEach(cleanup);
beforeEach(() => h.rpc.mockReset());

describe('/account/restore', () => {
  it('pending -> restores once, says welcome back, Continue goes on', async () => {
    arrange({ data: PENDING, error: null }, { data: { ...NONE, restored: true, code: null }, error: null });
    mount();
    expect((await screen.findByTestId('restore-restored')).textContent).toContain('Welcome back, your account is restored');
    expect(restoreCalls()).toBe(1);
    fireEvent.click(screen.getByTestId('restore-continue'));
    expect(await screen.findByText('continue-page')).toBeTruthy();
  });

  it('pending but admin_archived -> says an admin hid it, offers contact, no Continue', async () => {
    arrange({ data: PENDING, error: null }, { data: { ...PENDING, restored: false, code: 'admin_archived' }, error: null });
    mount();
    const box = await screen.findByTestId('restore-admin_archived');
    expect(box.textContent).toMatch(/An admin has hidden this profile/);
    expect(screen.getByTestId('restore-contact').getAttribute('href')).toMatch(/^mailto:/);
    expect(screen.queryByTestId('restore-continue')).toBeNull();
  });

  it('pending but the window closed meanwhile -> the deleted card', async () => {
    arrange({ data: PENDING, error: null }, { data: { ...EXPIRED, restored: false, code: 'restore_window_closed' }, error: null });
    mount();
    expect((await screen.findByTestId('restore-deleted-card')).textContent).toContain('This account was deleted on 1 August 2026');
  });

  it('pending, restore fails -> retry, which runs restore again', async () => {
    arrange({ data: PENDING, error: null });
    mount();
    fireEvent.click(await screen.findByTestId('restore-retry'));
    await waitFor(() => expect(restoreCalls()).toBe(2));
  });

  it('expired -> deleted card with the date and two actions to the contact address; no restore call', async () => {
    arrange({ data: EXPIRED, error: null });
    mount();
    const card = await screen.findByTestId('restore-deleted-card');
    expect(card.textContent).toContain('This account was deleted on 1 August 2026');
    expect(card.textContent).not.toMatch(/erased|permanent|cannot be undone/i);
    expect(screen.getByTestId('restore-ask-restore').getAttribute('href')).toMatch(/^mailto:.*restore/i);
    expect(screen.getByTestId('restore-ask-erase').getAttribute('href')).toMatch(/^mailto:.*erase/i);
    expect(restoreCalls()).toBe(0);
  });

  it('none -> nothing to restore, Continue; no restore call', async () => {
    arrange({ data: NONE, error: null });
    mount();
    expect((await screen.findByTestId('restore-nothing_to_restore')).textContent).toMatch(/not hidden/);
    expect(restoreCalls()).toBe(0);
  });

  it('status read fails -> a reason and Try again', async () => {
    arrange({ data: null, error: { message: 'offline' } });
    mount();
    expect((await screen.findByTestId('restore-status-failed')).textContent).toMatch(/couldn.t check/);
  });
});
