// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({ rpcLoose: vi.fn(), toastError: vi.fn() }));

vi.mock('@/lib/featureFlags', () => ({ flags: { raffleV2: true } }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (...a: unknown[]) => h.rpcLoose(...a) }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/lib/raffleWaVerify', () => ({
  sendWaConfirmation: vi.fn(async () => 'skipped'),
  pollWaVerifyStatus: vi.fn(async () => 'timeout'),
  sendPoolWaConfirm: vi.fn(async () => 'skipped'),
  pollPoolWaStatus: vi.fn(async () => 'timeout'),
}));
vi.mock('sonner', () => ({ toast: { error: (m: string) => h.toastError(m), success: vi.fn() } }));
vi.mock('@/lib/confetti', () => ({ triggerMicroConfetti: vi.fn() }));
vi.mock('../RafflePhoneInput', () => ({
  RafflePhoneInput: ({ onChange }: { onChange: (e: string, v: boolean) => void }) => (
    <input data-testid="phone" onChange={() => onChange('+447700900123', true)} />
  ),
}));

import { RaffleEntryDialog } from '../RaffleEntryDialog';

async function open() {
  render(<RaffleEntryDialog open onOpenChange={() => {}} eventId="e" consentVersion="v2" onSubmitted={vi.fn()} />);
  return screen.findByTestId('phone');
}
async function enter() {
  fireEvent.change(await open(), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: /Enter raffle/i }));
}

beforeEach(() => { cleanup(); h.rpcLoose.mockReset(); h.toastError.mockReset(); window.sessionStorage.clear(); });

describe('raffle entry sheet v3 (flag on)', () => {
  it('shows the phone-only form: subline, label, no notice, no checkboxes, privacy line, Cancel', async () => {
    await open();
    expect(screen.getByText('Enter your phone number. If you win, we contact you on WhatsApp.')).toBeTruthy();
    expect(screen.queryByText(/Winners are contacted on WhatsApp only/)).toBeNull();
    expect(screen.getByText(/Phone number/)).toBeTruthy();
    expect(screen.getByText('(needs WhatsApp)')).toBeTruthy();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByText(/By entering you agree we store your number for the raffle/)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Privacy policy' });
    expect(link.getAttribute('href')).toBe('/privacy');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('Enter raffle is full width and disabled until the phone is valid', async () => {
    const phone = await open();
    const btn = screen.getByRole('button', { name: /Enter raffle/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.className).toContain('w-full');
    fireEvent.change(phone, { target: { value: '1' } });
    expect(btn.disabled).toBe(false);
  });

  it('already_in shows the You\'re in! screen with no "already" wording', async () => {
    h.rpcLoose.mockResolvedValue({ data: { ok: true, already_in: true, pool_id: 'p' }, error: null });
    await enter();
    const el = await screen.findByTestId('raffle-already-in');
    expect(el.textContent).toContain("You're in!");
    expect(el.textContent).toContain("We'll message you on WhatsApp if you win. Good luck!");
    expect(el.textContent).not.toMatch(/already/i);
  });

  it('fresh entry ends on You\'re in!', async () => {
    h.rpcLoose.mockResolvedValue({ data: { ok: true, pool_id: 'p' }, error: null });
    await enter();
    await waitFor(() => expect(screen.getByText("You're in!")).toBeTruthy());
    expect(screen.getByText("We'll message you on WhatsApp if you win. Good luck!")).toBeTruthy();
  });

  it('already won shows You\'ve won! and no come-back-next-week copy', async () => {
    h.rpcLoose.mockResolvedValue({ data: { ok: false, reason: 'already_won_this_event' }, error: null });
    await enter();
    const el = await screen.findByTestId('raffle-already-won');
    expect(el.textContent).toContain("You've won!");
    expect(el.textContent).toContain('Check WhatsApp for your prize link.');
    expect(el.textContent).not.toMatch(/next week/i);
  });

  it('closed raffle says This raffle has closed.', async () => {
    h.rpcLoose.mockResolvedValue({ data: { ok: false, reason: 'cutoff_passed' }, error: null });
    await enter();
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith('This raffle has closed.'));
  });

  it('sends the same args as before (no new params)', async () => {
    h.rpcLoose.mockResolvedValue({ data: { ok: true, pool_id: 'p' }, error: null });
    await enter();
    const [, args] = h.rpcLoose.mock.calls[0];
    expect(Object.keys(args).sort()).toEqual(['p_consent_version', 'p_first_name', 'p_honeypot', 'p_phone', 'p_session_id']);
    expect(args.p_consent_version).toBe('v2');
  });
});
