// @vitest-environment jsdom
/**
 * /account/my-tickets: every prod-surveyed shape x screen state (brief my-tickets-screen).
 * Drives the real page through a mocked supabase.rpc('my_tickets_v1') and a mocked useAuth.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock('@/lib/seo', () => ({ useSeo: () => undefined }));
const auth = { user: { id: 'u1' } as { id: string } | null, authStatus: 'ready' as 'ready' | 'resolving' | 'unavailable', retryAuth: vi.fn() };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
const flags = vi.hoisted(() => ({ door: true }));
vi.mock('@/modules/organiser/p3/door/doorFlags', async (orig) => ({ ...(await orig<object>()), get ticketDoorCode() { return flags.door; } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-11-04' }));

import MyTicketsPage from '../MyTicketsPage';
import { dateWords, formatShortCode, groupTickets, parseMyTickets, qrOpenByDefault, stateCopy, truncatedNote, whenLine, MY_TICKETS_CAP, QR_OPEN_DEFAULT } from '../myTicketsModel';

const TOKEN = (n: number) => n.toString(16).padStart(64, 'a');
let seq = 0;
const row = (o: Partial<Record<string, unknown>> = {}) => ({
  order_id: 'ord11111-0000-0000-0000-000000000001',
  event_series_id: 'ser1',
  event_title: 'Friday Social',
  occurrence_date: '2026-11-07',
  start_time: '21:00',
  ticket_type_name: 'Early bird',
  ticket_id: `t${++seq}`,
  qr_token: TOKEN(seq),
  checked_in: false,
  checked_in_at: null,
  ...o,
});
const ok = (tickets: unknown[], extra: Record<string, unknown> = {}) => ({ data: { tickets, truncated: false, total_count: tickets.length, ...extra }, error: null });

/** short_code reply shapes (brief ticket-buyer-short-code-web): value or omitted key -> what the screen shows. */
const CODE_SHAPES: Array<[string, Record<string, unknown>, string | null]> = [
  ['with code', { short_code: 'K7M2QX' }, 'K7M 2QX'],
  ['null', { short_code: null }, null],
  ['lowercase', { short_code: 'k7m2qx' }, 'K7M 2QX'],
  ['malformed: banned letter O', { short_code: 'K7M2QO' }, null],
  ['malformed: too short', { short_code: 'K7M2Q' }, null],
  ['malformed: grouped with a space', { short_code: 'K7M 2QX' }, null],
  ['malformed: number', { short_code: 123456 }, null],
  ['missing key', {}, null],
];
const CODE_STATES = ['valid', 'checked in', 'void hidden'] as const;
const NO_CODE_WORDS = /door code/i;

type Shape = { name: string; reply?: () => unknown; signedOut?: boolean; authStatus?: 'resolving' | 'unavailable'; state: string; check?: () => void };

const SHAPES: Shape[] = [
  { name: '0 tickets', reply: () => ok([]), state: 'empty', check: () => expect(screen.getByRole('link', { name: 'Find an event' }).getAttribute('href')).toBe('/') },
  { name: '1 ticket upcoming', reply: () => ok([row()]), state: 'ready', check: () => {
    const up = screen.getByTestId('my-tickets-upcoming');
    expect(within(up).getAllByTestId('my-ticket')).toHaveLength(1);
    expect(screen.getByTestId('my-ticket-when').textContent).toBe('Sat 7 Nov \u00b7 21:00');
    expect(screen.getByTestId('ticket-qr')).toBeTruthy();
    expect(screen.queryByTestId('my-tickets-past')).toBeNull();
    expect(screen.getByText(/Order ord11111/)).toBeTruthy();
  } },
  { name: 'several in one order', reply: () => ok([row(), row(), row()]), state: 'ready', check: () => {
    expect(screen.getAllByTestId('my-ticket')).toHaveLength(3);
    expect(screen.getByText(/Ticket 2 of 3/)).toBeTruthy();
    expect(screen.getAllByTestId('ticket-qr')).toHaveLength(3);
  } },
  { name: '40 upcoming tickets', reply: () => ok(Array.from({ length: 40 }, () => row())), state: 'ready', check: () => {
    expect(screen.getAllByTestId('my-ticket')).toHaveLength(40);
    expect(screen.getAllByTestId('ticket-qr')).toHaveLength(3);
    const buttons = screen.getAllByRole('button', { name: 'Show QR code' });
    expect(buttons).toHaveLength(37);
    fireEvent.click(buttons[0]);
    expect(screen.getAllByTestId('ticket-qr')).toHaveLength(4);
  } },
  { name: 'past + checked in', reply: () => ok([row({ occurrence_date: '2026-10-01', checked_in: true, checked_in_at: '2026-10-01T21:42:00Z' })]), state: 'ready', check: () => {
    expect(screen.getByTestId('my-ticket-checked-in').textContent).toMatch(/^Checked in at /);
    expect(screen.queryByTestId('ticket-qr')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show anyway' }));
    expect(screen.getByTestId('ticket-qr')).toBeTruthy();
    expect(screen.getByText('Already used at the door.')).toBeTruthy();
  } },
  { name: 'past + upcoming mix', reply: () => ok([row(), row({ occurrence_date: '2026-11-04' }), row({ occurrence_date: '2026-10-01', order_id: 'ord2' })]), state: 'ready', check: () => {
    expect(within(screen.getByTestId('my-tickets-upcoming')).getAllByTestId('my-ticket')).toHaveLength(2);
    const past = screen.getByTestId('my-tickets-past');
    expect(within(past).getAllByTestId('my-ticket')).toHaveLength(1);
    expect(within(past).queryByTestId('ticket-qr')).toBeNull(); // past QR collapsed
    expect(within(past).getByRole('button', { name: 'Show QR code' })).toBeTruthy();
    expect(screen.getByText(/Today \u00b7 21:00/)).toBeTruthy();
  } },
  { name: 'checked_in true', reply: () => ok([row({ checked_in: true, checked_in_at: '2026-11-04T21:42:00Z' })]), state: 'ready', check: () => {
    expect(screen.getByTestId('my-ticket-checked-in').textContent).toMatch(/^Checked in at \d\d:\d\d/);
    expect(screen.queryByTestId('ticket-qr')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show anyway' }));
    expect(screen.getByTestId('ticket-qr')).toBeTruthy();
    expect(screen.getByText('Already used at the door.')).toBeTruthy();
  } },
  { name: 'occurrence_date null (series-wide type)', reply: () => ok([row({ occurrence_date: null })]), state: 'ready', check: () => {
    expect(within(screen.getByTestId('my-tickets-upcoming')).getByTestId('my-ticket-when').textContent).toBe('Date to be confirmed \u00b7 21:00');
  } },
  { name: 'truncated true, total 600', reply: () => ok(Array.from({ length: 3 }, () => row()), { truncated: true, total_count: 600 }), state: 'ready', check: () => {
    expect(screen.getByTestId('my-tickets-truncated').textContent).toMatch(/^Showing 3 of 600 tickets/);
  } },
  { name: 'bad token: no QR, says why', reply: () => ok([row({ qr_token: 'nope' })]), state: 'ready', check: () => {
    expect(screen.queryByTestId('ticket-qr')).toBeNull();
    expect(screen.getByTestId('my-ticket-no-qr').textContent).toMatch(/confirmation email/);
  } },
  { name: 'signed out (RPC 42501)', reply: () => ({ data: null, error: { code: '42501', message: 'not signed in' } }), state: 'signed_out', check: () => {
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/auth?mode=signin&returnTo=%2Faccount%2Fmy-tickets');
  } },
  { name: 'signed out (no session)', signedOut: true, state: 'signed_out', check: () => expect(rpc).not.toHaveBeenCalled() },
  { name: 'RPC error', reply: () => ({ data: null, error: { code: 'PGRST202', message: 'x' } }), state: 'error', check: () => {
    rpc.mockResolvedValueOnce(ok([row()]));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  } },
  { name: 'malformed reply reads as error, never as empty', reply: () => ({ data: [], error: null }), state: 'error' },
  { name: 'slow (pending)', reply: () => new Promise(() => {}), state: 'loading', check: () => expect(screen.getByText(/Loading your tickets/)).toBeTruthy() },
  { name: 'auth resolving', authStatus: 'resolving', state: 'loading' },
  { name: 'auth unavailable', authStatus: 'unavailable', state: 'error', check: () => {
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(auth.retryAuth).toHaveBeenCalled();
  } },
];

beforeEach(() => {
  rpc.mockReset();
  auth.user = { id: 'u1' };
  auth.authStatus = 'ready';
  auth.retryAuth.mockReset();
});
afterEach(cleanup);

describe('my tickets page: shape x state matrix', () => {
  it.each(SHAPES)('$name -> $state', async (s) => {
    if (s.signedOut) auth.user = null;
    if (s.authStatus) { auth.authStatus = s.authStatus; auth.user = null; }
    if (s.reply) rpc.mockImplementation(() => s.reply!());
    render(<MemoryRouter initialEntries={['/account/my-tickets']}><MyTicketsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('my-tickets').getAttribute('data-state')).toBe(s.state));
    if (s.reply) expect(rpc).toHaveBeenCalledWith('my_tickets_v1');
    s.check?.();
    if (s.name === 'RPC error') await waitFor(() => expect(screen.getByTestId('my-tickets').getAttribute('data-state')).toBe('ready'));
  });

  it('the token never reaches the URL, an href, or the console', async () => {
    const log = vi.spyOn(console, 'log');
    const err = vi.spyOn(console, 'error');
    rpc.mockResolvedValue(ok([row()]));
    const { container } = render(<MemoryRouter><MyTicketsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('ticket-qr')).toBeTruthy());
    const token = TOKEN(seq);
    expect(container.innerHTML.includes(token)).toBe(false);
    for (const c of [...log.mock.calls, ...err.mock.calls]) expect(JSON.stringify(c)).not.toContain(token);
  });
});

describe('my tickets: door code (reply shape x ticket state)', () => {
  afterEach(() => { flags.door = true; vi.restoreAllMocks(); });
  const cases = CODE_SHAPES.flatMap(([label, extra, want]) => CODE_STATES.map((st) => [label, st, extra, want] as const));
  it.each(cases)('%s x %s', async (_label, st, extra, want) => {
    const logs = (['log', 'info', 'warn', 'error', 'debug'] as const).map((k) => vi.spyOn(console, k));
    const checked = st === 'checked in';
    // void hidden: the order had 3 tickets, one voided; my_tickets_v1 drops it (t.status <> 'void').
    const rows = st === 'void hidden' ? [row(extra), row(extra)] : [row({ ...extra, checked_in: checked, checked_in_at: checked ? '2026-11-04T21:42:00Z' : null })];
    rpc.mockResolvedValue(ok(rows));
    const { container } = render(<MemoryRouter><MyTicketsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('my-tickets').getAttribute('data-state')).toBe('ready'));
    const lines = screen.queryAllByTestId('my-ticket-short-code');
    expect(screen.getAllByTestId('my-ticket')).toHaveLength(rows.length);
    if (want === null) {
      expect(lines).toHaveLength(0);
      expect(container.textContent).not.toMatch(NO_CODE_WORDS);
    } else {
      expect(lines).toHaveLength(rows.length);
      for (const l of lines) {
        expect(l.querySelector('[data-testid="door-code-value"]')?.textContent).toBe(want);
        expect(l.textContent).toMatch(/^Door code/);
        expect(l.getAttribute('data-checked-in')).toBe(checked ? 'true' : 'false');
        expect(l.textContent?.includes('Checked in')).toBe(checked);
        expect(l.querySelector('[data-testid="door-code-value"]')?.className).toContain('font-mono');
      }
    }
    // the QR stays as it was: open on an unchecked ticket, collapsed behind Show anyway when checked in
    expect(screen.queryAllByTestId('ticket-qr')).toHaveLength(checked ? 0 : rows.length);
    for (const spy of logs) for (const c of spy.mock.calls) expect(JSON.stringify(c)).not.toMatch(/K7M ?2QX|k7m2qx/i);
  });
  it('door flag off: a valid code shows no code line and no words about it', async () => {
    flags.door = false;
    rpc.mockResolvedValue(ok([row({ short_code: 'K7M2QX' })]));
    const { container } = render(<MemoryRouter><MyTicketsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('ticket-qr')).toBeTruthy());
    expect(screen.queryByTestId('my-ticket-short-code')).toBeNull();
    expect(container.textContent).not.toMatch(NO_CODE_WORDS);
  });
  it('collapsed QR (4th ticket) and a bad QR token still show the code', async () => {
    rpc.mockResolvedValue(ok([...Array.from({ length: 4 }, () => row({ short_code: 'ABC234' })), row({ qr_token: 'nope', short_code: 'ABC234' })]));
    render(<MemoryRouter><MyTicketsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByTestId('ticket-qr')).toHaveLength(3));
    expect(screen.getAllByTestId('my-ticket-short-code')).toHaveLength(5);
  });
  it('parser: short code per shape', () => {
    for (const [, extra, want] of CODE_SHAPES) {
      const t = parseMyTickets({ tickets: [row(extra)] })!.tickets[0];
      expect(t.shortCode === null ? null : formatShortCode(t.shortCode)).toBe(want);
    }
  });
});

describe('my tickets model', () => {
  it('every non-ready state names what the person can do', () => {
    for (const st of ['signed_out', 'error', 'empty'] as const) expect(stateCopy(st, '/auth').action).not.toBeNull();
    expect(stateCopy('loading', '/auth').action).toBeNull();
  });
  it('groups by the London day; null date is upcoming', () => {
    const r = parseMyTickets({ tickets: [row({ occurrence_date: '2026-11-03' }), row({ occurrence_date: null }), row({ occurrence_date: '2026-11-04' })], truncated: false, total_count: 3 })!;
    const g = groupTickets(r.tickets, '2026-11-04');
    expect([g.upcoming.length, g.past.length]).toEqual([2, 1]);
  });
  describe('qrOpenByDefault', () => {
    const TODAY = '2026-11-04';
    const mk = (n: number, date: string | null = '2026-11-07') =>
      parseMyTickets({ tickets: Array.from({ length: n }, () => row({ occurrence_date: date })) })!.tickets;
    const ids = (a: { ticketId: string }[]) => a.map((t) => t.ticketId);
    it('is 3', () => expect(QR_OPEN_DEFAULT).toBe(3));
    it('0 tickets: none', () => expect(qrOpenByDefault([], TODAY).size).toBe(0));
    it('2 tickets: both open', () => {
      const t = mk(2);
      expect([...qrOpenByDefault(t, TODAY)]).toEqual(ids(t));
    });
    it('5 upcoming: first 3 open', () => {
      const t = mk(5);
      expect([...qrOpenByDefault(t, TODAY)]).toEqual(ids(t).slice(0, 3));
    });
    it('today tickets open first, then server order', () => {
      const t = [...mk(3), ...mk(2, TODAY)];
      const s = qrOpenByDefault(t, TODAY);
      expect(s.size).toBe(3);
      expect([t[3], t[4], t[0]].every((x) => s.has(x.ticketId))).toBe(true);
    });
    it('40 today: exactly 3', () => expect(qrOpenByDefault(mk(40, TODAY), TODAY).size).toBe(3));
    it('null date is an ordinary upcoming ticket', () => {
      const t = mk(2, null);
      expect(qrOpenByDefault(t, TODAY).size).toBe(2);
    });
    it('past tickets never open', () => {
      const t = mk(4, '2026-10-01');
      expect(qrOpenByDefault(t, TODAY).size).toBe(0);
    });
  });
  it('dates: year only when not this year; bad time dropped', () => {
    expect(dateWords('2027-01-02', '2026-11-04')).toBe('Sat 2 Jan 2027');
    const t = parseMyTickets({ tickets: [row({ start_time: '25:00' })] })!.tickets[0];
    expect(whenLine(t, '2026-11-04')).toBe('Sat 7 Nov');
  });
  it('truncation note at the cap; checked_in_at alone means checked in', () => {
    const r = parseMyTickets({ tickets: [row({ checked_in: false, checked_in_at: '2026-11-04T21:00:00Z' })], truncated: true, total_count: 600 })!;
    expect(r.tickets[0].checkedIn).toBe(true);
    expect(truncatedNote(r)).toMatch(/of 600/);
    expect(MY_TICKETS_CAP).toBe(500);
    expect(parseMyTickets(null)).toBeNull();
    expect(parseMyTickets({ tickets: 'x' })).toBeNull();
  });
});
