// @vitest-environment jsdom
/** R2-N1 / R2-N2: the Tickets card's order-link fallback and server-clock "today". All mocked at the API edge. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const fetchMyTickets = vi.hoisted(() => vi.fn());
const fetchOrderQr = vi.hoisted(() => vi.fn());
const readOrderStatus = vi.hoisted(() => vi.fn());
const today = vi.hoisted(() => ({ key: '2026-11-18' }));
vi.mock('@/lib/featureFlags', () => ({ flags: { publicTicketing: true } }));
vi.mock('@/modules/tickets/myTicketsApi', () => ({ fetchMyTickets, fetchOrderQr }));
vi.mock('@/modules/tickets/ticketCheckoutApi', () => ({ readOrderStatus }));
vi.mock('../serverToday', () => ({ serverTodayKey: async () => today.key }));
vi.mock('@/modules/tickets/TicketQrCode', () => ({ default: () => <svg data-testid="ticket-qr" /> }));

import TicketsScreen from '../TicketsScreen';
import { ProfileSheetProvider } from '../../../shell/profileSheet';
import { MY_TICKETS_PATH } from '@/modules/tickets/myTicketsModel';

const ORDER = '123e4567-e89b-42d3-a456-426614174000';
const row = (date: string | null) => ({ orderId: 'o1', seriesId: 's', title: 'Social', date, startTime: null, typeName: 'Party', ticketId: 't1', qrToken: 'tok', shortCode: null, checkedIn: false, checkedInAt: null });
const own = (date: string | null) => ({ kind: 'ok', reply: { tickets: [row(date)], truncated: false, totalCount: 1 } });

const mount = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <ProfileSheetProvider incomplete={false} viewOnly={false}>
      <Routes><Route path="/app/tickets" element={<TicketsScreen />} /></Routes>
    </ProfileSheetProvider>
  </MemoryRouter>,
);

beforeEach(() => {
  sessionStorage.clear();
  today.key = '2026-11-18';
  fetchMyTickets.mockReset().mockResolvedValue(own('2026-11-18'));
  fetchOrderQr.mockReset().mockResolvedValue({ kind: 'error' });
  readOrderStatus.mockReset().mockResolvedValue({ status: 'paid', ticketCount: null, eventTitle: 'Social', eventDate: '2026-11-18', eventId: 'e1', retryLater: false });
});
afterEach(cleanup);

describe('no usable ?o= -> the person\'s own upcoming tickets (R2-N2)', () => {
  it.each([['missing', '/app/tickets'], ['malformed', '/app/tickets?o=not-a-uuid'], ['empty', '/app/tickets?o=']])('%s', async (_n, path) => {
    mount(path);
    expect(await screen.findByTestId('ticket-qr')).toBeTruthy();
    expect(fetchOrderQr).not.toHaveBeenCalled();
  });
  it('a foreign order id the account cannot read falls back to own tickets, not an error', async () => {
    mount(`/app/tickets?o=${ORDER}`);
    expect(await screen.findByTestId('ticket-qr')).toBeTruthy();
    expect(fetchOrderQr).toHaveBeenCalledTimes(1);
  });
  it('a foreign order id and no tickets of their own still says error (nothing to fall back to)', async () => {
    fetchMyTickets.mockResolvedValue({ kind: 'ok', reply: { tickets: [], truncated: false, totalCount: 0 } });
    mount(`/app/tickets?o=${ORDER}`);
    await screen.findByTestId('tickets-card');
    expect(screen.queryByTestId('ticket-qr')).toBeNull();
  });
  it('the e-mail button path is the shared constant', () => expect(MY_TICKETS_PATH).toBe('/account/my-tickets'));
});

describe('server-clock today (R2-N1)', () => {
  it('tonight\'s ticket stays upcoming when the device clock is behind the server', async () => {
    fetchMyTickets.mockResolvedValue(own('2026-11-18'));
    mount('/app/tickets');
    expect(await screen.findByTestId('ticket-qr')).toBeTruthy();
  });
  it('a ticket dated before the SERVER today is not shown, whatever the device says', async () => {
    today.key = '2026-11-19';
    fetchMyTickets.mockResolvedValue(own('2026-11-18'));
    mount('/app/tickets');
    await screen.findByTestId('tickets-card');
    expect(screen.queryByTestId('ticket-qr')).toBeNull();
  });
});
