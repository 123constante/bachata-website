// @vitest-environment jsdom
/**
 * M76 / owner decision D1: signing out clears EVERY person-scoped local and
 * session storage key, so the next person on the same browser sees nothing of
 * the last one (A's sign-up form pre-filled B's: e-mail, name, city).
 *
 * ONE choke point: AuthProvider's signOut (hooks/useAuth). Every sign-out
 * control (settings, switcher sheet, Options, organiser shell, account pages)
 * calls useAuth().signOut, and the guard below proves nothing else in src calls
 * supabase.auth.signOut directly.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  signOut: vi.fn(),
  adminSignOut: vi.fn(),
  session: null as null | { access_token: string; user: { id: string } },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({
  getSupabase: async () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getSession: async () => ({ data: { session: h.session } }),
      signOut: h.signOut,
      admin: { signOut: h.adminSignOut },
    },
  }),
}));

import { AuthProvider, useAuth, type SignOutOptions, type SignOutOutcome } from '@/hooks/useAuth';
import { AuthFormProvider, useAuthForm } from '@/contexts/AuthFormContext';

const SUPABASE_TOKEN = 'sb-stsdtacfauprzrdebmzg-auth-token';

/** What person A leaves behind on a shared browser (keys as the code writes them). */
const seedPersonA = () => {
  localStorage.setItem('auth_form_state_v1', JSON.stringify({ email: 'a@example.com', firstName: 'Ana', surname: '', cityId: 'c1', cityName: 'London', otpCode: '', role: 'dancer', danceRole: 'Follower' }));
  localStorage.setItem('auth_last_email', 'a@example.com');
  localStorage.setItem('pending_profile_role', 'dancer');
  localStorage.setItem('profile_entry_role', 'dancer');
  localStorage.setItem('auth_pending_return_to', '/account/o');
  localStorage.setItem('profile_last_active_role', 'dancer');
  localStorage.setItem('auth_signup_draft_v1', '{"email":"a@example.com"}');
  localStorage.setItem('profile_entry_flow', '{"step":1}');
  localStorage.setItem('videographer_pre_auth', '{"name":"Ana"}');
  localStorage.setItem('pending_level_rating', '{"seriesId":"s1","level":"mixed"}');
  localStorage.setItem('bc:organiser-edit-draft:v1:org-1', '{"v":1,"fields":{"bio":"x"}}');
  localStorage.setItem('vendor_dashboard_draft_u-a', '{}');
  localStorage.setItem('dancer_app_linked_notice_dismissed:u-a', '1');
  sessionStorage.setItem('finish_profile_prompt_pending', '1');
  sessionStorage.setItem('finish_profile_skipped', '1');
  sessionStorage.setItem('dancer_app_entered', '1');
  sessionStorage.setItem('auth_code_step_v1', '{"email":"a@example.com"}');
  // #789: the Supabase session carries A's e-mail; it goes too.
  localStorage.setItem(SUPABASE_TOKEN, '{"access_token":"t","user":{"email":"a@example.com"}}');
  localStorage.setItem(`${SUPABASE_TOKEN}-user`, '{"email":"a@example.com"}');
  // Not person-scoped: kept.
  localStorage.setItem('activeCitySlug', 'london-gb');
  localStorage.setItem('bachata-calendar-view', 'month');
  localStorage.setItem('theme', 'dark');
  localStorage.setItem('cookie-consent', 'accepted');
};

const PERSON_KEYS_LOCAL = [
  'auth_form_state_v1', 'auth_last_email', 'pending_profile_role', 'profile_entry_role', 'auth_pending_return_to',
  'profile_last_active_role', 'auth_signup_draft_v1', 'profile_entry_flow', 'videographer_pre_auth', 'pending_level_rating',
  'bc:organiser-edit-draft:v1:org-1', 'vendor_dashboard_draft_u-a', 'dancer_app_linked_notice_dismissed:u-a',
  SUPABASE_TOKEN, `${SUPABASE_TOKEN}-user`,
];
const PERSON_KEYS_SESSION = ['finish_profile_prompt_pending', 'finish_profile_skipped', 'dancer_app_entered', 'auth_code_step_v1'];
const KEPT = ['activeCitySlug', 'bachata-calendar-view', 'theme', 'cookie-consent'];

const expectAClean = () => {
  for (const k of PERSON_KEYS_LOCAL) expect([k, localStorage.getItem(k)]).toEqual([k, null]);
  for (const k of PERSON_KEYS_SESSION) expect([k, sessionStorage.getItem(k)]).toEqual([k, null]);
  for (const k of KEPT) expect([k, localStorage.getItem(k)]).not.toEqual([k, null]);
};

let signOutFn: (opts?: SignOutOptions) => Promise<SignOutOutcome> = async () => 'failed';
function Grab() {
  const { signOut } = useAuth();
  useEffect(() => {
    signOutFn = signOut;
  });
  return null;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  h.signOut.mockReset();
  h.adminSignOut.mockReset().mockResolvedValue({ error: null });
  h.session = null;
});
afterEach(cleanup);

describe('clearPersonScopedStorage (the one key list)', () => {
  it('removes every person-scoped key, prefix and the supabase session, keeps device prefs', async () => {
    const { clearPersonScopedStorage } = await import('@/lib/personScopedStorage');
    seedPersonA();
    clearPersonScopedStorage();
    expectAClean();
  });

  it('the key list names the constants the code writes under', async () => {
    const mod = await import('@/lib/personScopedStorage');
    const { AUTH_PENDING_RETURN_TO_KEY } = await import('@/lib/authRouting');
    const { POST_LOGIN_PROMPT_KEY, SKIP_FINISH_PROFILE_KEY } = await import('@/lib/auth-otp-routing');
    const { PENDING_LEVEL_RATING_KEY } = await import('@/lib/pendingLevelRating');
    const { draftStorageKey } = await import('@/modules/organiser/edit-in-place/draftModel');
    expect(mod.PERSON_SCOPED_LOCAL_KEYS).toContain(AUTH_PENDING_RETURN_TO_KEY);
    expect(mod.PERSON_SCOPED_LOCAL_KEYS).toContain(PENDING_LEVEL_RATING_KEY);
    expect(POST_LOGIN_PROMPT_KEY.startsWith('finish_profile_')).toBe(true);
    expect(SKIP_FINISH_PROFILE_KEY.startsWith('finish_profile_')).toBe(true);
    expect(mod.PERSON_SCOPED_SESSION_PREFIXES).toContain('finish_profile_');
    expect(mod.PERSON_SCOPED_LOCAL_PREFIXES.some((p: string) => draftStorageKey('x').startsWith(p))).toBe(true);
  });

  it('storage that throws (private mode) never breaks a sign-out', async () => {
    const { clearPersonScopedStorage } = await import('@/lib/personScopedStorage');
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('SecurityError'); });
    try {
      expect(() => clearPersonScopedStorage()).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('AuthProvider.signOut is the choke point', () => {
  it.each([
    ['signed-out', undefined, () => h.signOut.mockResolvedValue({ error: null })],
    ['signed-out', { everywhere: true }, () => h.signOut.mockResolvedValue({ error: null })],
    ['signed-out-locally', { everywhere: true }, () => {
      h.signOut.mockResolvedValue({ error: null });
      h.adminSignOut.mockResolvedValue({ error: { message: 'offline' } });
    }],
    // #789: offline on an ordinary sign-out: the device is still cleared, nothing on it can sign in.
    ['signed-out', undefined, () => {
      h.signOut.mockResolvedValue({ error: null });
      h.adminSignOut.mockRejectedValue(new TypeError('Failed to fetch'));
    }],
  ] as const)('%s (%o): every person-scoped key and the query cache are gone', async (want, opts, arrange) => {
    arrange();
    h.session = { access_token: 'at', user: { id: 'u-a' } };
    seedPersonA();
    const qc = new QueryClient();
    qc.setQueryData(['my-dancer-edit', 'A'], { first_name: 'Ana' });
    render(<QueryClientProvider client={qc}><AuthProvider><Grab /></AuthProvider></QueryClientProvider>);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); // the provider holds A's session
    let outcome: SignOutOutcome = 'failed';
    await act(async () => { outcome = await signOutFn(opts); });
    expect(outcome).toBe(want);
    expectAClean();
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
  });

  // D6: an ordinary sign-out is this device; "Sign out of all devices" is the global revoke.
  // The server revoke carries the scope; the in-memory step is always local (nothing stored is left to revoke).
  it.each([
    [undefined, 'local'],
    [{ everywhere: true }, 'global'],
  ] as const)('scope for %o', async (opts, scope) => {
    h.signOut.mockResolvedValue({ error: null });
    h.session = { access_token: 'at', user: { id: 'u-a' } };
    render(<AuthProvider><Grab /></AuthProvider>);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); // the provider holds A's session
    await act(async () => { await signOutFn(opts); });
    expect(h.adminSignOut.mock.calls).toEqual([['at', scope]]);
    expect(h.signOut.mock.calls.map((c) => c[0])).toEqual([{ scope: 'local' }]);
  });

  // #789: A's data leaves storage before anything else can fail; a local sign-out that then
  // fails (Safari private mode, a full quota) still says failed, never success.
  it('a failed in-memory sign-out says failed, and A is already gone from storage', async () => {
    h.signOut.mockResolvedValue({ error: { message: 'storage' } });
    seedPersonA();
    render(<AuthProvider><Grab /></AuthProvider>);
    let outcome: SignOutOutcome = 'signed-out';
    await act(async () => { outcome = await signOutFn(); });
    expect(outcome).toBe('failed');
    for (const k of PERSON_KEYS_LOCAL) expect([k, localStorage.getItem(k)]).toEqual([k, null]);
  });

  it('A signs out, B opens /auth: the form shows nothing of A', async () => {
    h.signOut.mockResolvedValue({ error: null });
    seedPersonA();
    render(<AuthProvider><Grab /></AuthProvider>);
    await act(async () => { await signOutFn(); });
    cleanup();
    function Form() {
      const { formState } = useAuthForm();
      return <p data-testid="form">{JSON.stringify(formState)}</p>;
    }
    render(<AuthFormProvider><Form /></AuthFormProvider>);
    await waitFor(() => expect(screen.getByTestId('form').textContent).toContain('"email":""'));
    const shown = screen.getByTestId('form').textContent ?? '';
    for (const leak of ['a@example.com', 'Ana', 'London', 'Follower', '"role":"dancer"']) expect(shown).not.toContain(leak);
  });
});

describe('guard: nothing in src signs out around the choke point', () => {
  const SRC = join(process.cwd(), 'src');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return name === '__tests__' ? [] : files(p);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [p] : [];
    });

  it('auth.signOut( appears only in hooks/useAuth.tsx', () => {
    const callers = files(SRC)
      .filter((f) => /\.auth\s*\.\s*signOut\s*\(/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f).replace(/\\/g, '/'));
    expect(callers).toEqual(['hooks/useAuth.tsx']);
  });
});
