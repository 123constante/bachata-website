// @vitest-environment jsdom
/**
 * D7 (owner decision): the e-mail code box
 *  - survives a page reload for 10 minutes (same e-mail, same step: the same
 *    /auth mode), so a person who reloads while fetching the code is not sent
 *    back to type their e-mail again;
 *  - stops accepting codes after 3 wrong ones and offers "Send a new code"
 *    (also across a reload).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { installJsdomPolyfills } from '../../../tests/client/jsdomPolyfills';

const mocks = vi.hoisted(() => ({ signInWithOtp: vi.fn(), verifyOtp: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { signInWithOtp: mocks.signInWithOtp, verifyOtp: mocks.verifyOtp }, rpc: vi.fn() },
}));
vi.mock('@/lib/auth-intent', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth-intent')>()),
  checkAccountExistsByEmail: vi.fn(async () => 'existing'),
}));
vi.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: vi.fn() }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => <div /> }));

import Auth from '@/pages/Auth';
import { OTP_LIFETIME_SECONDS } from '@/lib/auth-otp-routing';

const renderAuth = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/callback" element={<p data-testid="callback">callback</p>} />
      </Routes>
    </MemoryRouter>,
  );

const reachCodeScreen = async (url = '/auth?mode=signin') => {
  const user = userEvent.setup();
  renderAuth(url);
  await user.type(await screen.findByLabelText('Email'), 'ada@example.com');
  await user.click(screen.getByRole('button', { name: /email me a sign-in link/i }));
  await screen.findByText('Check your email');
  return user;
};

/** A page reload: everything in memory is gone, browser storage stays. */
const reload = (url = '/auth?mode=signin') => {
  cleanup();
  renderAuth(url);
};

const box = () => screen.getByLabelText('8-digit code') as HTMLInputElement;

const typeWrongCodes = async (user: ReturnType<typeof userEvent.setup>, n: number) => {
  for (let i = 1; i <= n; i += 1) {
    await waitFor(() => expect(box().disabled).toBe(false));
    await user.type(box(), '00000000');
    await waitFor(() => expect(mocks.verifyOtp).toHaveBeenCalledTimes(i));
  }
};

beforeEach(() => {
  installJsdomPolyfills();
  document.elementFromPoint = () => null;
  localStorage.clear();
  sessionStorage.clear();
  mocks.signInWithOtp.mockReset();
  mocks.signInWithOtp.mockResolvedValue({ error: null });
  mocks.verifyOtp.mockReset();
  mocks.verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the code step survives a reload for 10 minutes', () => {
  it('reload within 10 minutes: still on the code box, same e-mail', async () => {
    await reachCodeScreen();
    reload();
    expect(await screen.findByText('Check your email')).toBeTruthy();
    expect(screen.getByText('ada@example.com')).toBeTruthy();
    expect(box()).toBeTruthy();
  });

  it('reload after 10 minutes: back to the e-mail form', async () => {
    const t0 = Date.now();
    await reachCodeScreen();
    vi.spyOn(Date, 'now').mockReturnValue(t0 + 10 * 60 * 1000 + 1000);
    reload();
    expect(await screen.findByLabelText('Email')).toBeTruthy();
    expect(screen.queryByText('Check your email')).toBeNull();
  });

  it('another step (the sign-up mode) does not reopen the sign-in code box', async () => {
    await reachCodeScreen();
    reload('/auth?mode=signup');
    await waitFor(() => expect(screen.queryByText('Check your email')).toBeNull());
  });

  it('"Use a different email" forgets it', async () => {
    const user = await reachCodeScreen();
    await user.click(screen.getByRole('button', { name: /use a different email/i }));
    reload();
    expect(await screen.findByLabelText('Email')).toBeTruthy();
    expect(screen.queryByText('Check your email')).toBeNull();
  });
});

describe('3 wrong codes: the box stops accepting and offers "Send a new code"', () => {
  it('locks after the third wrong code; a fourth is never sent; a new code unlocks', async () => {
    const user = await reachCodeScreen();
    await typeWrongCodes(user, 3);
    await waitFor(() => expect(box().disabled).toBe(true));
    expect(screen.getByRole('alert').textContent).toMatch(/Send a new code/);
    const send = screen.getByRole('button', { name: 'Send a new code' }) as HTMLButtonElement;
    // Offered at once, not after the resend cooldown.
    expect(send.disabled).toBe(false);
    await user.type(box(), '11111111');
    expect(mocks.verifyOtp).toHaveBeenCalledTimes(3);
    await user.click(send);
    await waitFor(() => expect(mocks.signInWithOtp).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(box().disabled).toBe(false));
  });

  it('two wrong codes still accept a third try, and say how many are left (flow 4b)', async () => {
    const user = await reachCodeScreen();
    await typeWrongCodes(user, 1);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('That code is not right. Check the latest email. 2 tries left.'));
    await waitFor(() => expect(box().disabled).toBe(false));
    await user.type(box(), '00000000');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('That code is not right. Check the latest email. 1 try left.'));
    await waitFor(() => expect(box().disabled).toBe(false));
    expect(screen.queryByRole('button', { name: 'Send a new code' })).toBeNull();
  });

  it('the lock survives a reload', async () => {
    const user = await reachCodeScreen();
    await typeWrongCodes(user, 3);
    reload();
    await screen.findByText('Check your email');
    expect(box().disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Send a new code' })).toBeTruthy();
  });
});

// F5 (review): GoTrue answers a WRONG code with the same "Token has expired or is invalid" it gives a
// run-out one, often with error.code otp_expired. So neither shape may decide: the time since the code
// was sent, against OTP_LIFETIME_SECONDS, does. Both error shapes x inside / past the lifetime.
const SHAPES = [
  ['code otp_expired', { code: 'otp_expired', message: 'Token has expired or is invalid' }],
  ['message only, no code', { message: 'Token has expired or is invalid' }],
] as const;

describe('wrong vs run out is decided by the send time, never by the error shape (flows 4b / 4c)', () => {
  it.each(SHAPES)('%s, inside the lifetime: a wrong code, counts a try, says how many are left', async (_n, error) => {
    mocks.verifyOtp.mockResolvedValue({ error });
    const user = await reachCodeScreen();
    await typeWrongCodes(user, 1);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('That code is not right. Check the latest email. 2 tries left.'));
    expect(JSON.parse(sessionStorage.getItem('auth_code_step_v1') ?? '{}').wrong).toBe(1);
    expect(box().disabled).toBe(false);
  });

  it.each(SHAPES)('%s, past the lifetime: run out, offers a new code at once, and does not spend a try', async (_n, error) => {
    mocks.verifyOtp.mockResolvedValue({ error });
    const user = await reachCodeScreen();
    const sent = JSON.parse(sessionStorage.getItem('auth_code_step_v1') ?? '{}').at as number;
    const now = vi.spyOn(Date, 'now').mockReturnValue(sent + OTP_LIFETIME_SECONDS * 1000 + 1);
    await typeWrongCodes(user, 1);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('This code has run out. Codes last a few minutes.'));
    expect(JSON.parse(sessionStorage.getItem('auth_code_step_v1') ?? '{}').wrong).toBe(0);
    const send = screen.getByRole('button', { name: 'Send a new code' }) as HTMLButtonElement;
    expect(send.disabled).toBe(false);
    now.mockRestore();
    await user.click(send);
    await waitFor(() => expect(mocks.signInWithOtp).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(box().disabled).toBe(false));
  });

  it('four wrong-code answers in the otp_expired shape still end at the 3-try limit', async () => {
    mocks.verifyOtp.mockResolvedValue({ error: SHAPES[0][1] });
    const user = await reachCodeScreen();
    await typeWrongCodes(user, 3);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Too many tries. Send a new code to carry on.'));
    expect(box().disabled).toBe(true);
  });

  it('4a: the wait reads "Send a new code in Ns" (mockup wording)', async () => {
    await reachCodeScreen();
    expect(screen.getByRole('button', { name: /^Send a new code in \d+s$/ })).toBeTruthy();
  });
});
