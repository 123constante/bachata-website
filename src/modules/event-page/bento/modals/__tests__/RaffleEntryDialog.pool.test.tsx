// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({
  flag: { raffleV2: true },
  rpcLoose: vi.fn(),
  legacyRpc: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/lib/featureFlags', () => ({ flags: h.flag }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (...a: unknown[]) => h.rpcLoose(...a) }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => h.legacyRpc(...a) } }));
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
import { rafflePoolJoinedKey } from '@/lib/raffleSession';

async function submit(onSubmitted = vi.fn()) {
  render(<RaffleEntryDialog open onOpenChange={() => {}} eventId="evt-1" consentVersion="v2" onSubmitted={onSubmitted} />);
  fireEvent.change(await screen.findByTestId('phone'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /I agree/i }));
  fireEvent.click(screen.getByRole('button', { name: /Enter raffle/i }));
  return onSubmitted;
}

beforeEach(() => {
  cleanup();
  h.rpcLoose.mockReset(); h.legacyRpc.mockReset(); h.toastError.mockReset();
  window.sessionStorage.clear();
});

describe('flag ON -> raffle_join_pool_v1', () => {
  beforeEach(() => { h.flag.raffleV2 = true; });

  it('already_in shows the in-pool state, no error, key set, no event id', async () => {
    h.rpcLoose.mockResolvedValue({ data: { ok: true, already_in: true, pool_id: 'p1' }, error: null });
    const cb = await submit();
    expect(await screen.findByTestId('raffle-already-in')).toBeTruthy();
    expect(h.toastError).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(rafflePoolJoinedKey)).toBe('1');
    expect(cb).toHaveBeenCalled();
    const [name, args] = h.rpcLoose.mock.calls[0];
    expect(name).toBe('raffle_join_pool_v1');
    expect(args).not.toHaveProperty('p_event_id');
    expect(Object.keys(args).sort()).toEqual(['p_consent_version', 'p_first_name', 'p_honeypot', 'p_phone', 'p_session_id']);
    expect(h.legacyRpc).not.toHaveBeenCalled();
  });

  it('ok sets the key and ends in a success state', async () => {
    h.rpcLoose.mockResolvedValue({ data: { ok: true, pool_id: 'p1' }, error: null });
    await submit();
    await waitFor(() => expect(screen.getByText(/You're in! Good luck/)).toBeTruthy());
    expect(window.sessionStorage.getItem(rafflePoolJoinedKey)).toBe('1');
  });

  it.each([
    ['name_required', /first name/],
    ['name_too_long', /too long/],
    ['phone_invalid', /valid phone/],
    ['consent_required', /privacy terms/],
    ['rate_limited', /Too many entries/],
    ['removed', /can't enter/],
  ])('reason %s shows its message and leaves the key unset', async (reason, re) => {
    h.rpcLoose.mockResolvedValue({ data: { ok: false, reason }, error: null });
    await submit();
    await waitFor(() => expect(h.toastError).toHaveBeenCalled());
    expect(h.toastError.mock.calls[0][0]).toMatch(re);
    expect(window.sessionStorage.getItem(rafflePoolJoinedKey)).toBeNull();
  });

  it('network error shows the network message, key unset', async () => {
    h.rpcLoose.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await submit();
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith(expect.stringMatching(/Network error/)));
    expect(window.sessionStorage.getItem(rafflePoolJoinedKey)).toBeNull();
  });
});

describe('flag OFF -> submit_raffle_entry as on main', () => {
  beforeEach(() => { h.flag.raffleV2 = false; });

  it('calls submit_raffle_entry with the event id and never sets the pool key', async () => {
    h.legacyRpc.mockResolvedValue({ data: { ok: true, entry_id: 'e1' }, error: null });
    await submit();
    await waitFor(() => expect(h.legacyRpc).toHaveBeenCalled());
    expect(h.legacyRpc.mock.calls[0][0]).toBe('submit_raffle_entry');
    expect(h.legacyRpc.mock.calls[0][1].p_event_id).toBe('evt-1');
    expect(h.rpcLoose).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(rafflePoolJoinedKey)).toBeNull();
  });

  it('already_entered still shows the legacy ack without the pool testid', async () => {
    h.legacyRpc.mockResolvedValue({ data: { ok: false, reason: 'already_entered' }, error: null });
    await submit();
    expect(await screen.findByText(/already in/i)).toBeTruthy();
    expect(screen.queryByTestId('raffle-already-in')).toBeNull();
  });

  it('removed is not a reason flag-OFF knows... still safe: generic message', async () => {
    h.legacyRpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    await submit();
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith(expect.stringMatching(/Network error/)));
  });
});
