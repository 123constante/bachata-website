/**
 * ONE status mapping for every screen that shows a ticket (owner clicks 2026-11-17, brief
 * onboard-a slice A): a refunded order voids the QR; a cancelled night hides it; a passed night
 * is greyed with the QR hidden. Order of precedence: refunded, cancelled, passed.
 *
 * Today's reads (my_tickets_v1, my_ticket_order_qr_v1) return paid orders and non-void tickets
 * only, with no night lifecycle, so from live data only 'passed' can fire; the other two inputs
 * default to false and the screens already draw them the moment a read sends them.
 */
import { addDaysToKey, londonDateKey, londonMinutesOfDay } from '@/lib/londonDate';
import { ROLLOVER_HOUR } from '@/lib/programDayRollover';
import { formatPence } from './ticketCheckoutModel';

/*
 * P2 website slice (owner clicks 2026-11-18): my_tickets_v1 now sends `refunded` (whole order refunded,
 * QR and code NULL) and `order_refunded_pence` (> 0 on a paid order and not refunded = money-only part
 * refund, QR kept). A checked-in ticket is 'used': greyed, 'Used' tag, QR hidden. Precedence:
 * refunded, cancelled, passed, used.
 */
export type TicketStatus = 'valid' | 'used' | 'passed' | 'event_cancelled' | 'refunded';

export interface TicketStatusInput {
  /** "YYYY-MM-DD" of the night, or null (series-wide ticket, date to be confirmed). */
  date: string | null;
  eventCancelled?: boolean;
  refunded?: boolean;
  checkedIn?: boolean;
}

export const TICKET_STATUS_COPY: Record<Exclude<TicketStatus, 'valid'>, string> = {
  used: 'Already used at the door',
  passed: 'This night has passed',
  event_cancelled: 'This night was cancelled',
  refunded: 'This ticket was refunded',
};

export function ticketStatus(t: TicketStatusInput, todayKey: string): TicketStatus {
  if (t.refunded) return 'refunded';
  if (t.eventCancelled) return 'event_cancelled';
  if (t.date !== null && t.date < todayKey) return 'passed';
  if (t.checkedIn) return 'used';
  return 'valid';
}

/** Never promise a refund on a cancelled night (owner click 4). */
export const CANCELLED_REFUND_LINE = 'The organiser will be in touch about refunds';
export const REFUND_TIMING = 'usually 5 to 10 working days to reach your card';

/** The tag at the top of a greyed card; null = no status tag. */
export const ticketStatusTag = (s: TicketStatus): string | null => (s === 'refunded' ? 'Refunded' : s === 'used' ? 'Used' : null);

/** Greyed card: every status but valid. */
export const ticketGreyed = (s: TicketStatus): boolean => s !== 'valid';

/**
 * Every line in the QR's place, in order; [] for a valid ticket. Refunded: ONE line, amount (the
 * order's refunded pence) + the timing; no amount known = the plain refunded line.
 */
export function ticketStatusLines(s: TicketStatus, refundedPence = 0): string[] {
  if (s === 'valid') return [];
  if (s === 'refunded') return [refundedPence > 0 ? `${formatPence(refundedPence)} refunded, ${REFUND_TIMING}` : TICKET_STATUS_COPY.refunded];
  if (s === 'event_cancelled') return [TICKET_STATUS_COPY.event_cancelled, CANCELLED_REFUND_LINE];
  return [TICKET_STATUS_COPY[s]];
}

/** Money-only part refund (order not fully refunded, pence > 0): one quiet line; null otherwise. */
export const partRefundLine = (refunded: boolean | undefined, refundedPence: number | undefined): string | null =>
  !refunded && refundedPence && refundedPence > 0 ? `Part refunded ${formatPence(refundedPence)}` : null;

/**
 * The list order (owner click 6): nights that passed drop off (refunded and cancelled too), then
 * the soonest night first with date-to-be-confirmed after the dated ones, greyed cards at the bottom.
 * Stable: equal keys keep the server order.
 */
export function orderTicketList<T>(tickets: T[], status: (t: T) => TicketStatus, date: (t: T) => string | null, nightKey: string): T[] {
  const live = tickets.filter((t) => { const d = date(t); return d === null || d >= nightKey; });
  const key = (t: T) => date(t) ?? '9999-99-99';
  return live
    .map((t, i) => ({ t, i, g: ticketGreyed(status(t)) ? 1 : 0, k: key(t) }))
    .sort((a, b) => a.g - b.g || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0) || a.i - b.i)
    .map((x) => x.t);
}

/**
 * The night a ticket compares against at `now`: London today, but 00:00 to 08:00 still belongs to
 * the night before (the after-midnight rule, src/lib/programDayRollover.ts), so a ticket stays valid
 * until the night is really over (late arrival, re-entry, a ticket bought at 23:50).
 */
export function ticketNightKey(now: Date = new Date()): string {
  const key = londonDateKey(now);
  return londonMinutesOfDay(now) < ROLLOVER_HOUR * 60 ? addDaysToKey(key, -1) : key;
}

/** The status at `now` (the after-midnight rule applied): what every screen calls. */
export const ticketStatusAt = (t: TicketStatusInput, now: Date = new Date()): TicketStatus => ticketStatus(t, ticketNightKey(now));

/** The QR (and the door code, which opens the same door) shows only for a valid ticket. */
export const ticketQrShown = (s: TicketStatus): boolean => s === 'valid';

/** The plain reason in the QR's place (first line only); null for a valid ticket. */
export const ticketStatusLine = (s: TicketStatus): string | null => (s === 'valid' ? null : TICKET_STATUS_COPY[s]);
