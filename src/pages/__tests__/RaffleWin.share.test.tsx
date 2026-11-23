// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const h = vi.hoisted(() => ({ rpc: vi.fn(), flags: { raffleV2: true, raffleSharePoster: true } }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (fn: string, a?: unknown) => h.rpc(fn, a) }));
vi.mock('@/lib/featureFlags', () => ({ flags: h.flags }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u', is_anonymous: false }, isLoading: false }) }));
vi.mock('@/modules/tickets/TicketQrCode', () => ({ default: () => <div>QRCODE</div> }));
vi.mock('@/modules/raffle-win/sharePoster', async (orig) => ({
  ...(await orig<typeof import('@/modules/raffle-win/sharePoster')>()),
  renderPoster: () => Promise.resolve(),
}));

import RaffleWin from '../RaffleWin';

const night = { occurrence_id: 'o1', title: 'Friday Bachata', start_local: '2026-12-04T20:00:00' };
const claim = (win: object = {}) => ({ data: { ok: true, first_name: 'Maya', win: { id: 'w1', state: 'contacted', ...win }, open_nights: [night] }, error: null });
const lockOk = { data: { ok: true, first_name: 'Maya', win: { id: 'w1', qr_token: 'tok', night } }, error: null };

function mount() {
  return render(
    <MemoryRouter initialEntries={['/raffle/win/t']}>
      <Routes><Route path="/raffle/win/:token" element={<RaffleWin />} /></Routes>
    </MemoryRouter>,
  );
}
async function toLock() {
  fireEvent.click(await screen.findByText('Choose my night'));
  fireEvent.click(screen.getByText('Friday Bachata'));
  fireEvent.click(screen.getByText('Lock this night'));
  fireEvent.click(screen.getByLabelText(/never been/));
  fireEvent.click(screen.getByText('Confirm and get my QR'));
}

describe('RaffleWin share step', () => {
  beforeEach(() => {
    h.rpc.mockReset();
    h.rpc.mockImplementation((fn: string) => Promise.resolve(
      fn === 'raffle_win_claim_link_v1' ? claim() : fn === 'raffle_win_lock_v2' ? lockOk : { data: { pool_count: 5 }, error: null }));
  });
  afterEach(() => { cleanup(); h.flags.raffleSharePoster = true; });

  it('flag ON: lock -> share -> skip -> qr', async () => {
    mount(); await toLock();
    expect(await screen.findByText('Share your win')).toBeTruthy();
    expect(screen.getByText('Save image')).toBeTruthy();
    fireEvent.click(screen.getByText('Skip, show my QR'));
    expect(await screen.findByText('QRCODE')).toBeTruthy();
  });
  it('flag OFF: lock -> qr, no share step', async () => {
    h.flags.raffleSharePoster = false;
    mount(); await toLock();
    expect(await screen.findByText('QRCODE')).toBeTruthy();
    expect(screen.queryByText('Share your win')).toBeNull();
  });
  it('already locked -> qr straight away', async () => {
    h.rpc.mockImplementation(() => Promise.resolve(claim({ state: 'locked', qr_token: 'tok', night })));
    mount();
    expect(await screen.findByText('QRCODE')).toBeTruthy();
  });
  it.each([true, false])('keep-list controls render with flag %s', async (on) => {
    h.flags.raffleSharePoster = on;
    mount();
    expect(await screen.findByText('Choose my night')).toBeTruthy();
    fireEvent.click(screen.getByText('Choose my night'));
    expect(screen.getByText('Lock this night')).toBeTruthy();
    fireEvent.click(screen.getByText('Friday Bachata'));
    fireEvent.click(screen.getByText('Lock this night'));
    await waitFor(() => expect(screen.getByText('Confirm and get my QR')).toBeTruthy());
    expect(screen.getByText('Back')).toBeTruthy();
  });
});
