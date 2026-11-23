// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({ rpcLoose: vi.fn() }));

vi.mock('@/lib/featureFlags', () => ({ flags: { raffleV2: true } }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (...a: unknown[]) => h.rpcLoose(...a) }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/lib/raffleWaVerify', () => ({
  sendWaConfirmation: vi.fn(async () => 'skipped'),
  pollWaVerifyStatus: vi.fn(async () => 'timeout'),
  sendPoolWaConfirm: vi.fn(async () => 'skipped'),
  pollPoolWaStatus: vi.fn(async () => 'timeout'),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/lib/confetti', () => ({ triggerMicroConfetti: vi.fn() }));
vi.mock('@/components/forms/PhoneInput', () => ({
  PhoneInput: ({ onChange, placeholder, error, inputId }: { onChange: (e: string, v: boolean) => void; placeholder?: string; error?: string | null; inputId?: string }) => (
    <input
      id={inputId}
      data-testid="phone"
      placeholder={placeholder}
      aria-invalid={error ? 'true' : undefined}
      onChange={(e) => (e.target.value === 'bad' ? onChange('+4412', false) : onChange('+447700900123', true))}
    />
  ),
}));
vi.mock('../RafflePhoneInput', () => ({ RafflePhoneInput: () => <input data-testid="old-phone" /> }));

import { RaffleEntryDialog } from '../RaffleEntryDialog';

const open = (props: Record<string, unknown> = {}) =>
  render(<RaffleEntryDialog open onOpenChange={() => {}} consentVersion="v2" onSubmitted={() => {}} redesign {...props} />);

beforeEach(() => { cleanup(); h.rpcLoose.mockReset(); window.sessionStorage.clear(); });

describe('RaffleEntryDialog redesign copy', () => {
  it('exact strings: eyebrow, h2, for-line (picked), label, placeholder, note, submit', async () => {
    open({ nightName: 'Friday Social' });
    const phone = await screen.findByTestId('phone');
    expect(screen.getByTestId('raffle-eyebrow').textContent).toBe('Free raffle');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Enter the raffle');
    expect(screen.getByTestId('raffle-for-line').textContent).toBe('You picked Friday Social. Your entry covers every other night too.');
    expect(screen.getByText('Your mobile number').tagName).toBe('LABEL');
    expect(phone.getAttribute('placeholder')).toBe('07123 456789');
    expect(screen.getByTestId('raffle-note').textContent).toBe('Free · one phone number covers every night');
    expect(screen.getByRole('button', { name: 'Enter the raffle' })).toBeTruthy();
  });

  it('for-line with no night picked', async () => {
    open();
    await screen.findByTestId('phone');
    expect(screen.getByTestId('raffle-for-line').textContent).toBe('One entry puts you in the draw for every night.');
  });

  it('empty submit and invalid submit show their error lines, refocus, and send nothing', async () => {
    open();
    const phone = await screen.findByTestId('phone');
    fireEvent.click(screen.getByRole('button', { name: 'Enter the raffle' }));
    expect(screen.getByTestId('raffle-phone-error').textContent).toBe('Add your mobile number to enter.');
    expect(document.activeElement).toBe(phone);
    fireEvent.change(phone, { target: { value: 'bad' } });
    expect(screen.queryByTestId('raffle-phone-error')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Enter the raffle' }));
    expect(screen.getByTestId('raffle-phone-error').textContent).toBe('That does not look like a UK phone number. Try it like 07123 456789.');
    expect(h.rpcLoose).not.toHaveBeenCalled();
  });

  it('done state: heading, text, Done closes', async () => {
    h.rpcLoose.mockResolvedValue({ data: { ok: true, pool_id: 'p1' }, error: null });
    const onOpenChange = vi.fn();
    const onSubmitted = vi.fn();
    open({ onOpenChange, onSubmitted });
    fireEvent.change(await screen.findByTestId('phone'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter the raffle' }));
    await waitFor(() => expect(screen.getByTestId('raffle-done')).toBeTruthy());
    expect(screen.getByTestId('raffle-done-heading').textContent).toBe('You’re in!');
    expect(screen.getByTestId('raffle-done-text').textContent).toBe('Your number is in the draw for every night. Winners are announced weekly.');
    expect(onSubmitted).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('without redesign the old copy and old phone field stay', async () => {
    render(<RaffleEntryDialog open onOpenChange={() => {}} consentVersion="v2" onSubmitted={() => {}} />);
    await screen.findByTestId('old-phone');
    expect(screen.queryByTestId('raffle-eyebrow')).toBeNull();
    expect(screen.getByRole('button', { name: 'Enter raffle' })).toBeTruthy();
    expect(screen.getByText(/Phone number/)).toBeTruthy();
  });
});
