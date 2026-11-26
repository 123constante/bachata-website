// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const h = vi.hoisted(() => ({ rpc: vi.fn(), flags: { raffleV2: true, raffleSharePoster: true } }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (fn: string, a?: unknown) => h.rpc(fn, a) }));
vi.mock('@/lib/featureFlags', () => ({ flags: h.flags }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, isLoading: false }) }));
vi.mock('@/modules/tickets/TicketQrCode', () => ({ default: () => <div>QRCODE</div> }));

import RaffleWin from '../RaffleWin';

function mount() {
  return render(
    <MemoryRouter initialEntries={['/raffle/win/tok-1']}>
      <Routes><Route path="/raffle/win/:token" element={<RaffleWin />} /></Routes>
    </MemoryRouter>,
  );
}

describe('RaffleWin link-opened mark', () => {
  beforeEach(() => { h.rpc.mockReset(); });
  afterEach(() => cleanup());

  it('calls raffle_win_link_opened_v1 once with the token', async () => {
    h.rpc.mockResolvedValue({ data: null, error: null });
    mount();
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('raffle_win_link_opened_v1', { p_link_token: 'tok-1' }));
    expect(h.rpc.mock.calls.filter((c) => c[0] === 'raffle_win_link_opened_v1')).toHaveLength(1);
  });

  it('a rejected rpc leaves the page rendered with no error UI', async () => {
    h.rpc.mockRejectedValue(new Error('boom'));
    mount();
    await waitFor(() => expect(h.rpc).toHaveBeenCalled());
    expect(await screen.findByText('Sign in to claim')).toBeTruthy();
    expect(screen.queryByText(/boom/)).toBeNull();
  });
});
