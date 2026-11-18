// @vitest-environment jsdom
/**
 * P2 website slice (brief refunded-card-website, owner clicks 2026-11-18): my_tickets_v1's
 * `refunded` + `order_refunded_pence`, the cancelled-night second line, Used, and the list order.
 * Every surface (My tickets page, Tickets tab card) x every shape, driven through the real parsers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/buyerOnboardingFlag', () => ({ get BUYER_ONBOARDING_ENABLED() { return flag.on; } }));
const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock('@/lib/seo', () => ({ useSeo: () => undefined }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, authStatus: 'ready', retryAuth: () => {} }) }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-11-18' }));
vi.mock('../TicketQrCode', () => ({ default: () => <div data-testid="qr" /> }));

import MyTicketsPage from '../MyTicketsPage';
import TicketCard from '@/modules/dancer-app/screens/tickets/TicketCard';
import { upcomingCardTickets } from '@/modules/dancer-app/screens/tickets/useTicketCard';
import { CARD_COPY } from '@/modules/dancer-app/screens/tickets/model';
import { parseMyTickets } from '../myTicketsModel';
import { orderTicketList, partRefundLine, ticketStatus, ticketStatusLines, ticketStatusTag } from '../ticketCardStatus';

const TODAY = '2026-11-18';
const TOKEN = (n: number) => n.toString(16).padStart(64, 'a');
let seq = 0;
const row = (o: Record<string, unknown> = {}) => {
  seq += 1;
  return {
    order_id: `ord${seq}-0000-0000-0000-000000000000`, event_series_id: 'ser1', event_title: `Night ${seq}`,
    occurrence_date: '2026-11-21', start_time: '21:00', ticket_type_name: 'Party', ticket_id: `t${seq}`,
    qr_token: TOKEN(seq), short_code: null, checked_in: false, checked_in_at: null, night_cancelled: false,
    refunded: false, order_refunded_pence: 0, ...o,
  };
};
const REFUNDED = { refunded: true, qr_token: null, order_refunded_pence: 1250 };
const REFUND_LINE = '\u00a312.50 refunded, usually 5 to 10 working days to reach your card';
const CANCEL_LINES = ['This night was cancelled', 'The organiser will be in touch about refunds'];

type Want = { status: string; tag: string | null; lines: string[]; qr: boolean; part: string | null; listed: boolean };
const SHAPES: [string, Record<string, unknown>, Want][] = [
  ['valid', {}, { status: 'valid', tag: null, lines: [], qr: true, part: null, listed: true }],
  ['used', { checked_in: true, checked_in_at: '2026-11-18T21:14:00Z', occurrence_date: TODAY }, { status: 'used', tag: 'Used', lines: ['Already used at the door'], qr: false, part: null, listed: true }],
  ['cancelled', { night_cancelled: true }, { status: 'event_cancelled', tag: null, lines: CANCEL_LINES, qr: false, part: null, listed: true }],
  ['refunded', REFUNDED, { status: 'refunded', tag: 'Refunded', lines: [REFUND_LINE], qr: false, part: null, listed: true }],
  ['refunded + cancelled: refunded wins', { ...REFUNDED, night_cancelled: true }, { status: 'refunded', tag: 'Refunded', lines: [REFUND_LINE], qr: false, part: null, listed: true }],
  ['refunded, amount unknown', { refunded: true, qr_token: null, order_refunded_pence: null }, { status: 'refunded', tag: 'Refunded', lines: ['This ticket was refunded'], qr: false, part: null, listed: true }],
  ['part refund (money only)', { order_refunded_pence: 500 }, { status: 'valid', tag: null, lines: [], qr: true, part: 'Part refunded \u00a35', listed: true }],
  ['used + part refund (prod shape)', { checked_in: true, checked_in_at: '2026-11-18T21:14:00Z', order_refunded_pence: 300 }, { status: 'used', tag: 'Used', lines: ['Already used at the door'], qr: false, part: 'Part refunded \u00a33', listed: true }],
  ['past night', { occurrence_date: '2026-11-10' }, { status: 'passed', tag: null, lines: ['This night has passed'], qr: false, part: null, listed: false }],
  ['refunded, past night', { ...REFUNDED, occurrence_date: '2026-11-10' }, { status: 'refunded', tag: 'Refunded', lines: [REFUND_LINE], qr: false, part: null, listed: false }],
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T12:00:00Z'));
  rpc.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  flag.on = true;
});

const parse = (rows: unknown[]) => parseMyTickets({ tickets: rows, truncated: false, total_count: rows.length })!.tickets;

describe('the one mapping: parse + status x every shape', () => {
  it.each(SHAPES)('%s', (_n, over, want) => {
    const [t] = parse([row(over)]);
    const s = ticketStatus({ date: t.date, eventCancelled: t.nightCancelled, refunded: t.refunded, checkedIn: t.checkedIn }, TODAY);
    expect(s).toBe(want.status);
    expect(ticketStatusTag(s)).toBe(want.tag);
    if (want.listed) expect(ticketStatusLines(s, t.refundedPence)).toEqual(want.lines);
    expect(partRefundLine(t.refunded, t.refundedPence)).toBe(want.part);
  });
  it('old replies without the new keys: not refunded, 0 pence', () => {
    const [t] = parse([{ ...row(), refunded: undefined, order_refunded_pence: undefined }]);
    expect(t.refunded).toBe(false);
    expect(t.refundedPence).toBe(0);
  });
});

describe('My tickets page x every shape (flag ON)', () => {
  it.each(SHAPES)('%s', async (_n, over, want) => {
    rpc.mockResolvedValue({ data: { tickets: [row(over)], truncated: false, total_count: 1 }, error: null });
    render(<MemoryRouter><MyTicketsPage /></MemoryRouter>);
    if (!want.listed) {
      await waitFor(() => expect(screen.getByTestId('my-tickets').getAttribute('data-state')).toBe('empty'));
      expect(screen.getByText('No tickets yet')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Browse events' }).getAttribute('href')).toBe('/');
      return;
    }
    const card = await screen.findByTestId('my-ticket');
    expect(card.getAttribute('data-ticket-status')).toBe(want.status);
    expect(within(card).queryByTestId('my-ticket-tag')?.textContent ?? null).toBe(want.tag);
    const st = within(card).queryByTestId('my-ticket-status');
    expect(st ? Array.from(st.querySelectorAll('p')).map((p) => p.textContent) : []).toEqual(want.lines);
    expect(within(card).queryByTestId('qr') !== null).toBe(want.qr);
    expect(within(card).queryByTestId('my-ticket-part-refund')?.textContent ?? null).toBe(want.part);
    expect(card.getAttribute('style') ?? '').toMatch(want.status === 'valid' ? /^(?!.*opacity)/ : /opacity: 0.6/);
    expect(card.textContent).not.toMatch(/contact/i);
    expect(card.textContent).not.toMatch(/\u00c2|\u00e2\u20ac/);
  });
  it('empty reply: No tickets yet + one button to browse events', async () => {
    rpc.mockResolvedValue({ data: { tickets: [], truncated: false, total_count: 0 }, error: null });
    render(<MemoryRouter><MyTicketsPage /></MemoryRouter>);
    expect(await screen.findByText('No tickets yet')).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
  it('list order: soonest first, greyed at the bottom, past dropped, no Past section', async () => {
    rpc.mockResolvedValue({ data: { tickets: [
      row({ event_title: 'Refunded soon', occurrence_date: '2026-11-19', ...REFUNDED }),
      row({ event_title: 'Late valid', occurrence_date: '2026-12-05' }),
      row({ event_title: 'Old', occurrence_date: '2026-11-01' }),
      row({ event_title: 'TBC valid', occurrence_date: null }),
      row({ event_title: 'Cancelled', occurrence_date: '2026-11-20', night_cancelled: true }),
      row({ event_title: 'Soon valid', occurrence_date: '2026-11-20' }),
    ], truncated: false, total_count: 6 }, error: null });
    render(<MemoryRouter><MyTicketsPage /></MemoryRouter>);
    await screen.findAllByTestId('my-ticket');
    const titles = screen.getAllByTestId('my-ticket').map((c) => c.querySelector('h3')!.textContent);
    expect(titles).toEqual(['Soon valid', 'Late valid', 'TBC valid', 'Refunded soon', 'Cancelled']);
    expect(screen.queryByTestId('my-tickets-past')).toBeNull();
  });
  it('flag OFF: Upcoming / Past sections as before, no part-refund line', async () => {
    flag.on = false;
    rpc.mockResolvedValue({ data: { tickets: [row({ order_refunded_pence: 500 }), row({ occurrence_date: '2026-11-01' })], truncated: false, total_count: 2 }, error: null });
    render(<MemoryRouter><MyTicketsPage /></MemoryRouter>);
    expect(await screen.findByTestId('my-tickets-past')).toBeTruthy();
    expect(screen.queryByTestId('my-ticket-part-refund')).toBeNull();
  });
});

describe('Tickets tab card x every shape (flag ON)', () => {
  it.each(SHAPES)('%s', (_n, over, want) => {
    const tickets = upcomingCardTickets(parse([row(over)]), TODAY);
    if (!want.listed) { expect(tickets).toEqual([]); return; }
    expect(tickets).toHaveLength(1);
    render(<MemoryRouter><TicketCard view={{ kind: 'tickets', tickets }} retry={() => {}} copy={CARD_COPY} /></MemoryRouter>);
    const card = screen.getByTestId('tickets-card');
    expect(card.getAttribute('data-ticket-status')).toBe(want.status);
    expect(screen.queryByTestId('tickets-card-tag')?.textContent ?? null).toBe(want.tag);
    const st = screen.queryByTestId('tickets-card-status');
    expect(st ? Array.from(st.querySelectorAll('p')).map((p) => p.textContent) : []).toEqual(want.lines);
    expect(screen.queryByTestId('qr') !== null).toBe(want.qr);
    expect(screen.queryByTestId('tickets-card-part-refund')?.textContent ?? null).toBe(want.part);
  });
  it('carousel order matches the list order', () => {
    const rows = [row({ event_title: 'R', occurrence_date: '2026-11-19', ...REFUNDED }), row({ event_title: 'B', occurrence_date: '2026-11-25' }), row({ event_title: 'A', occurrence_date: '2026-11-20' })];
    expect(upcomingCardTickets(parse(rows), TODAY).map((t) => t.eventTitle)).toEqual(['A', 'B', 'R']);
  });
  it('flag OFF: refunded rows (no QR) never reach the card', () => {
    flag.on = false;
    expect(upcomingCardTickets(parse([row(REFUNDED)]), TODAY)).toEqual([]);
  });
});

describe('orderTicketList', () => {
  it('stable for equal keys', () => {
    const xs = [{ id: 1, d: '2026-11-20' }, { id: 2, d: '2026-11-20' }];
    expect(orderTicketList(xs, () => 'valid', (x) => x.d, TODAY).map((x) => x.id)).toEqual([1, 2]);
  });
});
