// @vitest-environment jsdom
/**
 * The self-claim on BOTH sign-in paths: /auth/callback (emailed link) and
 * AuthStepper's in-page code sign-in. claim_my_dancer_profile_v1 is called once
 * per sign-in, BEFORE the persona is read, so the persona read sees the linked
 * profile. It never blocks or breaks the sign-in (the admin migration may not be
 * applied yet), and on "linked" the one-time finish-profile hop is not armed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  calls: [] as string[],
  claim: (() => Promise.resolve({ data: null, error: null })) as () => Promise<unknown>,
  persona: 'u1' as string | null,
}));
const user = vi.hoisted(() => ({
  id: 'u1',
  user_metadata: {} as Record<string, unknown>,
  // The account's FIRST sign-in (#707's isFirstSignIn): the hop would be armed.
  email_confirmed_at: '2026-10-10T10:00:00Z',
  last_sign_in_at: '2026-10-10T10:00:02Z',
}));
const COMPLETE = { first_name: 'Ana', based_city_id: 'c1', dance_role: 'Follower', meta_data: null };

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (_c: string, id: string) => ({
          maybeSingle: async () => {
            h.calls.push(`read:${id}`);
            return { data: { id, ...COMPLETE }, error: null };
          },
        }),
      }),
    }),
    // account_exists_by_email: an existing account, so the stepper goes to the code step.
    rpc: async () => ({ data: true, error: null }),
    auth: {
      getSession: async () => ({ data: { session: { user } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithOtp: async () => ({ data: {}, error: null }),
      verifyOtp: async () => ({ data: {}, error: null }),
      updateUser: async () => ({ data: {}, error: null }),
    },
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: async (fn: string) => {
    h.calls.push(fn);
    if (fn === 'claim_my_dancer_profile_v1') return h.claim();
    if (fn === '_my_dancer_profile_id_v1') return { data: h.persona, error: null };
    return { data: null, error: null };
  },
}));
vi.mock('@/modules/organiser-self-serve/selfServeApi', () => ({ fetchOrganiserHome: vi.fn() }));
vi.mock('@/lib/featureFlags', () => ({ flags: { organiserSelfServe: true } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }));
vi.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: () => {} }));

import AuthCallback from '../AuthCallback';
import { AuthStepper } from '@/components/auth/AuthStepper';
import { AuthFormProvider } from '@/contexts/AuthFormContext';
import { POST_LOGIN_PROMPT_KEY } from '@/lib/auth-otp-routing';
import { myPersonaQueryKey } from '@/lib/myPersona';
import { installJsdomPolyfills } from '../../../tests/client/jsdomPolyfills';

const ok = (status: string, profile_id: string | null = null) => () =>
  Promise.resolve({ data: { ok: true, status, profile_id }, error: null });

const SHAPES: { name: string; claim: () => Promise<unknown>; persona: string; armed: boolean; invalidated: boolean }[] = [
  { name: 'linked', claim: ok('linked', 'admin-1'), persona: 'admin-1', armed: false, invalidated: true },
  { name: 'already_linked', claim: ok('already_linked', 'admin-1'), persona: 'admin-1', armed: true, invalidated: false },
  { name: 'no_match', claim: ok('no_match'), persona: 'u1', armed: true, invalidated: false },
  { name: 'ambiguous', claim: ok('ambiguous'), persona: 'u1', armed: true, invalidated: false },
  { name: 'email_unproven', claim: ok('email_unproven'), persona: 'u1', armed: true, invalidated: false },
  { name: 'not_applicable', claim: ok('not_applicable'), persona: 'u1', armed: true, invalidated: false },
  {
    name: 'function missing (PGRST202, migration not applied)',
    claim: () => Promise.resolve({ data: null, error: { message: 'Could not find the function (PGRST202)' } }),
    persona: 'u1',
    armed: true,
    invalidated: false,
  },
  { name: 'thrown error', claim: () => Promise.reject(new Error('boom')), persona: 'u1', armed: true, invalidated: false },
];

let client: QueryClient;
const mount = (ui: ReactNode, path: string) =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AuthFormProvider>
          <Routes>
            <Route path="/auth/callback" element={ui} />
            <Route path="/auth" element={ui} />
            <Route path="*" element={<p>landed</p>} />
          </Routes>
        </AuthFormProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  installJsdomPolyfills();
  document.elementFromPoint = () => null;
  localStorage.clear();
  sessionStorage.clear();
  h.calls = [];
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // A persona cached before this sign-in (the own stub).
  client.setQueryData(myPersonaQueryKey('u1'), 'u1');
});
afterEach(cleanup);

describe.each(SHAPES)('claim answers: $name', ({ claim, persona, armed, invalidated }) => {
  beforeEach(() => {
    h.claim = claim;
    h.persona = persona;
  });

  it('/auth/callback: claims once, BEFORE the persona read; the sign-in lands', async () => {
    mount(<AuthCallback />, '/auth/callback?mode=signin');
    await screen.findByText('landed');
    expect(h.calls.filter((c) => c === 'claim_my_dancer_profile_v1')).toHaveLength(1);
    expect(h.calls.indexOf('claim_my_dancer_profile_v1')).toBeLessThan(h.calls.indexOf('_my_dancer_profile_id_v1'));
    expect(h.calls).toContain(`read:${persona}`);
    expect(sessionStorage.getItem(POST_LOGIN_PROMPT_KEY)).toBe(armed ? '1' : null);
    expect(client.getQueryState(myPersonaQueryKey('u1'))?.isInvalidated).toBe(invalidated);
  });

  it('AuthStepper in-page code sign-in: claims once; linked does not arm the hop', async () => {
    mount(<AuthStepper initialIntent="returning" returnTo="/next" />, '/auth');
    fireEvent.change(await screen.findByPlaceholderText('you@example.com'), { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /send code/i }));
    fireEvent.change(await screen.findByPlaceholderText('Enter code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }));
    await screen.findByText('landed');
    expect(h.calls.filter((c) => c === 'claim_my_dancer_profile_v1')).toHaveLength(1);
    expect(sessionStorage.getItem(POST_LOGIN_PROMPT_KEY)).toBe(armed ? '1' : null);
    expect(client.getQueryState(myPersonaQueryKey('u1'))?.isInvalidated).toBe(invalidated);
  });
});

it('/auth/callback: a claim that hangs does not hold the sign-in (timeout, then the sign-in lands)', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    h.claim = () => new Promise(() => {});
    h.persona = 'u1';
    mount(<AuthCallback />, '/auth/callback?mode=signin');
    await vi.advanceTimersByTimeAsync(4100);
    await waitFor(() => expect(screen.getByText('landed')).toBeTruthy());
  } finally {
    vi.useRealTimers();
  }
});
