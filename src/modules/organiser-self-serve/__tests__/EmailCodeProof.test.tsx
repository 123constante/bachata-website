// @vitest-environment jsdom
/** S7: the emailed-code box must not hard-code 6 digits (prod and E2E issue 8). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const auth = vi.hoisted(() => ({ signInWithOtp: vi.fn(), verifyOtp: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth } }));

import { EmailCodeProof } from '../components/EmailCodeProof';

async function mountSent(onProven = vi.fn()) {
  render(<EmailCodeProof email="a@b.example" onProven={onProven} />);
  fireEvent.click(screen.getByTestId('email-code-send'));
  const input = (await screen.findByTestId('email-code-input')) as HTMLInputElement;
  return { input, onProven };
}
const confirm = () => fireEvent.click(screen.getByTestId('email-code-verify'));

beforeEach(() => {
  auth.signInWithOtp.mockReset().mockResolvedValue({ error: null });
  auth.verifyOtp.mockReset().mockResolvedValue({ error: null });
});
afterEach(cleanup);

describe('EmailCodeProof code length (S7)', () => {
  it('does not promise or cap 6 digits', async () => {
    const { input } = await mountSent();
    expect(input.maxLength).toBeGreaterThanOrEqual(10);
    expect(document.body.textContent).not.toMatch(/6-digit/);
    expect(input.getAttribute('aria-label')).toMatch(/code from your email/i);
  });

  it('verifies an 8-digit code (the E2E and prod length)', async () => {
    const { input, onProven } = await mountSent();
    fireEvent.change(input, { target: { value: '12345678' } });
    confirm();
    await waitFor(() => expect(onProven).toHaveBeenCalled());
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.example', token: '12345678', type: 'email' });
  });

  it('still verifies a 6-digit code', async () => {
    const { input, onProven } = await mountSent();
    fireEvent.change(input, { target: { value: '123456' } });
    confirm();
    await waitFor(() => expect(onProven).toHaveBeenCalled());
  });

  it('rejects too-short codes without calling the server, and says it in plain words', async () => {
    const { input } = await mountSent();
    fireEvent.change(input, { target: { value: '12345' } });
    confirm();
    expect((await screen.findByRole('alert')).textContent).toBe('Enter the code from your email.');
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
});

describe('EmailCodeProof resend cooldown', () => {
  it('disables Resend for 30 seconds after a send, then re-enables it', async () => {
    vi.useFakeTimers();
    try {
      render(<EmailCodeProof email="a@b.example" onProven={vi.fn()} />);
      fireEvent.click(screen.getByTestId('email-code-send'));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      const resend = screen.getByTestId('email-code-resend') as HTMLButtonElement;
      expect(resend.disabled).toBe(true);
      expect(resend.textContent).toBe('Resend in 30s');
      for (let i = 0; i < 30; i++) await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      expect(resend.disabled).toBe(false);
      expect(resend.textContent).toBe('Resend');
    } finally {
      vi.useRealTimers();
    }
  });
});
