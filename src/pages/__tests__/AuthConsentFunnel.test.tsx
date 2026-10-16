// @vitest-environment jsdom
/**
 * D8 + funnel on the /auth code screen:
 *  - sign-UP: the clickwrap line shows under the code box; accept_terms_v1 is called once, on success only;
 *  - sign-IN: shows no clickwrap; an account with no acceptance gets the one-tap card; one with it goes on;
 *  - the funnel RPC (ok / missing / rejecting) never blocks sign-in.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { installJsdomPolyfills } from '../../../tests/client/jsdomPolyfills';
import { TERMS_KIND, TERMS_VERSION } from '@/lib/termsConsent';

// rpc is a plain closure, not vi.fn: a spy that rejects or throws is itself reported as a test error.
const mocks = vi.hoisted(() => {
  const state = { impl: (async () => ({ data: null, error: null })) as (fn: string, args?: unknown) => Promise<unknown>, log: [] as [string, unknown][] };
  return {
    signInWithOtp: vi.fn(),
    verifyOtp: vi.fn(),
    state,
    rpc: (fn: string, args?: unknown) => {
      state.log.push([fn, args]);
      return state.impl(fn, args);
    },
  };
});
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { signInWithOtp: mocks.signInWithOtp, verifyOtp: mocks.verifyOtp }, rpc: mocks.rpc },
}));
vi.mock('@/lib/auth-intent', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth-intent')>()),
  checkAccountExistsByEmail: vi.fn(async () => 'existing'),
}));
vi.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: vi.fn() }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => <div /> }));

import Auth from '@/pages/Auth';

type RpcImpl = { funnel: 'ok' | 'missing' | 'reject'; consents: unknown };
const setRpc = ({ funnel, consents }: RpcImpl) =>
  mocks.state.impl = async (fn: string) => {
    if (fn === 'record_auth_funnel_step_v1') {
      if (funnel === 'reject') throw new Error('network');
      return { data: null, error: funnel === 'missing' ? { code: 'PGRST202' } : null };
    }
    if (fn === 'accept_terms_v1') return { data: { already_accepted: false }, error: null };
    if (fn === 'my_account_export_extras_v1') return { data: { consents }, error: null };
    return { data: null, error: null };
  };

const calls = (fn: string) => mocks.state.log.filter((c) => c[0] === fn);

const renderAuth = (mode: 'signin' | 'signup') =>
  render(
    <MemoryRouter initialEntries={[`/auth?mode=${mode}`]}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/callback" element={<p data-testid="callback">callback</p>} />
      </Routes>
    </MemoryRouter>,
  );

const typeGoodCode = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('8-digit code'), '12345678');
};

/** The 10-minute reload path: the code box is already open for ada@example.com. */
const reopenCodeBox = async (mode: 'signin' | 'signup') => {
  sessionStorage.setItem('auth_code_step_v1', JSON.stringify({ email: 'ada@example.com', mode, at: Date.now(), wrong: 0 }));
  renderAuth(mode);
  await screen.findByText('Check your email');
  return { user: userEvent.setup() };
};

beforeEach(() => {
  installJsdomPolyfills();
  document.elementFromPoint = () => null;
  localStorage.clear();
  sessionStorage.clear();
  mocks.signInWithOtp.mockReset().mockResolvedValue({ error: null });
  mocks.verifyOtp.mockReset().mockResolvedValue({ error: null });
  mocks.state.log = [];
});
afterEach(cleanup);

describe('sign-UP code screen (reopened within 10 minutes)', () => {
  beforeEach(() => {
    setRpc({ funnel: 'ok', consents: [] });
  });

  it('shows the clickwrap with both links; consent is called once, after the code succeeds', async () => {
    const { user } = await reopenCodeBox('signup');
    expect(await screen.findByTestId('auth-consent')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe('/privacy');
    expect(calls('accept_terms_v1')).toHaveLength(0);
    await typeGoodCode(user);
    await screen.findByTestId('callback');
    expect(calls('accept_terms_v1')).toEqual([['accept_terms_v1', { p_kind: TERMS_KIND, p_version: TERMS_VERSION }]]);
    expect(calls('my_account_export_extras_v1')).toHaveLength(0);
  });

  it('a wrong code records no consent', async () => {
    mocks.verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });
    const { user } = await reopenCodeBox('signup');
    await typeGoodCode(user);
    await waitFor(() => expect(mocks.verifyOtp).toHaveBeenCalled());
    expect(calls('accept_terms_v1')).toHaveLength(0);
  });
});

describe('sign-IN code screen', () => {
  it('no clickwrap line; an account that accepted goes straight on', async () => {
    setRpc({ funnel: 'ok', consents: [{ kind: TERMS_KIND, version: TERMS_VERSION }] });
    const { user } = await reopenCodeBox('signin');
    expect(screen.queryByTestId('auth-consent')).toBeNull();
    await typeGoodCode(user);
    await screen.findByTestId('callback');
    expect(calls('accept_terms_v1')).toHaveLength(0);
  });

  it('an existing account with no acceptance sees the one-tap card; one tap records it and goes on', async () => {
    setRpc({ funnel: 'ok', consents: [] });
    const { user } = await reopenCodeBox('signin');
    await typeGoodCode(user);
    expect(await screen.findByTestId('terms-accept-card')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(calls('accept_terms_v1')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Accept and continue' }));
    await screen.findByTestId('callback');
    expect(calls('accept_terms_v1')).toHaveLength(1);
  });

  it('an old version on file is not acceptance of the current one', async () => {
    setRpc({ funnel: 'ok', consents: [{ kind: TERMS_KIND, version: '2020-01-01' }] });
    const { user } = await reopenCodeBox('signin');
    await typeGoodCode(user);
    expect(await screen.findByTestId('terms-accept-card')).toBeTruthy();
  });

  it('a failed consent read never walls sign-in', async () => {
    mocks.state.impl = async () => {
      throw new Error('down');
    };
    const { user } = await reopenCodeBox('signin');
    await typeGoodCode(user);
    await screen.findByTestId('callback');
  });
});

describe.each(['ok', 'missing', 'reject'] as const)('funnel RPC %s', (funnel) => {
  it('never blocks the sign-in', async () => {
    setRpc({ funnel, consents: [{ kind: TERMS_KIND, version: TERMS_VERSION }] });
    const { user } = await reopenCodeBox('signin');
    await typeGoodCode(user);
    await screen.findByTestId('callback');
    const steps = calls('record_auth_funnel_step_v1').map((c) => c[1]);
    expect(steps).toContainEqual({ p_step: 'auth_view', p_outcome: 'ok' });
    expect(steps).toContainEqual({ p_step: 'code_ok', p_outcome: 'ok' });
  });
});

describe('a11y on the code box', () => {
  it('numeric one-time-code input, labelled, errors in an always-mounted live region, focused on open', async () => {
    setRpc({ funnel: 'ok', consents: [] });
    await reopenCodeBox('signin');
    const box = screen.getByLabelText('8-digit code') as HTMLInputElement;
    expect(box.getAttribute('autocomplete')).toBe('one-time-code');
    expect(box.getAttribute('inputmode')).toBe('numeric');
    expect(document.activeElement).toBe(box);
    const live = screen.getByRole('alert');
    expect(live.getAttribute('aria-live')).toBe('assertive');
    expect(box.getAttribute('aria-describedby')).toBe(live.id);
  });
});
