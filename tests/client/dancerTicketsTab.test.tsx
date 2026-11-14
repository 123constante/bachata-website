// @vitest-environment jsdom
/**
 * Option A Tickets tab (brief option-a-tickets-tab), flags.publicTicketing ON here.
 * Matrix: who (allowed + complete / allowed + no profile / not allowed) x path, and the card
 * states (one, three, nine tickets; pending; failed; processing; no order; QR read error).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  return { ...real, flags: { ...real.flags, publicTicketing: true } };
});
const api = vi.hoisted(() => ({ order: vi.fn(), mine: vi.fn(), status: vi.fn() }));
vi.mock('@/modules/tickets/myTicketsApi', () => ({ fetchOrderQr: api.order, fetchMyTickets: api.mine }));
vi.mock('@/modules/tickets/ticketCheckoutApi', () => ({ readOrderStatus: api.status }));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { DANCER_ROUTES, DANCER_TABS, activeTabFor, shellTabs } from '@/modules/dancer-app/shell/routes';
import { DANCER_SCREENS } from '@/modules/dancer-app/shell/DancerAppRoutes';
import { admitsViewOnly } from '@/modules/dancer-app/gate/viewOnly';
import { CATCHALL_CLIENT_PATHS } from '@/components/catchallClientPaths';
import { profileIncomplete, roleTarget } from '@/modules/dancer-app/screens/tickets/model';
import { doorDate, stepTicket, ticketCountLine } from '@/modules/dancer-app/screens/tickets/cardKit';

const ORDER = '11111111-2222-4333-8444-555555555555';
const TOKEN = (i: number) => i.toString(16).padStart(64, '0');
const qrTickets = (n: number) => Array.from({ length: n }, (_, i) => ({ ticketId: `t${i}`, typeName: `Type ${i + 1}`, qrToken: TOKEN(i + 1), checkedIn: false, shortCode: 'ABC234' }));
const reading = (status: string, extra: Record<string, unknown> = {}) => ({ status, ticketCount: null, eventTitle: 'Salsa Social', eventDate: '2026-11-21', eventId: null, retryLater: false, ...extra });
const NOT_ALLOWED = { gate: { open: false, allowed: false } };

beforeEach(() => {
  api.order.mockReset();
  api.mine.mockReset();
  api.status.mockReset();
  api.mine.mockResolvedValue({ kind: 'ok', reply: { tickets: [], truncated: false, totalCount: 0 } });
  api.status.mockResolvedValue(reading('paid'));
});
afterEach(() => {
  cleanup();
  resetShell();
  vi.useRealTimers();
  window.sessionStorage.clear();
});

describe('route table and paths', () => {
  it('has tickets, with a screen, in the catchall list, and first in the tabs while ticketing is on', () => {
    expect(DANCER_ROUTES.find((r) => r.id === 'tickets')?.path).toBe('/app/tickets');
    expect(DANCER_SCREENS.tickets).toBeTypeOf('function');
    expect(CATCHALL_CLIENT_PATHS).toContain('/app/tickets');
    expect(shellTabs(true).map((t) => t.id)).toEqual(['tickets', ...DANCER_TABS.map((t) => t.id)]);
    expect(shellTabs(false)).toEqual(DANCER_TABS);
    expect(activeTabFor('/app/tickets')).toBe('tickets');
  });
  it.each([
    ['/app/tickets', true, true],
    ['/APP/Tickets/', true, true],
    ['/app/tickets', false, false],
    ['/app/home', true, false],
    ['/app/me/edit', true, false],
    ['/app/welcome', true, false],
    ['/app', true, false],
  ])('gate view-only %s (ticketing %s) -> %s', (p, on, out) => expect(admitsViewOnly(p, on)).toBe(out));
});

describe('model', () => {
  it('N tickets give N positions, wrapping both ways', () => {
    const seen = new Set<number>();
    let i = 0;
    for (let k = 0; k < 9; k++) { seen.add(i); i = stepTicket(i, 1, 9); }
    expect(seen.size).toBe(9);
    expect(stepTicket(0, -1, 9)).toBe(8);
    expect(ticketCountLine(8, 9)).toBe('Ticket 9 of 9');
  });
  it('door date uses the full weekday', () => expect(doorDate('2026-11-21')).toBe('Saturday 21 November 2026'));
  it.each([
    [true, 'pending', false, true],
    [false, 'no_profile', false, true],
    [false, 'success', false, true],
    [false, 'success', true, false],
    [false, 'error', false, false],
    [false, 'pending', false, false],
  ] as const)('incomplete: viewOnly %s, read %s, required %s -> %s', (v, status, done, out) =>
    expect(profileIncomplete(v, { status, requiredDone: done })).toBe(out));
  it('roles hand off to existing flows; parked roles are null', () => {
    const o = { viewOnly: false, welcomeHref: '/app/welcome', organiserHref: '/account/o', teacherHref: '/account/t', djHref: '/account/dj' };
    expect(roleTarget('dancer', o)).toBe('/app/welcome');
    expect(roleTarget('dancer', { ...o, viewOnly: true })).toBeNull();
    expect(roleTarget('organiser', o)).toBe('/account/o');
    expect(roleTarget('videographer', o)).toBeNull();
    expect(roleTarget('venue', o)).toBeNull();
  });
});

describe('the gate admits a not-allowed buyer on the tickets route only', () => {
  it('opens /app/tickets view-only, with the bar and locked tabs', async () => {
    api.order.mockResolvedValue({ kind: 'ok', tickets: qrTickets(1) });
    renderInShell({ path: `/app/tickets?o=${ORDER}`, backend: NOT_ALLOWED });
    expect(await screen.findByTestId('tickets-screen')).toBeTruthy();
    expect(await screen.findByTestId('ticket-qr')).toBeTruthy();
    expect(screen.getByTestId('tickets-finish-bar').textContent).toContain('Finish your profile to unlock the rest');
    for (const t of DANCER_TABS) expect(screen.getByTestId(`dancer-app-tab-${t.id}`).getAttribute('data-locked')).toBe('true');
    expect(screen.getByTestId('dancer-app-tab-tickets').getAttribute('href')).toBe('/app/tickets');
  });
  it.each(['/app/home', '/app/me/edit', '/app/welcome', '/app/options'])('still sends %s to /account', async (path) => {
    const { location } = renderInShell({ path, backend: NOT_ALLOWED });
    await waitFor(() => expect(location()).toMatch(/^\/account/));
  });
  it('a locked tab opens the sheet; a parked role says coming soon; Dancer is parked view-only', async () => {
    renderInShell({ path: '/app/tickets', backend: NOT_ALLOWED });
    fireEvent.click(await screen.findByTestId('dancer-app-tab-home'));
    expect(screen.getByTestId('profile-sheet')).toBeTruthy();
    expect(screen.getByTestId('profile-chip-organiser').getAttribute('href')).toBe('/account/o');
    expect(screen.getByTestId('profile-chip-teacher').getAttribute('href')).toBe('/account/t');
    expect(screen.getByTestId('profile-chip-dj').getAttribute('href')).toBe('/account/dj');
    fireEvent.click(screen.getByTestId('profile-chip-venue'));
    expect(screen.getByTestId('profile-sheet-soon').textContent).toContain('Venue is coming soon');
    expect(screen.getByTestId('profile-chip-dancer').tagName).toBe('BUTTON');
  });
});

describe('who sees what (allowed)', () => {
  it('a complete dancer: Tickets first, no bar, no locks', async () => {
    renderInShell({ path: '/app/tickets' });
    expect(await screen.findByTestId('tickets-card')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('tickets-card').getAttribute('data-state')).toBe('none'));
    expect(screen.queryByTestId('tickets-finish-bar')).toBeNull();
    expect(screen.getByTestId('dancer-app-tabs').firstElementChild?.getAttribute('data-testid')).toBe('dancer-app-tab-tickets');
    expect(screen.getByTestId('dancer-app-tab-home').getAttribute('data-locked')).toBeNull();
  });
  it('no dancer profile: bar + locked tabs; Start opens the sheet; Dancer goes to onboarding', async () => {
    renderInShell({ path: '/app/tickets', backend: { profile: null } });
    fireEvent.click(await screen.findByTestId('tickets-finish-start'));
    expect(screen.getByTestId('profile-chip-dancer').getAttribute('href')).toBe('/app/welcome?returnTo=%2Fapp%2Ftickets');
    expect(screen.getByTestId('dancer-app-tab-me').getAttribute('data-locked')).toBe('true');
  });
});

describe('card states', () => {
  it.each([1, 3, 9])('%i paid tickets: one QR, arrows only for more than one, every ticket reachable', async (n) => {
    api.order.mockResolvedValue({ kind: 'ok', tickets: qrTickets(n) });
    renderInShell({ path: `/app/tickets?o=${ORDER}` });
    await screen.findByTestId('ticket-qr');
    expect(screen.getAllByTestId('ticket-qr')).toHaveLength(1);
    if (n === 1) { expect(screen.queryByTestId('tickets-card-next')).toBeNull(); return; }
    const types = new Set<string>();
    for (let k = 0; k < n; k++) {
      types.add(screen.getByTestId('tickets-card-type').textContent ?? '');
      fireEvent.click(screen.getByTestId('tickets-card-next'));
    }
    expect(types.size).toBe(n);
    fireEvent.click(screen.getByTestId('tickets-card-prev'));
    expect(screen.getByTestId('tickets-card-count').textContent).toBe(`Ticket ${n} of ${n}`);
  });
  it('the full-screen door view shows the event name and date; the card does not', async () => {
    api.order.mockResolvedValue({ kind: 'ok', tickets: qrTickets(1) });
    renderInShell({ path: `/app/tickets?o=${ORDER}` });
    expect(screen.queryByText('Salsa Social')).toBeNull();
    fireEvent.click(await screen.findByTestId('tickets-card-qr'));
    expect(screen.getByTestId('tickets-door-title').textContent).toBe('Salsa Social');
    expect(screen.getByTestId('tickets-door-date').textContent).toBe('Saturday 21 November 2026');
  });
  it.each([
    ['failed', reading('failed', { eventId: 'ev1' }), 'failed'],
    ['pending', reading('pending'), 'pending'],
  ])('%s order', async (_l, r, state) => {
    api.status.mockResolvedValue(r);
    renderInShell({ path: `/app/tickets?o=${ORDER}` });
    await waitFor(() => expect(screen.getByTestId('tickets-card').getAttribute('data-state')).toBe(state));
    expect(api.order).not.toHaveBeenCalled();
    if (state === 'failed') expect(screen.getByTestId('tickets-card-back-to-event').getAttribute('href')).toBe('/event/ev1');
  });
  it('still pending after 8 polls -> processing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.status.mockResolvedValue(reading('pending'));
    renderInShell({ path: `/app/tickets?o=${ORDER}` });
    await waitFor(() => expect(api.status).toHaveBeenCalled());
    for (let k = 0; k < 12; k++) await act(async () => { await vi.advanceTimersByTimeAsync(16_000); });
    await waitFor(() => expect(screen.getByTestId('tickets-card').getAttribute('data-state')).toBe('processing'));
    expect(api.status).toHaveBeenCalledTimes(9);
  });
  it.each([
    ['a free pending order', `?o=${ORDER}&free=1`, reading('pending'), 'pending', 'free tickets'],
    ['a non-retryable unknown reading', `?o=${ORDER}`, reading('unknown'), 'processing', 'still processing'],
  ])('%s', async (_l, q, r, state, words) => {
    api.status.mockResolvedValue(r);
    renderInShell({ path: `/app/tickets${q}` });
    await waitFor(() => expect(screen.getByTestId('tickets-card').getAttribute('data-state')).toBe(state));
    expect(screen.getByTestId('tickets-card').textContent).toContain(words);
  });
  it('paid, but no QR rows for this account -> confirmed, in your email (never "no order")', async () => {
    api.order.mockResolvedValue({ kind: 'ok', tickets: [] });
    renderInShell({ path: `/app/tickets?o=${ORDER}` });
    await waitFor(() => expect(screen.getByTestId('tickets-card').getAttribute('data-state')).toBe('paid_email'));
    expect(screen.getByTestId('tickets-card').textContent).toBe('Confirmed. Your tickets are in your email.');
  });
  it('no order on this device', async () => {
    renderInShell({ path: '/app/tickets' });
    await waitFor(() => expect(screen.getByTestId('tickets-card').getAttribute('data-state')).toBe('none'));
    expect(screen.getByTestId('tickets-card').textContent).toBe('We couldn’t find an order on this device. Your tickets are in your email.');
  });
  it('a stored order id (after Stripe) is read and moved into the URL', async () => {
    window.sessionStorage.setItem('bc.ticketOrderId', ORDER);
    api.order.mockResolvedValue({ kind: 'ok', tickets: qrTickets(1) });
    renderInShell({ path: '/app/tickets' });
    await screen.findByTestId('ticket-qr');
    expect(api.order).toHaveBeenCalledWith(ORDER);
  });
  it('QR read failed -> retry reads again', async () => {
    api.order.mockResolvedValueOnce({ kind: 'error' }).mockResolvedValueOnce({ kind: 'ok', tickets: qrTickets(1) });
    renderInShell({ path: `/app/tickets?o=${ORDER}` });
    fireEvent.click(await screen.findByTestId('tickets-card-retry'));
    expect(await screen.findByTestId('ticket-qr')).toBeTruthy();
    expect(api.order).toHaveBeenCalledTimes(2);
  });
});
