// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({
  flag: { raffleV2: true, raffleWinnerHeadsup: true } as Record<string, boolean>,
  rpcLoose: vi.fn(),
  sent: { v: 'skipped' as string },
  verdict: { v: 'timeout' as string },
}));

vi.mock('@/lib/featureFlags', () => ({ flags: h.flag }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (...a: unknown[]) => h.rpcLoose(...a) }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/lib/raffleWaVerify', () => ({
  sendWaConfirmation: vi.fn(async () => 'skipped'),
  pollWaVerifyStatus: vi.fn(async () => 'timeout'),
  sendPoolWaConfirm: vi.fn(async () => h.sent.v),
  pollPoolWaStatus: vi.fn(async () => h.verdict.v),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/lib/confetti', () => ({ triggerMicroConfetti: vi.fn() }));
vi.mock('@/components/forms/PhoneInput', () => ({
  PhoneInput: ({ onChange }: { onChange: (e: string, v: boolean) => void }) => (
    <input data-testid="phone" onChange={() => onChange('+447700900123', true)} />
  ),
}));
vi.mock('../RafflePhoneInput', () => ({
  RafflePhoneInput: ({ onChange }: { onChange: (e: string, v: boolean) => void }) => (
    <input data-testid="phone" onChange={() => onChange('+447700900123', true)} />
  ),
}));

import { RaffleEntryDialog } from '../RaffleEntryDialog';

const TEXT = 'Winners get a WhatsApp from Ricky at Bachata Calendar. Keep an eye out!';
const ID = 'raffle-winner-headsup';

function open(props: Record<string, unknown> = {}) {
  return render(<RaffleEntryDialog open onOpenChange={() => {}} eventId="evt-1" consentVersion="v2" onSubmitted={() => {}} {...props} />);
}
async function enter(name: RegExp) {
  fireEvent.change(await screen.findByTestId('phone'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name }));
}

beforeEach(() => {
  cleanup();
  h.rpcLoose.mockReset();
  h.rpcLoose.mockResolvedValue({ data: { ok: true, pool_id: 'p1' }, error: null });
  h.flag.raffleV2 = true;
  h.flag.raffleWinnerHeadsup = true;
  h.sent.v = 'skipped';
  h.verdict.v = 'timeout';
  window.sessionStorage.clear();
});

describe.each([true, false])('raffleWinnerHeadsup = %s', (on) => {
  beforeEach(() => { h.flag.raffleWinnerHeadsup = on; });
  const check = () => {
    if (on) expect(screen.getByTestId(ID).textContent).toBe(TEXT);
    else expect(screen.queryByTestId(ID)).toBeNull();
  };

  it('redesign form', async () => { open({ redesign: true }); await screen.findByTestId('phone'); check(); });
  it('v2 non-redesign form', async () => { open(); await screen.findByTestId('phone'); check(); });
  it('legacy form', async () => { h.flag.raffleV2 = false; open(); await screen.findByTestId('phone'); check(); });

  it('redesign done', async () => {
    open({ redesign: true });
    await enter(/Enter the raffle/i);
    await waitFor(() => expect(screen.getByTestId('raffle-done')).toBeTruthy());
    check();
  });
  it('success_verified', async () => {
    h.sent.v = 'sent'; h.verdict.v = 'verified';
    open();
    await enter(/Enter raffle/i);
    await screen.findByText(/check WhatsApp/i);
    check();
  });
  it('success_neutral', async () => {
    open();
    await enter(/Enter raffle/i);
    await screen.findByText(/if you win/i);
    check();
  });
});

describe('keep-list with flag on', () => {
  it('form keeps phone input and submit', async () => {
    open({ redesign: true });
    expect(await screen.findByTestId('phone')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enter the raffle' })).toBeTruthy();
    expect(screen.getByTestId(ID)).toBeTruthy();
  });
  it('done keeps heading, text and Done', async () => {
    open({ redesign: true });
    await enter(/Enter the raffle/i);
    await waitFor(() => expect(screen.getByTestId('raffle-done')).toBeTruthy());
    expect(screen.getByTestId('raffle-done-heading')).toBeTruthy();
    expect(screen.getByTestId('raffle-done-text')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
  });
});
