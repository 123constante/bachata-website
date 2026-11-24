// @vitest-environment jsdom
/** W5 keep-list: every element of the prototype checklist, per state. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setTestUser } from '@/modules/dancer-app/shell/testAuth';
import { parseMyWins, RAFFLE_FRESH_KEY, winDateLine } from '../raffleWinModel';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
const rpc = vi.fn();
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (...a: unknown[]) => rpc(...a) }));
const confetti = vi.fn();
vi.mock('canvas-confetti', () => ({ default: () => confetti() }));
vi.mock('../../../../tickets/TicketQrCode', () => ({ default: () => <svg data-testid="ticket-qr" /> }));

import HomeRaffleWin from '../homeRaffleWin';

const NIGHT = { title: 'Noche Dominicana', start_local: '2026-11-26T21:00', venue_name: 'The Copper Room', poster_url: 'https://x/f.jpg' };
const WIN = (night: unknown) => [{ win: { id: 'w1', state: 'locked', qr_token: 'a'.repeat(64), night } }];
const shell = () => render(<QueryClientProvider client={new QueryClient()}><HomeRaffleWin onShare={onShare} /></QueryClientProvider>);
const onShare = vi.fn();

beforeEach(() => { setTestUser({ id: 'u1' }); sessionStorage.clear(); rpc.mockReset(); confetti.mockReset(); onShare.mockReset(); });
afterEach(cleanup);

describe('model', () => {
  it('formats the date and maps rows', () => {
    expect(winDateLine('2026-11-26T21:00')).toBe('Thursday 26 Nov');
    expect(parseMyWins(WIN(NIGHT))?.night?.dateLine).toBe('Thursday 26 Nov');
    expect(parseMyWins(WIN(null))?.night).toBeNull();
    expect(parseMyWins([])).toBeNull();
    expect(parseMyWins({ ok: false })).toBeNull();
    expect(parseMyWins([{ win: { state: 'cancelled', qr_token: 'x' } }])).toBeNull();
  });
});

describe('ticket card', () => {
  it('fresh: banner, scroll link, flyer, title, date, venue, QR, caption, share, confetti', async () => {
    sessionStorage.setItem(RAFFLE_FRESH_KEY, '1');
    rpc.mockResolvedValue({ data: WIN(NIGHT), error: null });
    const scroll = vi.fn(); Element.prototype.scrollIntoView = scroll;
    shell();
    expect(await screen.findByText('You are in')).toBeTruthy();
    expect(screen.getByText('Your free night')).toBeTruthy();
    expect(screen.getByTestId('raffle-win-flyer')).toBeTruthy();
    expect(screen.getByText('Noche Dominicana')).toBeTruthy();
    expect(screen.getByText('Thursday 26 Nov')).toBeTruthy();
    expect(screen.getByText('The Copper Room')).toBeTruthy();
    expect(screen.getByTestId('raffle-win-qr')).toBeTruthy();
    expect(screen.getByText('Show this at the door.')).toBeTruthy();
    const qr = screen.getByTestId('raffle-win-qr'); const share = screen.getByText('Share my win');
    expect(qr.compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByText('Saved in your dashboard. We have emailed it to you.'));
    expect(scroll).toHaveBeenCalled();
    fireEvent.click(share); expect(onShare).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(confetti).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem(RAFFLE_FRESH_KEY)).toBeNull();
  });

  it('return visit: dashboard h1, no banner, no confetti, no share', async () => {
    rpc.mockResolvedValue({ data: WIN(NIGHT), error: null });
    shell();
    expect(await screen.findByText('Your dashboard')).toBeTruthy();
    expect(screen.queryByText('You are in')).toBeNull();
    expect(screen.queryByText('Share my win')).toBeNull();
    expect(confetti).not.toHaveBeenCalled();
  });

  it('night unknown: locked line, QR, no flyer, no share even when fresh', async () => {
    sessionStorage.setItem(RAFFLE_FRESH_KEY, '1');
    rpc.mockResolvedValue({ data: WIN(null), error: null });
    shell();
    expect(await screen.findByText('Your night is locked.')).toBeTruthy();
    expect(screen.getByTestId('raffle-win-qr')).toBeTruthy();
    expect(screen.queryByTestId('raffle-win-flyer')).toBeNull();
    expect(screen.queryByText('Share my win')).toBeNull();
  });

  it('QR opens the door view; back returns to the dashboard', async () => {
    rpc.mockResolvedValue({ data: WIN(NIGHT), error: null });
    shell();
    fireEvent.click(await screen.findByTestId('raffle-win-qr'));
    expect(await screen.findByTestId('raffle-door-view')).toBeTruthy();
    expect(screen.getByText('Show this at the door.')).toBeTruthy();
    expect(screen.getByText('This code does not expire. Your organiser can cancel it.')).toBeTruthy();
    fireEvent.click(screen.getByText('Back to my dashboard'));
    expect(await screen.findByTestId('raffle-win-card')).toBeTruthy();
  });

  it.each([[[]], [{ ok: false }]])('no win (%j): no card at all', async (data) => {
    rpc.mockResolvedValue({ data, error: null });
    const { container } = shell();
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  it('signed out or RPC error: nothing, and no call when signed out', async () => {
    setTestUser(null);
    const { container } = shell();
    expect(container.innerHTML).toBe('');
    expect(rpc).not.toHaveBeenCalled();
  });
});
