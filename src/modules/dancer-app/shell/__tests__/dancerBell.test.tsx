// @vitest-environment jsdom
/**
 * Dancer bell alerts v1 (brief #1938): the flag, the header placement, the badge, the read rule,
 * the empty / storage-blocked paths, and the two alert rules (ticket from 09:00 London, rate
 * dropping after 7 days).
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  on: true,
  nights: { upcoming: [] as unknown[], past: [] as unknown[] },
  tickets: [] as unknown[],
  rating: { summary: { my_level: null as string | null }, isLoading: false, canRate: true },
}));

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('../bellFlag', () => ({ get DANCER_BELL_ENABLED() { return h.on; } }));
vi.mock('@/lib/featureFlags', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  flags: { publicTicketing: true },
}));
vi.mock('../../screens/nights/useMyNights', () => ({
  useMyNights: () => ({ on: true, isLoading: false, isError: false, retry: () => {}, todayKey: '2026-11-22', nights: h.nights, goingCount: 0 }),
}));
vi.mock('@/hooks/useSeriesLevelRating', () => ({ useSeriesLevelRating: () => h.rating }));
vi.mock('@/modules/tickets/myTicketsApi', () => ({
  fetchMyTickets: async () => ({ kind: 'ok', reply: { tickets: h.tickets } }),
}));

import DancerBell from '../DancerBell';
import { badgeText, loadRead, rateAlert, readKey, ticketAlerts } from '../bellAlerts';
import { renderInShell, resetShell } from '../renderInShell';
import { FAKE_USER_ID } from '../../api/fixtures';

const night = (o: Record<string, unknown> = {}) => ({
  occurrenceId: 'occ1', seriesId: 'ser1', name: 'Salsa Night', date: '2026-11-22', venue: null, when: null,
  status: 'live', href: null, past: false, listed: true, ...o,
});
const ticket = (o: Record<string, unknown> = {}) => ({
  orderId: 'ord1', seriesId: null, eventId: 'ser1', occurrenceId: 'occ1', title: 'Salsa Night', date: '2026-11-22', startTime: '21:00',
  typeName: 'GA', ticketId: 't1', qrToken: 'tok', shortCode: 'ABC123', checkedIn: false, checkedInAt: null, ...o,
});
const at = (iso: string) => new Date(iso);
const TODAY = '2026-11-22';

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><DancerBell /></MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  h.on = true;
  h.nights = { upcoming: [], past: [] };
  h.tickets = [];
  h.rating = { summary: { my_level: null }, isLoading: false, canRate: true };
  window.localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at('2026-11-22T12:00:00Z'));
});
afterEach(() => {
  cleanup();
  resetShell();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('flag and placement', () => {
  it('flag off: no bell in the header', async () => {
    h.on = false;
    renderInShell({ path: '/app/home' });
    await screen.findByTestId('dancer-app-header');
    expect(screen.queryByTestId('dancer-bell')).toBeNull();
  });
  it('flag on: the bell shows for a person with one profile, first in the right group (left of Switch)', async () => {
    renderInShell({ path: '/app/home' });
    const bell = await screen.findByTestId('dancer-bell');
    expect(bell.parentElement?.firstElementChild).toBe(bell);
  });
});

describe('model', () => {
  it('badge: none at zero, count, 9+ cap', () => {
    expect([0, 1, 9, 10, 40].map(badgeText)).toEqual([null, '1', '9', '9+', '9+']);
  });
  it('ticket: not before 09:00 London, shown from 09:00, gone once the night is no longer upcoming', () => {
    const n = [night()] as never;
    const t = [ticket()] as never;
    expect(ticketAlerts(n, t, TODAY, at('2026-11-22T08:59:00Z'))).toHaveLength(0);
    const a = ticketAlerts(n, t, TODAY, at('2026-11-22T09:00:00Z'));
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ id: 'ticket:ord1:2026-11-22', title: 'Your ticket is ready', line: 'Salsa Night · tonight 21:00' });
    // the night ended: the RPC moves it to past, so it is not in `upcoming`
    expect(ticketAlerts([] as never, t, TODAY, at('2026-11-22T20:00:00Z'))).toHaveLength(0);
  });
  it('ticket: a night dated tomorrow gives nothing', () => {
    expect(ticketAlerts([night({ date: '2026-11-23' })] as never, [ticket({ date: '2026-11-23' })] as never, TODAY, at('2026-11-22T12:00:00Z'))).toHaveLength(0);
  });
  it('rate: id, title and path from the one candidate; nothing without one', () => {
    const a = rateAlert(night({ past: true, date: '2026-11-21', status: 'ended' }) as never, TODAY);
    expect(a).toMatchObject({ id: 'rate:ser1:2026-11-21', title: 'Rate last night', line: 'Salsa Night · how was the level?' });
    expect(rateAlert(null, TODAY)).toBeNull();
  });
});

describe('the bell', () => {
  const pastNight = (daysAgoKey: string) => night({ occurrenceId: 'p1', past: true, status: 'ended', date: daysAgoKey });
  const withTicketAndRate = () => {
    h.nights = { upcoming: [night()], past: [pastNight('2026-11-21')] };
    h.tickets = [ticket()];
  };

  it('empty: no badge, one line', async () => {
    mount();
    expect(screen.queryByTestId('dancer-bell-badge')).toBeNull();
    fireEvent.click(await screen.findByTestId('dancer-bell-button'));
    expect((await screen.findByTestId('bell-empty')).textContent).toBe('No alerts right now');
  });

  it('badge counts unread; opening does not mark read; tapping marks only that alert', async () => {
    withTicketAndRate();
    mount();
    expect((await screen.findByTestId('dancer-bell-badge')).textContent).toBe('2');
    const btn = screen.getByTestId('dancer-bell-button');
    expect(btn.getAttribute('aria-label')).toBe('Alerts, 2 unread');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByTestId('bell-alert').map((r) => r.getAttribute('data-unread'))).toEqual(['true', 'true']);
    fireEvent.click(screen.getAllByTestId('bell-alert')[1]);
    expect(loadRead(FAKE_USER_ID)).toEqual(new Set(['rate:ser1:2026-11-21']));
    expect(screen.getByTestId('dancer-bell-badge').textContent).toBe('1');
  });

  it('Escape closes and returns focus to the bell', async () => {
    withTicketAndRate();
    mount();
    const btn = await screen.findByTestId('dancer-bell-button');
    fireEvent.click(btn);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('dancer-bell-dropdown')).toBeNull();
    expect(document.activeElement).toBe(btn);
  });

  it('storage blocked: alerts show unread, no crash', async () => {
    withTicketAndRate();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    mount();
    expect((await screen.findByTestId('dancer-bell-badge')).textContent).toBe('2');
    fireEvent.click(screen.getByTestId('dancer-bell-button'));
    fireEvent.click(screen.getAllByTestId('bell-alert')[1]);
    expect(screen.getByTestId('dancer-bell-badge').textContent).toBe('1');
  });

  it('rate drops after 7 days (no candidate) and once rated', async () => {
    h.nights = { upcoming: [], past: [pastNight('2026-11-14')] };
    mount();
    fireEvent.click(await screen.findByTestId('dancer-bell-button'));
    expect(await screen.findByTestId('bell-empty')).toBeTruthy();
    cleanup();
    h.nights = { upcoming: [], past: [pastNight('2026-11-21')] };
    h.rating = { summary: { my_level: 'right' }, isLoading: false, canRate: true };
    mount();
    fireEvent.click(await screen.findByTestId('dancer-bell-button'));
    expect(await screen.findByTestId('bell-empty')).toBeTruthy();
  });

  it('read ids no longer shown are pruned from storage', async () => {
    window.localStorage.setItem(readKey(FAKE_USER_ID), JSON.stringify(['rate:old:2026-01-01']));
    mount();
    await screen.findByTestId('dancer-bell-button');
    await vi.waitFor(() => expect(loadRead(FAKE_USER_ID).size).toBe(0));
  });
});
