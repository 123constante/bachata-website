// @vitest-environment jsdom
/** Golden Ticket keep-list: flag on renders every line of each of the 5 states. Flag off = today's card (see homeRaffleWin.test). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setTestUser } from '@/modules/dancer-app/shell/testAuth';
import { daysUntilKey, RAFFLE_FRESH_KEY, winTimeLine } from '../raffleWinModel';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
const rpc = vi.fn();
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (...a: unknown[]) => rpc(...a) }));
vi.mock('canvas-confetti', () => ({ default: () => undefined }));
vi.mock('../../../../tickets/TicketQrCode', () => ({ default: () => <svg data-testid="ticket-qr" /> }));
vi.mock('../../../api/useMyDancerEdit', () => ({ useMyDancerEdit: () => ({ data: { first_name: 'Maya', avatar_url: null } }) }));
const flag = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/featureFlags', () => ({ flags: { get raffleGoldenTicket() { return flag.on; } } }));
vi.mock('@/lib/londonDate', () => ({ londonTodayKey: () => '2026-11-26' }));

import HomeRaffleWin from '../homeRaffleWin';

const NIGHT = { title: 'Noche Dominicana', start_local: '2026-11-29T20:00', venue_name: 'The Copper Room', poster_url: 'https://x/f.jpg' };
const WIN = (night: unknown, extra = {}) => [{ win: { id: 'w1', state: 'locked', qr_token: 'a'.repeat(64), night, ...extra } }];
const shell = () => render(<QueryClientProvider client={new QueryClient()}><HomeRaffleWin /></QueryClientProvider>);

beforeEach(() => { flag.on = true; setTestUser({ id: 'u1' }); sessionStorage.clear(); rpc.mockReset(); });
afterEach(cleanup);

describe('model helpers', () => {
  it('time and day maths', () => {
    expect(winTimeLine('2026-11-29T20:00')).toBe('8:00 pm');
    expect(winTimeLine('2026-11-29T00:30')).toBe('12:30 am');
    expect(daysUntilKey('2026-11-26', '2026-11-29')).toBe(3);
    expect(daysUntilKey('2026-11-26', '2026-11-26')).toBe(0);
  });
});

describe('golden ticket states', () => {
  it('1 just won', async () => {
    sessionStorage.setItem(RAFFLE_FRESH_KEY, '1');
    rpc.mockResolvedValue({ data: WIN(NIGHT), error: null });
    shell();
    expect(await screen.findByText('You won, Maya!')).toBeTruthy();
    expect(screen.getByText('Free entry to Noche Dominicana. This is your ticket.')).toBeTruthy();
    expect(screen.getAllByTestId('gt-confetti')[0].querySelectorAll('i').length).toBe(18);
    expect(screen.getByText('FREE ENTRY')).toBeTruthy();
    expect(screen.getByText(/Sunday 29 Nov, 8:00 pm/)).toBeTruthy();
    expect(screen.getByText(/The Copper Room/)).toBeTruthy();
    expect(screen.getByText('Tap to show at the door')).toBeTruthy();
    expect(screen.getByText('Opens big and bright')).toBeTruthy();
    expect(screen.getByText(/Make it big/)).toBeTruthy();
    expect(screen.getByText(/Tell a friend/)).toBeTruthy();
    expect(screen.getByText('Your code never runs out. Only the organiser can cancel it.')).toBeTruthy();
  });

  it('2 upcoming: greeting, countdown, share, safe line; stub opens the door and Done returns', async () => {
    rpc.mockResolvedValue({ data: WIN(NIGHT), error: null });
    shell();
    expect(await screen.findByText('Your free night is in 3 days')).toBeTruthy();
    expect(screen.getByText(/^Good (morning|afternoon|evening), Maya$/)).toBeTruthy();
    expect(screen.queryByTestId('gt-confetti')).toBeNull();
    expect(screen.getByText(/Tell a friend/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('raffle-win-qr'));
    expect(await screen.findByText('Show this at the door')).toBeTruthy();
    expect(screen.getByText('Free entry, Noche Dominicana')).toBeTruthy();
    expect(screen.getByText('Maya')).toBeTruthy();
    expect(screen.getByText(/Turn your screen brightness all the way up/)).toBeTruthy();
    expect(document.activeElement?.textContent).toBe('Done');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByTestId('raffle-win-card')).toBeTruthy();
  });

  it('3 night unknown: lock box, Try again refetches, stub and safe line stay, no share', async () => {
    rpc.mockResolvedValue({ data: WIN(null), error: null });
    shell();
    expect(await screen.findByText('Your night is locked')).toBeTruthy();
    expect(screen.getByText('Your free night')).toBeTruthy();
    expect(screen.getByText(/We can.t show the details right now/)).toBeTruthy();
    expect(screen.getByTestId('raffle-win-qr')).toBeTruthy();
    expect(screen.getByTestId('gt-safe')).toBeTruthy();
    expect(screen.queryByTestId('gt-share')).toBeNull();
    fireEvent.click(screen.getByText('Try again'));
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
  });

  it('5 attended: stamp, scanned line, no QR, share, no safe line', async () => {
    rpc.mockResolvedValue({ data: WIN(NIGHT, { state: 'attended', attended: true }), error: null });
    shell();
    expect(await screen.findByText('You’re in. Enjoy the night!')).toBeTruthy();
    expect(screen.getByTestId('gt-stamp')).toBeTruthy();
    expect(screen.getByText('The door has scanned you')).toBeTruthy();
    expect(screen.getByText('Nothing more to show. Go and dance.')).toBeTruthy();
    expect(screen.queryByTestId('raffle-win-qr')).toBeNull();
    expect(screen.queryByTestId('ticket-qr')).toBeNull();
    expect(screen.getByText(/Tell a friend/)).toBeTruthy();
  });

  it('no flyer = coloured block with the title; no venue hides the line', async () => {
    rpc.mockResolvedValue({ data: WIN({ title: 'Noche', start_local: '2026-11-26T20:00' }), error: null });
    shell();
    expect(await screen.findByTestId('gt-flyer-title')).toBeTruthy();
    expect(screen.queryByTestId('raffle-win-venue')).toBeNull();
    expect(screen.getByText('Your free night is tonight')).toBeTruthy();
  });

  it('no emoji or entity glyphs in any flag-on state; both perforation notches render', async () => {
    const GLYPHS = ['\u{1F4C5}', '\u{1F4CD}', '\u{1F512}', '\u{1F6E1}', '\u2922', '\u2197', '\u2713', '\u2600', '\uFE0F'];
    const bare = (el: HTMLElement) => GLYPHS.forEach((g) => expect(el.textContent).not.toContain(g));
    sessionStorage.setItem(RAFFLE_FRESH_KEY, '1');
    rpc.mockResolvedValue({ data: WIN(NIGHT), error: null });
    let r = shell();
    await screen.findByText('You won, Maya!');
    bare(r.container);
    expect(screen.getByTestId('gt-notch-l')).toBeTruthy();
    expect(screen.getByTestId('gt-notch-r')).toBeTruthy();
    expect(r.container.querySelectorAll('svg[aria-hidden="true"]').length).toBeGreaterThanOrEqual(5);
    cleanup(); sessionStorage.clear();
    r = shell();
    await screen.findByText('Your free night is in 3 days');
    fireEvent.click(screen.getByTestId('raffle-win-qr'));
    await screen.findByText('Show this at the door');
    bare(r.container);
    cleanup();
    rpc.mockResolvedValue({ data: WIN(null), error: null });
    r = shell();
    await screen.findByText('Your night is locked');
    bare(r.container);
    cleanup();
    rpc.mockResolvedValue({ data: WIN(NIGHT, { state: 'attended', attended: true }), error: null });
    r = shell();
    await screen.findByTestId('gt-stamp');
    bare(r.container);
    expect(screen.getByTestId('gt-notch-l')).toBeTruthy();
  });

  it('flag off: today’s card, none of the golden parts', async () => {
    flag.on = false;
    rpc.mockResolvedValue({ data: WIN(NIGHT), error: null });
    shell();
    expect(await screen.findByText('Your dashboard')).toBeTruthy();
    expect(screen.queryByTestId('gt-share')).toBeNull();
    expect(screen.getByText('Show this at the door.')).toBeTruthy();
  });
});
