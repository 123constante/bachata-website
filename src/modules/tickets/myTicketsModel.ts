/**
 * /account/my-tickets (queue B): the pure half. my_tickets_v1's reply parsed defensively,
 * grouped Upcoming / Past by the London day, and every word the page shows. No React, no
 * Supabase: the matrix test drives this file and the page reads only from it.
 *
 * The qr_token is a door secret: it is carried here only to draw the QR and is never put
 * in a string the page logs, links or sends anywhere.
 */
import { londonClock } from '@/modules/organiser/p3/door/model';

export const MY_TICKETS_PATH = '/account/my-tickets';
/** = my_tickets_v1's row cap (admin: LIMIT 501 sentinel, 500 returned). */
export const MY_TICKETS_CAP = 500;

const DOT = '·';
const ELL = '…';

export interface MyTicket {
  orderId: string;
  seriesId: string | null;
  title: string;
  /** "YYYY-MM-DD", or null for a series-wide ticket with no scheduled night. */
  date: string | null;
  /** "HH:MM" or null. */
  startTime: string | null;
  typeName: string | null;
  ticketId: string;
  qrToken: string | null;
  checkedIn: boolean;
  checkedInAt: string | null;
}

export interface MyTicketsReply {
  tickets: MyTicket[];
  truncated: boolean;
  totalCount: number;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const TOKEN_RE = /^[0-9a-f]{64}$/;

/** Null when the reply is not the RPC's shape at all (reads as an error, never as "no tickets"). */
export function parseMyTickets(data: unknown): MyTicketsReply | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.tickets)) return null;
  const tickets: MyTicket[] = [];
  for (const raw of o.tickets) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const ticketId = str(r.ticket_id);
    const orderId = str(r.order_id);
    if (!ticketId || !orderId) continue;
    const date = str(r.occurrence_date);
    const time = str(r.start_time);
    const token = str(r.qr_token)?.toLowerCase() ?? null;
    tickets.push({
      orderId,
      ticketId,
      seriesId: str(r.event_series_id),
      title: str(r.event_title) ?? 'Event',
      date: date && DATE_RE.test(date) ? date : null,
      startTime: time && TIME_RE.test(time) ? time : null,
      typeName: str(r.ticket_type_name),
      // Only a token the door would accept is drawn; anything else shows "QR unavailable".
      qrToken: token && TOKEN_RE.test(token) ? token : null,
      checkedIn: r.checked_in === true || str(r.checked_in_at) !== null,
      checkedInAt: str(r.checked_in_at),
    });
  }
  const total = typeof o.total_count === 'number' && Number.isFinite(o.total_count) ? Math.max(o.total_count, tickets.length) : tickets.length;
  return { tickets, truncated: o.truncated === true, totalCount: total };
}

/** Upcoming = no date yet, or today or later in London; past = before today. Server order kept. */
export function groupTickets(tickets: MyTicket[], todayKey: string): { upcoming: MyTicket[]; past: MyTicket[] } {
  const upcoming: MyTicket[] = [];
  const past: MyTicket[] = [];
  for (const t of tickets) (t.date !== null && t.date < todayKey ? past : upcoming).push(t);
  return { upcoming, past };
}

/** "Ticket 2 of 3" inside its order; null for a one-ticket order. */
export function orderPositions(tickets: MyTicket[]): Map<string, string | null> {
  const byOrder = new Map<string, string[]>();
  for (const t of tickets) byOrder.set(t.orderId, [...(byOrder.get(t.orderId) ?? []), t.ticketId]);
  const out = new Map<string, string | null>();
  for (const ids of byOrder.values()) ids.forEach((id, i) => out.set(id, ids.length > 1 ? `Ticket ${i + 1} of ${ids.length}` : null));
  return out;
}

/** "Fri 7 Nov" (year added when it is not this year); null date = "Date to be confirmed". */
export function dateWords(date: string | null, todayKey: string): string {
  if (!date) return 'Date to be confirmed';
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return 'Date to be confirmed';
  const sameYear = date.slice(0, 4) === todayKey.slice(0, 4);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
  }).format(d).replace(/,/g, '');
}

/** "Fri 7 Nov · 21:00"; "Today · 21:00" on the night. */
export function whenLine(t: MyTicket, todayKey: string): string {
  const day = t.date === todayKey ? 'Today' : dateWords(t.date, todayKey);
  return t.startTime ? `${day} ${DOT} ${t.startTime}` : day;
}

/** Same clock words as the door screen (one mapping: door/model londonClock). */
export function checkedInLine(t: MyTicket, now: Date = new Date()): string {
  const at = londonClock(t.checkedInAt, now);
  return at ? `Checked in at ${at}` : 'Checked in';
}

/** First 8 characters, exactly as the thank-you page prints the order reference. */
export const orderRef = (orderId: string) => orderId.slice(0, 8);

export function truncatedNote(r: MyTicketsReply): string | null {
  if (!r.truncated && r.totalCount <= r.tickets.length) return null;
  return `Showing ${r.tickets.length} of ${r.totalCount} tickets: the next nights and the most recent past ones. Older tickets are still valid.`;
}

export type PageState = 'loading' | 'signed_out' | 'error' | 'empty' | 'ready';

export type StateAction = { kind: 'link'; label: string; to: string } | { kind: 'retry'; label: string } | null;

export interface StateCopy {
  title: string;
  body: string;
  action: StateAction;
}

/** Every non-ready state says what the person can do next. */
export function stateCopy(state: Exclude<PageState, 'ready'>, signInHref: string): StateCopy {
  switch (state) {
    case 'loading':
      return { title: `Loading your tickets${ELL}`, body: 'This can take a few seconds on a slow connection.', action: null };
    case 'signed_out':
      return { title: 'Sign in to see your tickets', body: 'Tickets bought while signed in show here with the QR code for the door.', action: { kind: 'link', label: 'Sign in', to: signInHref } };
    case 'error':
      return { title: 'Your tickets could not be loaded', body: 'Check your connection and try again. Your tickets are safe, and the confirmation email has them too.', action: { kind: 'retry', label: 'Try again' } };
    case 'empty':
      return { title: 'No tickets yet', body: 'Tickets you buy while signed in show here, ready to show at the door.', action: { kind: 'link', label: 'Find an event', to: '/' } };
  }
}

/** The QR toggle on a checked-in ticket: collapsed by default, never shown as if usable. */
export function qrVisible(t: MyTicket, shownAnyway: boolean): boolean {
  if (!t.qrToken) return false;
  return !t.checkedIn || shownAnyway;
}

/** Why a ticket has no QR to show: a control that cannot work says so. */
export const QR_MISSING = 'QR code unavailable for this ticket. Show your confirmation email at the door.';
