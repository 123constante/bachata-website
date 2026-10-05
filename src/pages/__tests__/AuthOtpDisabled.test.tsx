// @vitest-environment jsdom
/**
 * Lever 2 walk B3: a brand-new email on "Sign in to claim"
 * (/auth?mode=signin&returnTo=...) used to dead-end on "Signups are disabled
 * for OTP". account_exists_by_email is anon-denied (by design: no email
 * enumeration), so the pre-lookup answers "unknown" and the 422 otp_disabled
 * from signInWithOtp({ shouldCreateUser: false }) is the first "no account"
 * signal. The page must move to "Create account" keeping the email and
 * returnTo. The Supabase client is mocked; nothing here touches a network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

const rpc = vi.hoisted(() => vi.fn());
const signInWithOtp = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, auth: { signInWithOtp } },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => null }));

import Auth from '../Auth';

const RETURN_TO = '/organisers/ritmo';
let lastSearch = '';
function LocationProbe() {
  lastSearch = useLocation().search;
  return null;
}

function mount(path = `/auth?mode=signin&returnTo=${encodeURIComponent(RETURN_TO)}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth" element={<><Auth /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function sendMagicLink(email: string) {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: /send magic link/i }));
}

beforeEach(() => {
  localStorage.clear();
  lastSearch = '';
  rpc.mockReset();
  signInWithOtp.mockReset();
  toast.mockReset();
  // anon is denied EXECUTE on account_exists_by_email: the lookup is "unknown".
  rpc.mockResolvedValue({ data: null, error: { message: 'permission denied', code: '42501' } });
});
afterEach(cleanup);

describe('Auth sign-in with an email that has no account', () => {
  it('on 422 otp_disabled switches to Create account, keeping returnTo', async () => {
    signInWithOtp.mockResolvedValue({
      data: null,
      error: { name: 'AuthApiError', status: 422, code: 'otp_disabled', message: 'Signups not allowed for otp' },
    });
    mount();
    await sendMagicLink('new.organiser@example.com');

    await waitFor(() => expect(screen.getByText('No account for this email yet. Create one to continue.')).toBeTruthy());
    await waitFor(() => expect(new URLSearchParams(lastSearch).get('mode')).toBe('signup'));
    // Still showing once the mode has settled on sign-up (the sign-in effect
    // that clears the notice must not have fired).
    expect(screen.getByText('No account for this email yet. Create one to continue.')).toBeTruthy();
    const params = new URLSearchParams(lastSearch);
    expect(params.get('returnTo')).toBe(RETURN_TO);
    expect(signInWithOtp).toHaveBeenCalledTimes(1);
    expect(signInWithOtp.mock.calls[0][0]).toMatchObject({
      email: 'new.organiser@example.com',
      options: { shouldCreateUser: false },
    });
    // No dead-end toast.
    expect(toast).not.toHaveBeenCalled();
    expect(screen.queryByText(/Signups are disabled for OTP/)).toBeNull();
    // The sign-in card is gone and the email the user typed is kept in the form.
    expect(screen.queryByRole('button', { name: /send magic link/i })).toBeNull();
    expect(localStorage.getItem('auth_last_email')).toBeNull();
  });

  it('a different send failure in sign-in mode still shows the generic toast and stays in sign-in', async () => {
    signInWithOtp.mockResolvedValue({ data: null, error: { status: 500, message: 'boom' } });
    mount();
    await sendMagicLink('someone@example.com');

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast.mock.calls[0][0]).toMatchObject({ title: 'Unable to send link' });
    expect(new URLSearchParams(lastSearch).get('mode')).toBe('signin');
  });

  it('an existing account (send succeeds) stays in sign-in and shows the sent state', async () => {
    signInWithOtp.mockResolvedValue({ data: {}, error: null });
    mount();
    await sendMagicLink('known@example.com');

    await waitFor(() => expect(localStorage.getItem('auth_last_email')).toBe('known@example.com'));
    expect(new URLSearchParams(lastSearch).get('mode')).toBe('signin');
    const redirect = new URL(signInWithOtp.mock.calls[0][0].options.emailRedirectTo);
    expect(redirect.searchParams.get('returnTo')).toBe(RETURN_TO);
  });
});
