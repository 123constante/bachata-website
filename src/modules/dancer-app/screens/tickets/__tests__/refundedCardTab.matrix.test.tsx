// @vitest-environment jsdom
/**
 * P2 website slice (brief refunded-card-website, owner clicks 2026-11-18): my_tickets_v1's
 * `refunded` + `order_refunded_pence`, the cancelled-night second line, Used, and the list order.
 * Every surface (My tickets page, Tickets tab card) x every shape, driven through the real parsers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/buyerOnboardingFlag', () => ({ get BUYER_ONBOARDING_ENABLED() { return flag.on; } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-11-18' }));
vi.mock('@/modules/tickets/TicketQrCode', () => ({ default: () => <div data-testid="qr" /> }));

import TicketCard from '@/modules/dancer-app/screens/tickets/TicketCard';
import { upcomingCardTickets } from '@/modules/dancer-app/screens/tickets/useTicketCard';
import { CARD_COPY } from '@/modules/dancer-app/screens/tickets/model';
import { parseMyTickets } from '@/modules/tickets/myTicketsModel';

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
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  flag.on = true;
});

const parse = (rows: unknown[]) => parseMyTickets({ tickets: rows, truncated: false, total_count: rows.length })!.tickets;

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

