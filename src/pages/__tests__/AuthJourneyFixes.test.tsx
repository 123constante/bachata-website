// @vitest-environment jsdom
/**
 * New-dancer journey audit (2026-10-16), /auth findings owned by the auth slice:
 *  H7  a refused resend says so under the code box; the cooldown matches Supabase's 60 s.
 *  H8  the terms card's links open without leaving the page; the spent code step is forgotten.
 *  H9  "Continue browsing" never sends a signed-out visitor to the signed-in landing.
 *  M7  sign-up shows the clickwrap before "Email me a link", worded for that button.
 *  M15 filling the last details field does not jump to the e-mail step.
 *  M18 a refused sign-up is not told it is "limited to approved organisers".
 *  L5  no "3 easy steps" count.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { installJsdomPolyfills } from '../../../tests/client/jsdomPolyfills';

const mocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  rpc: vi.fn(async (fn: string) =>
    fn === 'my_account_export_extras_v1' ? { data: { consents: [] }, error: null }
    : fn === 'dancer_area_gate_v1' ? { data: { open: true, allowed: true }, error: null }
    : { data: null, error: null }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { signInWithOtp: mocks.signInWithOtp, verifyOtp: mocks.verifyOtp }, rpc: mocks.rpc },
}));
vi.mock('@/lib/auth-intent', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth-intent')>()),
  checkAccountExistsByEmail: vi.fn(async () => 'existing'),
}));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  return { ...real, flags: { ...real.flags, organiserSelfServe: true } };
});
vi.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: vi.fn() }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
// A stand-in picker: one tap picks London, so the details step can be filled.
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ onChange }: { onChange: (id: string, obj?: { name: string }) => void }) => (
    <button type="button" onClick={() => onChange('c-london', { name: 'London' })}>
      pick city
    </button>
  ),
}));

import Auth from '@/pages/Auth';

const renderAuth = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/callback" element={<p data-testid="callback">callback</p>} />
        <Route path="/account/continue" element={<p data-testid="signed-in-landing">landing</p>} />
        <Route path="/" element={<p data-testid="home">home</p>} />
        <Route path="/event/:id" element={<p data-testid="event">event</p>} />
      </Routes>
    </MemoryRouter>,
  );

const reopenCodeBox = async (mode: 'signin' | 'signup', url = `/auth?mode=${mode}`) => {
  sessionStorage.setItem('auth_code_step_v1', JSON.stringify({ email: 'ada@example.com', mode, at: Date.now(), wrong: 0 }));
  renderAuth(url);
  await screen.findByText('Check your email');
};

beforeEach(() => {
  installJsdomPolyfills();
  document.elementFromPoint = () => null;
  localStorage.clear();
  sessionStorage.clear();
  mocks.signInWithOtp.mockReset().mockResolvedValue({ error: null });
  mocks.verifyOtp.mockReset().mockResolvedValue({ error: null });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('H7: resend on the code step', () => {
  it('starts at a 60 s cooldown', async () => {
    await reopenCodeBox('signin');
    expect(screen.getByRole('button', { name: /resend code in 60s/i })).toBeTruthy();
  });

  it('a refused (429) resend says so under the code box and waits again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await reopenCodeBox('signin');
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });
    mocks.signInWithOtp.mockResolvedValue({ error: { status: 429, code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 60 seconds.' } });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole('button', { name: /^resend code$/i }));
    expect(await screen.findByText(/wait a minute, then try again/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /resend code in \d+s/i })).toBeTruthy();
  });
});

describe('H8: terms accept card (sign-in, nothing on file)', () => {
  it('opens Terms and Privacy without leaving the page, and forgets the spent code step', async () => {
    await reopenCodeBox('signin');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('8-digit code'), '12345678');
    expect(await screen.findByTestId('terms-accept-card')).toBeTruthy();
    for (const name of ['Terms', 'Privacy Policy']) {
      const link = screen.getByRole('link', { name });
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
    expect(sessionStorage.getItem('auth_code_step_v1')).toBeNull();
    expect(screen.getByText(/accept our/i).textContent).not.toMatch(/updated how we ask/i);
  });
});

describe('H9: Continue browsing (signed out, organiser self-serve on)', () => {
  it('sign-in form: goes home, not to the signed-in landing', async () => {
    renderAuth('/auth?mode=signin');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Continue browsing' }));
    expect(await screen.findByTestId('home')).toBeTruthy();
  });

  it('sign-in code step: goes to the explicit returnTo', async () => {
    await reopenCodeBox('signin', '/auth?mode=signin&returnTo=%2Fevent%2Fabc');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Continue browsing' }));
    expect(await screen.findByTestId('event')).toBeTruthy();
  });

  it('sign-up (focus mode) has no second exit: only the top bar\'s "Not now"', async () => {
    renderAuth('/auth?mode=signup');
    await screen.findByText('Join the community');
    expect(screen.queryByRole('button', { name: 'Continue browsing' })).toBeNull();
  });
});

describe('sign-up steps', () => {
  const toDetails = async () => {
    const user = userEvent.setup();
    renderAuth('/auth?mode=signup');
    await user.click(await screen.findByRole('button', { name: /^continue as dancer$/i }));
    await screen.findByText('A little about you');
    return user;
  };
  const fillDetails = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText('First name'), 'Ada');
    await user.click(screen.getByRole('button', { name: 'pick city' }));
    await user.click(screen.getAllByRole('radio')[0]);
  };

  it('M15: filling the last field stays on details until Continue', async () => {
    const user = await toDetails();
    await fillDetails(user);
    // The e-mail step must not appear on its own (give the step animation time to run).
    await expect(screen.findByLabelText('Email', {}, { timeout: 800 })).rejects.toThrow();
    expect(screen.getByText('A little about you')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(await screen.findByLabelText('Email')).toBeTruthy();
  });

  it('M7: the clickwrap is on the e-mail step, worded for its button; L5: no "3 easy steps"', async () => {
    const user = await toDetails();
    expect(screen.queryByText(/3 easy steps/i)).toBeNull();
    await fillDetails(user);
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    const consent = await screen.findByTestId('auth-consent');
    expect(consent.textContent).toMatch(/^By tapping Email me a link you agree to our Terms and Privacy Policy\.$/);
  });

  it('M18: a refused sign-up hears neutral copy and a neutral WhatsApp prefill', async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: { status: 403, message: 'Sign-up is limited to approved organisers.' } });
    const user = await toDetails();
    await fillDetails(user);
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    await user.type(await screen.findByLabelText('Email'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Email me a link' }));
    const error = await screen.findByText(/message us/i, { selector: '[id]' });
    expect(error.textContent).not.toMatch(/organiser/i);
    const wa = screen.getByRole('link', { name: 'Message us on WhatsApp' }).getAttribute('href') ?? '';
    expect(decodeURIComponent(wa)).not.toMatch(/list my events/i);
  });
});
