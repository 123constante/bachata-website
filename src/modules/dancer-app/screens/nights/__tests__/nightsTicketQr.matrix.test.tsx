// @vitest-environment jsdom
/** Nights ticket QR (brief #1920): shape matrix x flag, plus the pure matcher. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

const h = vi.hoisted(() => ({
  on: true,
  qr: true,
  reply: { upcoming: [], past: [] } as unknown,
  tickets: [] as unknown[],
  ticketsErr: null as null | { code?: string; message: string },
  calls: [] as string[],
  rpc: null as unknown as (fn: string, args?: Record<string, unknown>) => Promise<unknown>,
}));
vi.mock('@/lib/goingCheckin', () => ({ get GOING_CHECKIN_ENABLED() { return h.on; } }));
vi.mock('../nightsTicket', async (orig) => ({ ...(await orig<typeof import('../nightsTicket')>()), get NIGHTS_TICKET_QR_ENABLED() { return h.qr; } }));
vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
h.rpc = async (fn: string, args?: Record<string, unknown>) => {
  h.calls.push(fn);
  if (fn === 'get_my_going_v1') return { data: h.reply, error: null };
  if (fn === 'my_tickets_v1') return h.ticketsErr ? { data: null, error: h.ticketsErr } : { data: { tickets: h.tickets, truncated: false, total_count: h.tickets.length }, error: null };
  if (fn === 'series_level_summary_p5_v1') {
    return { data: { series_id: String(args?.p_series_id), vote_count: 0, threshold: 7, counts: null, derived_level: null, my_level: null }, error: null };
  }
  return { data: null, error: { message: `unexpected rpc ${fn}` } };
};
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc: h.rpc }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (f: string, a?: Record<string, unknown>) => h.rpc(f, a) } }));
vi.mock('@/contexts/CityContext', () => ({
  CityProvider: ({ children }: { children: ReactNode }) => children,
  useCity: () => ({ citySlug: 'london-gb', setCitySlug: () => {} }),
}));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { GOING_SHAPES, cancelled, day, night } from './goingShapes';
import { ticketsForNight } from '../nightsTicket';
import type { MyTicket } from '@/modules/tickets/myTicketsModel';

const TOKEN = 'a'.repeat(64);
const tk = (i: number, over: Record<string, unknown> = {}) => ({
  order_id: `o${i}`, event_series_id: 's1', event_id: 'ev-a', occurrence_id: 'occ-a', event_title: 'Alpha', occurrence_date: day(2),
  start_time: '21:00', ticket_type_name: 'General', ticket_id: `t${i}`, qr_token: TOKEN.replace(/a/g, i % 2 ? 'b' : 'c'),
  short_code: null, checked_in: false, ...over,
});
const up = (...n: ReturnType<typeof night>[]) => ({ upcoming: n, past: [] });
const A = () => night('a', 'Alpha', 2);

type Case = { name: string; going: () => unknown; tickets: unknown[]; err?: { code?: string; message: string }; buttons: number };
const CASES: Case[] = [
  { name: 'going only', going: () => up(A()), tickets: [], buttons: 0 },
  { name: 'both, night ticket', going: () => up(A()), tickets: [tk(1)], buttons: 1 },
  { name: 'both, series-wide ticket', going: () => up(A()), tickets: [tk(1, { occurrence_id: null })], buttons: 1 },
  { name: 'both, 3 tickets', going: () => up(A()), tickets: [tk(1), tk(2), tk(3)], buttons: 1 },
  { name: 'used', going: () => up(A()), tickets: [tk(1, { checked_in: true })], buttons: 0 },
  { name: 'refunded', going: () => up(A()), tickets: [tk(1, { refunded: true, qr_token: null })], buttons: 0 },
  { name: 'cancelled night', going: () => up(cancelled('a', 'Alpha', 2)), tickets: [tk(1, { night_cancelled: true })], buttons: 0 },
  { name: 'other date, same series', going: () => up(A()), tickets: [tk(1, { occurrence_id: null, occurrence_date: day(9) })], buttons: 0 },
  { name: 'same title, other event', going: () => up(A()), tickets: [tk(1, { occurrence_id: 'occ-z', event_id: 'ev-z' })], buttons: 0 },
  { name: 'tickets read fails', going: () => up(A()), tickets: [], err: { message: 'boom' }, buttons: 0 },
  { name: 'signed out', going: () => up(A()), tickets: [], err: { code: '42501', message: 'denied' }, buttons: 0 },
  { name: 'past row', going: () => ({ upcoming: [], past: [night('a', 'Alpha', -3)] }), tickets: [tk(1, { occurrence_date: day(-3) })], buttons: 0 },
];

beforeEach(() => { h.on = true; h.qr = true; h.reply = GOING_SHAPES.empty(); h.tickets = []; h.ticketsErr = null; h.calls = []; localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); resetShell(); });
const open = () => renderInShell({ path: '/app/nights' });
const html = () => screen.getByTestId('dancer-screen-nights').innerHTML;

describe('Nights ticket QR x shapes (flag on)', () => {
  it.each(CASES)('$name', async (c) => {
    h.reply = c.going(); h.tickets = c.tickets; h.ticketsErr = c.err ?? null;
    open();
    await screen.findByTestId('nights-upcoming');
    await waitFor(() => expect(screen.getAllByTestId('night-row').length).toBeGreaterThan(0));
    if (c.buttons > 0) await screen.findAllByTestId('night-qr');
    else await new Promise((r) => setTimeout(r, 50));
    const btns = screen.queryAllByTestId('night-qr');
    expect(btns).toHaveLength(c.buttons);
    for (const b of btns) expect(b.className).toMatch(/h-\[44px\].*w-\[44px\]/);
    expect(html()).not.toContain(TOKEN.replace(/a/g, 'b'));
    expect(html()).not.toContain(TOKEN.replace(/a/g, 'c'));
    if (c.name.startsWith('past')) expect(screen.getByText('Went')).toBeTruthy();
    if (c.buttons === 0 && !c.name.startsWith('past')) expect(screen.queryByRole('alert')).toBeNull();
  });
  it('sheet opens, shows ticket, closes', async () => {
    h.reply = up(A()); h.tickets = [tk(1)];
    open();
    fireEvent.click(await screen.findByTestId('night-qr'));
    const sheet = await screen.findByTestId('night-qr-sheet');
    expect(within(sheet).getByTestId('ticket-qr')).toBeTruthy();
    expect(sheet.textContent).toContain('Alpha');
    expect(sheet.textContent).toContain('General');
    expect(within(sheet).queryByTestId('night-qr-next')).toBeNull();
    fireEvent.click(within(sheet).getByText('Close'));
    await waitFor(() => expect(screen.queryByTestId('night-qr-sheet')).toBeNull());
  });
  it('3 tickets page and wrap', async () => {
    h.reply = up(A()); h.tickets = [tk(1), tk(2), tk(3)];
    open();
    fireEvent.click(await screen.findByTestId('night-qr'));
    const count = await screen.findByTestId('night-qr-count');
    expect(count.textContent).toBe('Ticket 1 of 3');
    fireEvent.click(screen.getByTestId('night-qr-next'));
    expect(count.textContent).toBe('Ticket 2 of 3');
    fireEvent.click(screen.getByTestId('night-qr-prev'));
    fireEvent.click(screen.getByTestId('night-qr-prev'));
    expect(count.textContent).toBe('Ticket 3 of 3');
  });
  it('many: 40 upcoming, 500 tickets, buttons only on matches', async () => {
    h.reply = GOING_SHAPES.many();
    h.tickets = Array.from({ length: 500 }, (_, i) => tk(i, { occurrence_id: i < 3 ? `occ-u${i}` : `occ-x${i}`, event_id: `ev-x${i}`, occurrence_date: day(i + 1) }));
    open();
    await waitFor(() => expect(screen.queryAllByTestId('night-qr')).toHaveLength(3));
  });
});

describe('flag and reads', () => {
  it('flag off: no ticket read, HTML equals going-only', async () => {
    h.reply = up(A()); h.tickets = [tk(1)]; h.qr = false;
    open();
    await screen.findByTestId('nights-upcoming');
    await new Promise((r) => setTimeout(r, 50));
    expect(h.calls).not.toContain('my_tickets_v1');
    expect(screen.queryAllByTestId('night-qr')).toHaveLength(0);
  });
  it('zero upcoming rows: no ticket read', async () => {
    h.reply = GOING_SHAPES.pastOnly(); h.tickets = [tk(1)];
    open();
    await screen.findByTestId('nights-past');
    await new Promise((r) => setTimeout(r, 50));
    expect(h.calls).not.toContain('my_tickets_v1');
  });
});

describe('ticketsForNight', () => {
  const n = { occurrenceId: 'occ-a', seriesId: 'ev-a', date: day(2), status: 'live' };
  const t = (over: Partial<MyTicket>): MyTicket => ({
    orderId: 'o', seriesId: null, eventId: 'ev-a', occurrenceId: 'occ-a', title: 'x', date: day(2), startTime: null, typeName: null,
    ticketId: 't', qrToken: 'q', shortCode: null, checkedIn: false, ...over,
  }) as MyTicket;
  it.each([
    ['same occurrence', t({}), 1],
    ['series-wide same date', t({ occurrenceId: null }), 1],
    ['series-wide other date', t({ occurrenceId: null, date: day(9) }), 0],
    ['series-wide no date', t({ occurrenceId: null, date: null }), 0],
    ['series-wide other event', t({ occurrenceId: null, eventId: 'ev-z' }), 0],
    ['other occurrence', t({ occurrenceId: 'occ-z' }), 0],
    ['no token', t({ qrToken: null }), 0],
    ['used', t({ checkedIn: true }), 0],
    ['refunded', t({ refunded: true }), 0],
  ])('%s', (_name, ticket, want) => {
    expect(ticketsForNight(n, [ticket])).toHaveLength(want as number);
  });
  it('cancelled night gives none', () => {
    expect(ticketsForNight({ ...n, status: 'cancelled' }, [t({})])).toHaveLength(0);
  });
});
