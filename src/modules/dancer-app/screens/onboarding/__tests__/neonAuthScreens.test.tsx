// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const verifyOtp = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { verifyOtp: (...a: unknown[]) => verifyOtp(...a) } } }));
vi.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: vi.fn() }));
vi.mock('@/lib/trackAuthStep', () => ({ trackAuthStep: vi.fn() }));
vi.mock('../onboardingV3Flag', () => ({ DANCER_ONBOARDING_V3_ENABLED: true }));

import MagicLinkConfirmation from '@/components/MagicLinkConfirmation';

afterEach(() => {
  cleanup();
  verifyOtp.mockClear();
});

const setup = (extra = {}) => {
  const props = { email: 'a@b.co', onResend: vi.fn().mockResolvedValue('sent'), onChangeEmail: vi.fn(), onVerified: vi.fn(), ...extra };
  render(<MagicLinkConfirmation {...props} />);
  return props;
};

describe('neon code screen (flag on)', () => {
  it('keep-list: heading, sub, 8 boxes, Sign me in disabled, resend line', () => {
    setup();
    expect(screen.getByRole('heading').textContent).toBe('Check your email');
    expect(screen.getByText('Open it on this phone and type the 8 digit code we sent.')).toBeTruthy();
    expect(document.querySelectorAll('.nauth-slot').length).toBe(8);
    expect((screen.getByText('Sign me in') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/^Resend code \(\d+s\)$/)).toBeTruthy();
    expect(screen.getByText('Use a different email')).toBeTruthy();
  });

  it('Sign me in calls the same verify handler once 8 digits are typed; different email calls back', async () => {
    const props = setup();
    const input = document.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1234567' } });
    expect((screen.getByText('Sign me in') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: '12345678' } });
    await waitFor(() => expect(verifyOtp).toHaveBeenCalledTimes(1));
    expect(verifyOtp).toHaveBeenCalledWith({ email: 'a@b.co', token: '12345678', type: 'email' });
    await waitFor(() => expect(props.onVerified).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Use a different email'));
    expect(props.onChangeEmail).toHaveBeenCalled();
  });
});
