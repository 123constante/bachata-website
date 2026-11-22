import type { MyTicket } from '@/modules/tickets/myTicketsModel';
import { ticketQrShown, ticketStatusAt } from '@/modules/tickets/ticketCardStatus';

/** Nights ticket QR (brief #1920): which tickets belong to a Going night. Pure; no React. Imported only by the lazy chunk. */
export { NIGHTS_TICKET_QR_ENABLED } from './nightsTicketFlag';

export type TicketNight = { occurrenceId: string; seriesId: string | null; date: string | null; status: string };

/**
 * The tickets that give this night a QR button: a night ticket (same occurrence) or a series-wide
 * ticket dated to this night (the RPC dates it to the next scheduled night). Never matched on title.
 * Only tickets whose QR shows (valid, token present); cancelled nights give none.
 */
export function ticketsForNight(night: TicketNight, tickets: readonly MyTicket[], now: Date = new Date()): MyTicket[] {
  const nightCancelled = night.status === 'cancelled';
  if (nightCancelled) return [];
  return tickets.filter((t) => {
    const belongs =
      t.occurrenceId === night.occurrenceId ||
      (t.occurrenceId === null && t.eventId !== null && t.eventId === night.seriesId && t.date !== null && t.date === night.date);
    if (!belongs || t.qrToken === null) return false;
    return ticketQrShown(
      ticketStatusAt({ date: t.date, eventCancelled: nightCancelled || t.nightCancelled === true, refunded: t.refunded, checkedIn: t.checkedIn }, now),
    );
  });
}

/** occurrenceId -> shown tickets, only for nights that have at least one. */
export function ticketsByNight(nights: readonly (TicketNight & { past: boolean })[], tickets: readonly MyTicket[], now: Date = new Date()): Map<string, MyTicket[]> {
  const out = new Map<string, MyTicket[]>();
  for (const n of nights) {
    if (n.past) continue;
    const t = ticketsForNight(n, tickets, now);
    if (t.length > 0) out.set(n.occurrenceId, t);
  }
  return out;
}
