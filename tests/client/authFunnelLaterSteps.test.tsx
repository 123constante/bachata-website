// @vitest-environment jsdom
/**
 * Auth funnel counter: the steps after the code. Each case must call trackAuthStep with exactly the
 * expected (step, outcome), once; no e-mail, id or name rides along. Supabase and the profile
 * helpers are mocked; nothing here touches a network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { StrictMode, type ReactNode } from 'react';

const track = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const signInWithOtp = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const maybeSingle = vi.hoisted(() => vi.fn());
const user = vi.hoisted(() => ({ id: 'u1', user_metadata: {} as Record<string, unknown> }));

vi.mock('@/lib/trackAuthStep', () => ({ trackAuthStep: track }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    auth: { signInWithOtp, getSession, onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }), toast: vi.fn() }));
vi.mock('@/lib/saveMyDancerProfile', () => ({ saveMyDancerProfile: vi.fn() }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: vi.fn() }));
vi.mock('@/modules/organiser-self-serve/selfServeApi', () => ({ fetchOrganiserHome: vi.fn() }));
vi.mock('@/lib/featureFlags', () => ({ flags: { organiserSelfServe: true } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ onChange }: { onChange: (id: string, city: { name: string }) => void }) => (
    <button type="button" onClick={() => onChange('city-1', { name: 'Madrid' })}>Pick city</button>
  ),
}));

import Auth from '@/pages/Auth';
import AuthCallback from '@/pages/AuthCallback';
import { installJsdomPolyfills } from './jsdomPolyfills';

const calls = () => track.mock.calls.map(([c]) => c);
const only = (step: string) => calls().filter((c) => c.step === step);

const mountAuth = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </MemoryRouter>,
  );

const mountCallback = (strict = false) => {
  const tree = (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/auth/callback?mode=signin&returnTo=%2Faccount']}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<div data-testid="landed" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

beforeEach(() => {
  installJsdomPolyfills();
  document.elementFromPoint = () => null;
  localStorage.clear();
  track.mockReset();
  rpc.mockReset();
  signInWithOtp.mockReset();
  getSession.mockReset();
  maybeSingle.mockReset();
  rpc.mockResolvedValue({ data: null, error: { message: 'permission denied', code: '42501' } });
  maybeSingle.mockResolvedValue({ data: null, error: null });
  getSession.mockResolvedValue({ data: { session: { user } } });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('code_sent outcome', () => {
  const send = (email: string) => {
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
    fireEvent.click(screen.getByRole('button', { name: /email me a (sign-in )?link/i }));
  };

  it('a sign-in for an email with no account is "fallback", not "refused"', async () => {
    signInWithOtp.mockResolvedValue({ data: null, error: { name: 'AuthApiError', status: 422, code: 'otp_disabled', message: 'Signups not allowed for otp' } });
    mountAuth('/auth?mode=signin');
    send('new@example.com');
    await waitFor(() => expect(only('code_sent')).toEqual([{ step: 'code_sent', outcome: 'fallback' }]));
  });

  it('a 403 sign-up refusal (create account, unlisted email) is "refused"', async () => {
    signInWithOtp.mockResolvedValue({ data: null, error: { name: 'AuthApiError', status: 403, code: 'unknown', message: 'Sign-up is limited to approved organisers.' } });
    mountAuth('/auth?mode=signup&userType=dancer');
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    fireEvent.change(await screen.findByLabelText(/first name/i), { target: { value: 'Sam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pick city' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Follower' }));
    const cont = screen.queryByRole('button', { name: /^continue$/i });
    if (cont) fireEvent.click(cont);
    await screen.findByLabelText(/email/i);
    send('stranger@example.com');
    await waitFor(() => expect(only('code_sent')).toEqual([{ step: 'code_sent', outcome: 'refused' }]));
  });
});

describe('callback and landing', () => {
  it('a session records callback ok once and landing ok once', async () => {
    mountCallback();
    await screen.findByTestId('landed');
    expect(only('callback')).toEqual([{ step: 'callback', outcome: 'ok' }]);
    expect(only('landing')).toEqual([{ step: 'landing', outcome: 'ok' }]);
  });

  it('a StrictMode double mount still records callback once', async () => {
    mountCallback(true);
    await screen.findByTestId('landed');
    expect(only('callback')).toHaveLength(1);
    expect(only('landing')).toHaveLength(1);
  });

  it('no session by the 9 s check records callback error (and no landing)', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    vi.useFakeTimers();
    mountCallback();
    await vi.advanceTimersByTimeAsync(9100);
    // the 9 s check ran first and found no session: an expired/missing link is an error
    expect(only('callback')).toEqual([{ step: 'callback', outcome: 'error' }]);
    expect(only('landing')).toEqual([]);
  });

  it('the calls carry only step and outcome', async () => {
    mountCallback();
    await screen.findByTestId('landed');
    for (const c of calls()) expect(Object.keys(c).sort()).toEqual(['outcome', 'step']);
  });
});

describe('callback timeout path', () => {
  it('a session that never arrives by 15 s records callback timeout', async () => {
    // getSession never answers, so the 9 s check stays pending and the 15 s timer fires first.
    getSession.mockReturnValue(new Promise(() => {}));
    vi.useFakeTimers();
    mountCallback();
    await vi.advanceTimersByTimeAsync(15100);
    expect(only('callback')).toEqual([{ step: 'callback', outcome: 'timeout' }]);
  });
});
