// @vitest-environment jsdom
/**
 * The dancer-app Tickets tab (/app/tickets): loading, empty, list, the not-yet-paid / failed /
 * error states, and the view-only lock. Everything is MOCKED at the API edge (my_tickets_v1,
 * my_ticket_order_qr_v1, the order read): nothing here assumes a real account.
 * Asserts what the code does today.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const h = vi.hoisted(() => ({ flag: true }));
const fetchMyTickets = vi.hoisted(() => vi.fn());
const fetchOrderQr = vi.hoisted(() => vi.fn());
const readOrderStatus = vi.hoisted(() => vi.fn());

vi.mock('@/lib/featureFlags', () => ({ flags: { get publicTicketing() { return h.flag; } } }));
vi.mock('@/modules/tickets/myTicketsApi', () => ({ fetchMyTickets, fetchOrderQr }));
vi.mock('@/modules/tickets/ticketCheckoutApi', () => ({ readOrderStatus }));
// The QR generator is not under test; the token must never be rendered as text.
vi.mock('@/modules/tickets/TicketQrCode', () => ({ default: () => <svg data-testid="ticket-qr" /> }));

import TicketsScreen, { FINISH_BAR } from '../TicketsScreen';
import { CARD_COPY } from '../model';
import { ProfileSheetProvider } from '../../../shell/profileSheet';
import { readOrderId, saveOrderId } from '@/modules/tickets/orderStorage';

const ORDER = '123e4567-e89b-42d3-a456-426614174000';
const TOKEN = 'tok_secret_should_never_render';
const qrRow = (n: number) => ({ ticketId: `t${n}`, typeName: n === 1 ? 'Full pass' : 'Party', qrToken: TOKEN, checkedIn: false, shortCode: null });
const reading = (status: string, extra: Record<string, unknown> = {}) => ({
  status, ticketCount: null, eventTitle: 'Summer Social', eventDate: '2026-12-05', eventId: 'ev-1', retryLater: false, ...extra,
});

function Where() {
  const l = useLocation();
  return <div data-testid="where">{`${l.pathname}${l.search}`}</div>;
}

const mount = (opts: { path?: string; incomplete?: boolean; viewOnly?: boolean } = {}) =>
  render(
    <MemoryRouter initialEntries={[opts.path ?? '/app/tickets']}>
      <ProfileSheetProvider incomplete={opts.incomplete ?? false} viewOnly={opts.viewOnly ?? false}>
        <Routes>
          <Route path="/app/tickets" element={<TicketsScreen />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </ProfileSheetProvider>
    </MemoryRouter>,
  );

const card = () => screen.findByTestId('tickets-card');
const settle = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  h.flag = true;
  sessionStorage.clear();
  fetchMyTickets.mockReset().mockResolvedValue({ kind: 'ok', reply: { tickets: [], truncated: false, totalCount: 0 } });
  fetchOrderQr.mockReset().mockResolvedValue({ kind: 'ok', tickets: [qrRow(1)] });
  readOrderStatus.mockReset().mockResolvedValue(reading('paid'));
});
afterEach(cleanup);

describe('the flag', () => {
  it('sends the visitor to /app/home when ticketing is off, and reads nothing', async () => {
    h.flag = false;
    mount();
    expect((await screen.findByTestId('where')).textContent).toBe('/app/home');
    expect(fetchMyTickets).not.toHaveBeenCalled();
    expect(readOrderStatus).not.toHaveBeenCalled();
  });
});

describe('no order id: the person’s own tickets', () => {
  it('shows the loading line until the read lands', async () => {
    fetchMyTickets.mockReturnValue(new Promise(() => {}));
    mount();
    const c = await card();
    expect(c.getAttribute('data-state')).toBe('loading');
    expect(c.textContent).toContain(CARD_COPY.loading);
  });

  it('empty: "no order on this device", no retry button', async () => {
    mount();
    const c = await screen.findByText(CARD_COPY.none);
    expect(c.closest('[data-testid="tickets-card"]')?.getAttribute('data-state')).toBe('none');
    expect(screen.queryByTestId('tickets-card-retry')).toBeNull();
  });

  it('signed out reads as empty, not as an error', async () => {
    fetchMyTickets.mockResolvedValue({ kind: 'signed_out' });
    mount();
    await screen.findByText(CARD_COPY.none);
  });

  it('a failed read shows the error line and Try again re-reads', async () => {
    fetchMyTickets.mockResolvedValueOnce({ kind: 'error' });
    mount();
    await screen.findByText(CARD_COPY.qrError);
    fetchMyTickets.mockResolvedValueOnce({ kind: 'ok', reply: { tickets: [], truncated: false, totalCount: 0 } });
    fireEvent.click(screen.getByTestId('tickets-card-retry'));
    await screen.findByText(CARD_COPY.none);
    expect(fetchMyTickets).toHaveBeenCalledTimes(2);
  });

  it('upcoming tickets with a QR render one at a time; past and QR-less ones are left out', async () => {
    const row = (id: string, date: string | null, qrToken: string | null, typeName: string) => ({
      orderId: 'o', seriesId: null, title: `Night ${id}`, date, startTime: null, typeName, ticketId: id, qrToken, shortCode: null, checkedIn: false, checkedInAt: null,
    });
    fetchMyTickets.mockResolvedValue({
      kind: 'ok',
      reply: {
        totalCount: 4, truncated: false,
        tickets: [row('a', '2999-01-01', TOKEN, 'Full pass'), row('b', '2999-01-02', TOKEN, 'Party'), row('c', '2000-01-01', TOKEN, 'Old'), row('d', '2999-01-03', null, 'NoQr')],
      },
    });
    mount();
    expect((await screen.findByTestId('tickets-card-type')).textContent).toBe('Full pass');
    expect(screen.getByTestId('tickets-card-count').textContent).toBe('Ticket 1 of 2');
    fireEvent.click(screen.getByTestId('tickets-card-next'));
    expect(screen.getByTestId('tickets-card-type').textContent).toBe('Party');
    fireEvent.click(screen.getByTestId('tickets-card-next'));
    expect(screen.getByTestId('tickets-card-type').textContent).toBe('Full pass'); // wraps
    fireEvent.click(screen.getByTestId('tickets-card-prev'));
    expect(screen.getByTestId('tickets-card-type').textContent).toBe('Party');
  });
});

describe('with ?o=<order id>', () => {
  it('paid: shows that order’s QR, the token is never text, and a single ticket has no arrows', async () => {
    const { container } = mount({ path: `/app/tickets?o=${ORDER}` });
    expect((await screen.findByTestId('tickets-card-type')).textContent).toBe('Full pass');
    expect(fetchOrderQr).toHaveBeenCalledWith(ORDER);
    expect(screen.getByTestId('ticket-qr')).toBeTruthy();
    expect(screen.queryByTestId('tickets-card-next')).toBeNull();
    expect(container.innerHTML).not.toContain(TOKEN);
  });

  it('paid, several tickets: "Ticket 1 of 2"', async () => {
    fetchOrderQr.mockResolvedValue({ kind: 'ok', tickets: [qrRow(1), qrRow(2)] });
    mount({ path: `/app/tickets?o=${ORDER}` });
    expect((await screen.findByTestId('tickets-card-count')).textContent).toBe('Ticket 1 of 2');
  });

  it('door view opens with the event name and a long date, and closes on Escape', async () => {
    mount({ path: `/app/tickets?o=${ORDER}` });
    fireEvent.click(await screen.findByTestId('tickets-card-qr'));
    expect(screen.getByTestId('tickets-door-title').textContent).toBe('Summer Social');
    expect(screen.getByTestId('tickets-door-date').textContent).toBe('Saturday 5 December 2026');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('tickets-door-view')).toBeNull();
  });

  it('paid but no QR rows (a guest order): tells the buyer the email has them', async () => {
    fetchOrderQr.mockResolvedValue({ kind: 'ok', tickets: [] });
    mount({ path: `/app/tickets?o=${ORDER}` });
    await screen.findByText(CARD_COPY.paidEmail);
  });

  it('paid, signed out: the same email line', async () => {
    fetchOrderQr.mockResolvedValue({ kind: 'signed_out' });
    mount({ path: `/app/tickets?o=${ORDER}` });
    await screen.findByText(CARD_COPY.paidEmail);
  });

  it('paid, door codes fail: error line with Try again', async () => {
    fetchOrderQr.mockResolvedValueOnce({ kind: 'error' });
    mount({ path: `/app/tickets?o=${ORDER}` });
    await screen.findByText(CARD_COPY.qrError);
    fireEvent.click(screen.getByTestId('tickets-card-retry'));
    expect((await screen.findByTestId('tickets-card-type')).textContent).toBe('Full pass');
  });

  it('failed: says no tickets were issued and links back to the event', async () => {
    readOrderStatus.mockResolvedValue(reading('failed'));
    mount({ path: `/app/tickets?o=${ORDER}` });
    await screen.findByText(CARD_COPY.failed);
    expect(screen.getByTestId('tickets-card-back-to-event').getAttribute('href')).toBe('/event/ev-1');
    expect(fetchOrderQr).not.toHaveBeenCalled();
  });

  it('failed free order uses the free wording', async () => {
    readOrderStatus.mockResolvedValue(reading('failed'));
    mount({ path: `/app/tickets?o=${ORDER}&free=1` });
    await screen.findByText(CARD_COPY.failedFree);
  });

  it('failed with no event id: no link', async () => {
    readOrderStatus.mockResolvedValue(reading('failed', { eventId: null }));
    mount({ path: `/app/tickets?o=${ORDER}` });
    await screen.findByText(CARD_COPY.failed);
    expect(screen.queryByTestId('tickets-card-back-to-event')).toBeNull();
  });

  it('?free=1 without a real order id is not believed', async () => {
    mount({ path: '/app/tickets?free=1' });
    await screen.findByText(CARD_COPY.none);
  });

  it('a malformed ?o= is ignored (treated as no order)', async () => {
    mount({ path: '/app/tickets?o=not-a-uuid' });
    await screen.findByText(CARD_COPY.none);
    expect(readOrderStatus).not.toHaveBeenCalled();
  });

  describe('still pending (polling)', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('pending: "Confirming your payment", then it polls again and shows the QR when paid', async () => {
      readOrderStatus.mockResolvedValueOnce(reading('pending')).mockResolvedValue(reading('paid'));
      mount({ path: `/app/tickets?o=${ORDER}` });
      await settle();
      expect(screen.getByTestId('tickets-card').getAttribute('data-state')).toBe('pending');
      expect(screen.getByText(CARD_COPY.pending)).toBeTruthy();
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(readOrderStatus).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('tickets-card-type').textContent).toBe('Full pass');
    });

    it('pending free order uses the free wording', async () => {
      readOrderStatus.mockResolvedValue(reading('pending'));
      mount({ path: `/app/tickets?o=${ORDER}&free=1` });
      await settle();
      expect(screen.getByText(CARD_COPY.pendingFree)).toBeTruthy();
    });

    it('gives up after the last poll and shows the "processing" line, not a spinner forever', async () => {
      readOrderStatus.mockResolvedValue(reading('pending'));
      mount({ path: `/app/tickets?o=${ORDER}` });
      await settle();
      await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60 * 1000); });
      expect(screen.getByTestId('tickets-card').getAttribute('data-state')).toBe('processing');
      expect(readOrderStatus).toHaveBeenCalledTimes(9); // first read + MAX_ORDER_POLLS repeats
    });
  });
});

describe('a kept order id', () => {
  it('uses the id kept across the Stripe redirect, moves it into the URL, and clears the store', async () => {
    saveOrderId(ORDER);
    mount();
    await screen.findByTestId('tickets-card-type');
    expect(fetchOrderQr).toHaveBeenCalledWith(ORDER);
    expect(readOrderId()).toBeNull();
  });
});

describe('the view-only lock (unfinished profile)', () => {
  it('a finished profile: no bar, no blurred Home', async () => {
    mount({ incomplete: false });
    await card();
    expect(screen.queryByTestId('tickets-finish-bar')).toBeNull();
    expect(screen.queryByTestId('tickets-home-peek')).toBeNull();
  });

  it('unfinished: the bar and the locked Home peek show under the card, and the card still works', async () => {
    mount({ path: `/app/tickets?o=${ORDER}`, incomplete: true, viewOnly: true });
    expect((await screen.findByTestId('tickets-card-type')).textContent).toBe('Full pass');
    expect(screen.getByTestId('tickets-finish-bar').textContent).toContain(FINISH_BAR);
    expect(screen.getByTestId('tickets-home-peek').getAttribute('aria-label')).toMatch(/locked/i);
  });

  it('the Start button and the blurred Home both open the same "What are you?" sheet', async () => {
    mount({ incomplete: true });
    await card();
    fireEvent.click(screen.getByTestId('tickets-finish-start'));
    expect(screen.getByTestId('profile-sheet')).toBeTruthy();
    fireEvent.click(screen.getByTestId('profile-sheet-close'));
    expect(screen.queryByTestId('profile-sheet')).toBeNull();
    fireEvent.click(screen.getByTestId('tickets-home-peek'));
    expect(screen.getByTestId('profile-sheet')).toBeTruthy();
  });
});
