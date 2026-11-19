// @vitest-environment jsdom
/**
 * Brief postpay-tickets-tab (option A): the thanks redirect, the "You're booked" bar, the
 * event + date card and where the account-link panel lives. Flag ON and OFF x paid and
 * processing x 1 and 3 tickets x free. Everything is mocked at the API edge.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const f = vi.hoisted(() => ({ on: true, auth: { user: { id: 'u1' } as object | null, authStatus: 'ready' } }));
const fetchMyTickets = vi.hoisted(() => vi.fn());
const fetchOrderQr = vi.hoisted(() => vi.fn());
const readOrderStatus = vi.hoisted(() => vi.fn());
vi.mock('@/lib/postpayTicketsTabFlag', () => ({ get POSTPAY_TICKETS_TAB_ENABLED() { return f.on; } }));
vi.mock('@/lib/buyerOnboardingFlag', () => ({ BUYER_ONBOARDING_ENABLED: true }));
vi.mock('@/lib/featureFlags', () => ({ flags: { publicTicketing: true } }));
vi.mock('@/modules/tickets/myTicketsApi', () => ({ fetchMyTickets, fetchOrderQr }));
vi.mock('@/modules/tickets/ticketCheckoutApi', () => ({ readOrderStatus }));
vi.mock('@/modules/tickets/TicketQrCode', () => ({ default: () => <svg data-testid="ticket-qr" /> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => f.auth }));
vi.mock('../AccountLinkPanel', () => ({ AccountLinkPanel: () => <div data-testid="account-link-panel" /> }));

import TicketsScreen from '../TicketsScreen';
import TicketThanksPage from '@/modules/tickets/TicketThanksPage';
import { ProfileSheetProvider } from '../../../shell/profileSheet';

const ORDER = '123e4567-e89b-42d3-a456-426614174000';
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ ticketId: `t${i}`, typeName: 'Full pass', qrToken: 'tok', checkedIn: false, shortCode: null }));
const reading = (status: string) => ({ status, ticketCount: null, eventTitle: 'Summer Social', eventDate: '2026-12-05', eventId: 'ev-1', retryLater: false });
const Where = () => { const l = useLocation(); return <div data-testid="where">{`${l.pathname}${l.search}`}</div>; };

const mountTab = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/app/tickets${search}`]}>
      <ProfileSheetProvider incomplete={false} viewOnly={false}>
        <Routes><Route path="/app/tickets" element={<TicketsScreen />} /></Routes>
      </ProfileSheetProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  f.on = true; f.auth = { user: { id: 'u1' }, authStatus: 'ready' };
  sessionStorage.clear();
  fetchMyTickets.mockReset().mockResolvedValue({ kind: 'ok', reply: { tickets: [], truncated: false, totalCount: 0 } });
  fetchOrderQr.mockReset().mockResolvedValue({ kind: 'ok', tickets: rows(1) });
  readOrderStatus.mockReset().mockResolvedValue(reading('paid'));
});
afterEach(cleanup);

describe('thanks redirect (signed in, order id)', () => {
  it.each([
    [true, '', '/app/tickets?o=' + ORDER],
    [true, '&free=1', '/app/tickets?o=' + ORDER + '&free=1'],
    [false, '', '/app/home?o=' + ORDER],
  ])('flag %s%s -> %s', (on, extra, to) => {
    f.on = on;
    render(
      <MemoryRouter initialEntries={[`/tickets/thanks?o=${ORDER}${extra}`]}>
        <Routes><Route path="/tickets/thanks" element={<TicketThanksPage />} /><Route path="*" element={<Where />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('where').textContent).toBe(to);
  });
});

describe('Tickets tab after payment', () => {
  const SHAPES: [string, string, number, string | null][] = [
    ['paid, 1 ticket', 'paid', 1, 'booked'],
    ['paid, 3 tickets', 'paid', 3, 'booked'],
    ['free, 1 ticket', 'paid', 1, 'booked'],
    ['processing', 'pending', 0, 'processing'],
  ];
  it.each(SHAPES)('flag ON: %s', async (name, status, n, bar) => {
    readOrderStatus.mockResolvedValue(reading(status));
    fetchOrderQr.mockResolvedValue({ kind: 'ok', tickets: rows(n) });
    mountTab(`?o=${ORDER}${name.startsWith('free') ? '&free=1' : ''}`);
    if (bar === 'booked') {
      await screen.findByTestId('tickets-card-qr');
      expect(screen.getByTestId('tickets-booked-bar').getAttribute('data-state')).toBe('booked');
      expect(screen.getByTestId('tickets-card-type').textContent).toContain('Summer Social');
      expect(screen.getByTestId('tickets-card-date').textContent).toBeTruthy();
      expect(screen.queryByTestId('tickets-card-count')?.textContent ?? null).toBe(n > 1 ? `Ticket 1 of ${n}` : null);
    } else {
      expect((await screen.findByTestId('tickets-booked-bar')).getAttribute('data-state')).toBe('processing');
    }
    expect(screen.queryByTestId('account-link-panel')).toBeNull();
  });

  it('flag ON: no order in the URL, no booked bar', async () => {
    mountTab('');
    await screen.findByTestId('tickets-card');
    expect(screen.queryByTestId('tickets-booked-bar')).toBeNull();
  });

  it('flag OFF: exactly as before (type name, panel on Tickets, no bar)', async () => {
    f.on = false;
    mountTab(`?o=${ORDER}`);
    await screen.findByTestId('tickets-card-qr');
    expect(screen.queryByTestId('tickets-booked-bar')).toBeNull();
    expect(screen.getByTestId('tickets-card-type').textContent).toBe('Full pass');
    expect(screen.queryByTestId('tickets-card-date')).toBeNull();
    expect(screen.getByTestId('account-link-panel')).toBeTruthy();
  });
});
