// @vitest-environment jsdom
/**
 * Slice B audit fixes on the account and legal pages (M3, M4, M16, M21, M26, L1, L7, L13, L19,
 * L21, L24). Seeds are prod shapes: hidden profile, deletion pending, 30-day window expired,
 * admin archived, sole-owner delete blocker, a 49-character email.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const h = vi.hoisted(() => ({
  layoutProps: [] as Array<Record<string, unknown>>,
  visibility: { status: 'visible' as string },
  check: { can_erase: true, blockers: [] as { entity_id: string; name: string }[], code: null as string | null },
  rpc: vi.fn(),
  erase: vi.fn(),
  signOut: vi.fn(),
  user: { id: 'u1', email: 'me@x.co', new_email: undefined as string | undefined },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: h.user, session: {}, isLoading: false, authStatus: 'ready', signOut: h.signOut }),
}));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/layout/GlobalLayout', () => ({
  default: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => {
    h.layoutProps.push(props);
    return <div>{children}</div>;
  },
}));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/lib/seo', async (orig) => ({ ...(await orig<object>()), useSeo: () => undefined }));
vi.mock('@/hooks/useMyProfileVisibility', () => ({
  useMyProfileVisibility: () => ({ status: h.visibility.status, refetch: vi.fn() }),
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (fn: string) => h.rpc(fn) }));
vi.mock('@/lib/accountSettings', async (orig) => {
  const real = await orig<typeof import('@/lib/accountSettings')>();
  return { ...real, fetchEraseCheck: async () => h.check, eraseAccount: () => h.erase() };
});

import AccountSettings from '../AccountSettings';
import AccountDeleted from '../AccountDeleted';
import AccountRestore from '../AccountRestore';
import Privacy from '../Privacy';
import Terms from '../Terms';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { canConfirmErase } from '@/lib/accountSettings';
import { formatLongDate } from '@/lib/accountDeletionCopy';
import { ACCOUNT_SETTINGS_LABEL, HIDDEN_STATE_LINE, HIDDEN_STATE_WORD, SHOW_AGAIN_LABEL } from '@/modules/dancer-app/copy/sharedCopy';

const LONG_EMAIL = 'maria.fernanda.rodriguez.villanueva@example.co.uk'; // 49 characters
const NONE = { state: 'none', requested_at: null, restore_until: null };
const PENDING = { state: 'pending', requested_at: '2026-10-01T10:00:00+00:00', restore_until: '2026-10-31T10:00:00+00:00' };
const EXPIRED = { state: 'expired', requested_at: '2026-08-01T10:00:00+00:00', restore_until: '2026-08-31T10:00:00+00:00' };

const arrangeStatus = (status: unknown, restore: unknown = { data: null, error: { message: 'x' } }) =>
  h.rpc.mockImplementation(async (fn: string) => (fn === 'my_account_deletion_status_v1' ? { data: status, error: null } : restore));

const mount = (at: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/account/settings" element={<AccountSettings view="home" />} />
          <Route path="/account/settings/ownership" element={<AccountSettings view="ownership" />} />
          <Route path="/account/settings/delete" element={<AccountSettings view="delete" />} />
          <Route path="/account/deleted" element={<AccountDeleted />} />
          <Route path="/account/restore" element={<AccountRestore />} />
          <Route path="/account/continue" element={<p>continue-page</p>} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/" element={<p>calendar-home</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  h.layoutProps = [];
  h.visibility = { status: 'visible' };
  h.check = { can_erase: true, blockers: [], code: null };
  h.user = { id: 'u1', email: 'me@x.co', new_email: undefined };
  h.rpc.mockReset();
  arrangeStatus(NONE);
  h.erase.mockReset();
  h.signOut.mockReset().mockResolvedValue('signed-out');
});
afterEach(cleanup);

const read = (p: string) => readFileSync(path.resolve(__dirname, '../../..', p), 'utf8');

describe('M4: Back to Options when the person came from the dancer app', () => {
  for (const at of ['/account/settings', '/account/settings/delete']) {
    it(`${at}?from=app shows Back to Options -> /app/options`, async () => {
      mount(`${at}?from=app`);
      const back = await screen.findByTestId('settings-back-to-options');
      expect(back.textContent).toBe('Back to Options');
      expect(back.getAttribute('href')).toBe('/app/options');
    });
    it(`${at} without from=app shows no Back to Options`, async () => {
      mount(at);
      await screen.findByRole('heading', { level: 1 });
      expect(screen.queryByTestId('settings-back-to-options')).toBeNull();
    });
  }
  it('the from=app context survives settings -> delete -> hide instead', async () => {
    mount('/account/settings?from=app');
    expect((await screen.findByTestId('settings-delete-link')).getAttribute('href')).toBe('/account/settings/delete?from=app');
    cleanup();
    mount('/account/settings/delete?from=app');
    expect((await screen.findByTestId('delete-hide-instead')).getAttribute('href')).toBe('/account/settings?from=app');
  });
});

describe('L7: task pages draw no floating icons over their text', () => {
  const PAGES: Array<[string, () => void]> = [
    ['/account/settings', () => arrangeStatus(NONE)],
    ['/account/settings/delete', () => arrangeStatus(NONE)],
    ['/account/deleted', () => arrangeStatus(NONE)],
    ['/account/restore', () => arrangeStatus(EXPIRED)],
  ];
  for (const [at, seed] of PAGES) {
    it(`${at}: showGradientBg={false}`, async () => {
      seed();
      mount(at);
      await screen.findByRole('heading', { level: 1 });
      expect(h.layoutProps.length).toBeGreaterThan(0);
      for (const p of h.layoutProps) expect(p.showGradientBg).toBe(false);
    });
  }
});

describe('M16: one word for the hidden state', () => {
  it('settings, hidden profile: the shared line and the shared show-again label', async () => {
    h.visibility = { status: 'hidden' };
    mount('/account/settings');
    const state = await screen.findByTestId('settings-disable-state');
    expect(state.textContent).toContain(HIDDEN_STATE_LINE);
    expect(screen.getByTestId('settings-disable-toggle').textContent).toBe(SHOW_AGAIN_LABEL);
  });
  it('Privacy names one state (hidden), never a second "pause" feature', () => {
    mount('/privacy');
    const body = screen.getByTestId('legal-privacy').textContent ?? '';
    expect(body).not.toMatch(/paus/i);
    expect(body).toMatch(new RegExp(`while it is ${HIDDEN_STATE_WORD}`, 'i'));
  });
  it('DancerHome reads the shared label, never its own copy', () => {
    const src = read('src/components/account/DancerHome.tsx');
    expect(src).toMatch(/SHOW_AGAIN_LABEL/);
    expect(src).not.toMatch(/>\s*Show my profile again\s*</);
  });
});

describe('M21: Delete account, straight to the delete view', () => {
  it('settings home: a "Delete account" section whose button goes straight to the delete view', async () => {
    mount('/account/settings');
    const link = await screen.findByTestId('settings-delete-link');
    expect(link.textContent).toBe('Delete account');
    expect(link.getAttribute('href')).toBe('/account/settings/delete');
    expect(screen.getByRole('heading', { level: 2, name: 'Delete account' })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Account ownership/);
  });
  it('the old /ownership link opens the delete view itself (title Delete account)', async () => {
    mount('/account/settings/ownership');
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Delete account');
    expect(await screen.findByTestId('delete-confirm')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Account ownership/);
  });
  it('ownership and delete share the delete breadcrumbs', async () => {
    mount('/account/settings/ownership');
    await screen.findByTestId('delete-confirm');
    expect(h.layoutProps[h.layoutProps.length - 1]?.breadcrumbs).toEqual(buildBreadcrumbs('accountSettings.delete'));
  });
});

describe('M26: the expired restore card is not a dead end', () => {
  it('expired: Back to the calendar and Sign out, next to the two contact actions', async () => {
    arrangeStatus(EXPIRED);
    mount('/account/restore');
    await screen.findByTestId('restore-deleted-card');
    expect(screen.getByTestId('restore-back-to-calendar').getAttribute('href')).toBe('/');
    expect(screen.getByTestId('restore-ask-restore')).toBeTruthy();
    fireEvent.click(screen.getByTestId('restore-signout'));
    await waitFor(() => expect(h.signOut).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('calendar-home')).toBeTruthy();
  });
  it('expired: a failed sign-out says so and stays', async () => {
    arrangeStatus(EXPIRED);
    h.signOut.mockResolvedValue('failed');
    mount('/account/restore');
    fireEvent.click(await screen.findByTestId('restore-signout'));
    expect((await screen.findByTestId('restore-signout-error')).textContent).toMatch(/try again/i);
  });
  it('window closed during restore (pending -> window_closed) shows the same exits', async () => {
    arrangeStatus(PENDING, { data: { ...EXPIRED, restored: false, code: 'restore_window_closed' }, error: null });
    mount('/account/restore');
    await screen.findByTestId('restore-deleted-card');
    expect(screen.getByTestId('restore-back-to-calendar')).toBeTruthy();
    expect(screen.getByTestId('restore-signout')).toBeTruthy();
  });
});

describe('L21: the deleted page offers the undo it describes', () => {
  it('Sign in to undo -> sign-in, returning to /account/restore', async () => {
    mount('/account/deleted');
    const link = await screen.findByTestId('account-deleted-signin');
    expect(link.textContent).toBe('Sign in to undo');
    expect(link.getAttribute('href')).toBe('/auth?mode=signin&returnTo=%2Faccount%2Frestore');
  });
  it('restore never offers Continue back to itself (returnTo=/account/restore)', async () => {
    arrangeStatus(NONE);
    mount('/account/restore?returnTo=%2Faccount%2Frestore');
    expect((await screen.findByTestId('restore-continue')).getAttribute('href')).toBe('/account/continue');
  });
});

describe('L19 + M3: the DELETE field', () => {
  it('capitalises on phones, says done, and submits on Enter', async () => {
    h.erase.mockResolvedValue({ kind: 'hidden' });
    mount('/account/settings/delete');
    const input = await screen.findByTestId('delete-type-input');
    expect(input.getAttribute('autocapitalize')).toBe('characters');
    expect(input.getAttribute('enterkeyhint')).toBe('done');
    fireEvent.change(input, { target: { value: 'DELET' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(h.erase).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: ' DELETE ' } });
    expect((screen.getByTestId('delete-confirm') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    await waitFor(() => expect(h.erase).toHaveBeenCalledTimes(1));
  });
  it.each([
    ['DELETE', true],
    [' DELETE ', true],
    ['DELETE\n', true],
    ['delete', false],
    ['Delete', false],
    ['DELET', false],
    ['', false],
  ])('canConfirmErase(%j) = %s', (typed, ok) => {
    expect(canConfirmErase(typed)).toBe(ok);
  });
  it('sole owner: no field, no submit, the blocker names the page', async () => {
    h.check = { can_erase: false, blockers: [{ entity_id: 'o1', name: 'Salsa Nights' }], code: 'sole_organiser_owner' };
    mount('/account/settings/delete');
    expect((await screen.findByTestId('delete-blocked')).textContent).toContain('Salsa Nights');
    expect(screen.queryByTestId('delete-type-input')).toBeNull();
  });
});

describe('L1: a long email wraps at a break point, never mid-word break-all', () => {
  const SCREENS: Array<[string, () => void]> = [
    ['/account/settings', () => undefined],
    ['/account/settings/delete', () => undefined],
    ['/account/deleted', () => undefined],
    ['/account/restore', () => arrangeStatus(EXPIRED)],
  ];
  for (const [at, seed] of SCREENS) {
    it(`${at}: no break-all; every email span may wrap anywhere, with a break point before @`, async () => {
      h.user = { id: 'u1', email: LONG_EMAIL, new_email: undefined };
      seed();
      const { container } = mount(at);
      await screen.findByRole('heading', { level: 1 });
      await waitFor(() => expect(container.querySelectorAll('[data-email]').length).toBeGreaterThan(0));
      expect(container.querySelector('.break-all')).toBeNull();
      for (const el of Array.from(container.querySelectorAll('[data-email]'))) {
        expect(el.className).toContain('[overflow-wrap:anywhere]');
        expect(el.querySelector('wbr')).toBeTruthy();
      }
    });
  }
});

describe('L13: one name for the account page', () => {
  it('settings home title is ACCOUNT_SETTINGS_LABEL', async () => {
    mount('/account/settings');
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(ACCOUNT_SETTINGS_LABEL);
  });
  it('delete view links back with the same name', async () => {
    mount('/account/settings/delete');
    expect((await screen.findByTestId('delete-hide-instead')).textContent).toBe('Hide my profile instead');
    expect(document.body.textContent).not.toMatch(/Back to settings/);
  });
  it('Privacy names the page ACCOUNT_SETTINGS_LABEL', () => {
    mount('/privacy');
    expect(screen.getByRole('link', { name: ACCOUNT_SETTINGS_LABEL })).toBeTruthy();
  });
  it('DancerHome names it ACCOUNT_SETTINGS_LABEL', () => {
    const src = read('src/components/account/DancerHome.tsx');
    expect(src).toMatch(/ACCOUNT_SETTINGS_LABEL/);
    expect(src).not.toMatch(/>\s*Settings: email/);
  });
});

describe('L24: legal pages say the date in words', () => {
  it.each([
    ['2026-10-16', '16 October 2026'],
    ['2026-01-05', '5 January 2026'],
    ['2026-03-29', '29 March 2026'],
    ['v2', 'v2'],
  ])('formatLongDate(%s) = %s', (v, out) => {
    expect(formatLongDate(v)).toBe(out);
  });
  for (const at of ['/privacy', '/terms']) {
    it(`${at}: Last updated 16 October 2026`, () => {
      mount(at);
      expect(screen.getByText('Last updated 16 October 2026')).toBeTruthy();
    });
  }
});

describe('terms and privacy are live: no "not published" text left', () => {
  it('none of the account or legal sources say not published / not live', () => {
    for (const f of [
      'src/pages/AccountSettings.tsx', 'src/pages/AccountDeleted.tsx', 'src/pages/AccountRestore.tsx', 'src/pages/Account.tsx',
      'src/pages/Privacy.tsx', 'src/pages/Terms.tsx', 'src/pages/legal/LegalShell.tsx', 'src/lib/termsConsent.ts',
      'src/components/account/DancerHome.tsx', 'src/lib/accountDeletionCopy.ts',
    ]) {
      expect(read(f), f).not.toMatch(/not (yet )?(published|live)|isn.t (published|live)/i);
    }
  });
});
