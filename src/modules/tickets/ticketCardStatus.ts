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

export type TicketStatus = 'valid' | 'passed' | 'event_cancelled' | 'refunded';

export interface TicketStatusInput {
  /** "YYYY-MM-DD" of the night, or null (series-wide ticket, date to be confirmed). */
  date: string | null;
  eventCancelled?: boolean;
  refunded?: boolean;
}

export const TICKET_STATUS_COPY: Record<Exclude<TicketStatus, 'valid'>, string> = {
  passed: 'This night has passed',
  event_cancelled: 'This night was cancelled',
  refunded: 'This ticket was refunded',
};

export function ticketStatus(t: TicketStatusInput, todayKey: string): TicketStatus {
  if (t.refunded) return 'refunded';
  if (t.eventCancelled) return 'event_cancelled';
  if (t.date !== null && t.date < todayKey) return 'passed';
  return 'valid';
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

/** The plain reason in the QR's place; null for a valid ticket. */
export const ticketStatusLine = (s: TicketStatus): string | null => (s === 'valid' ? null : TICKET_STATUS_COPY[s]);
