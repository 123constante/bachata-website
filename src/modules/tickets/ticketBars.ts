import { availability, type PublicTicketType } from './ticketCheckoutModel';

/** Quiet bottom bar for a night nobody can buy for (mockups-7 section 1). Pure. */
export interface QuietBar { title: string; sub: string; button: string }

export function quietBar(list: readonly PublicTicketType[], now: Date): QuietBar | null {
  const kinds = list.map((t) => availability(t, now).kind);
  if (kinds.includes('buyable')) return null;
  if (kinds.length === 0) {
    return { title: 'Tickets unavailable', sub: 'Check back later or contact the organiser.', button: 'Unavailable' };
  }
  if (kinds.includes('not_yet')) {
    return { title: 'Tickets not on sale yet', sub: 'Check the ticket rows for the opening time.', button: 'Not yet' };
  }
  if (kinds.every((k) => k === 'sold_out')) {
    return { title: 'Sold out', sub: 'Every ticket for this night has gone.', button: 'Sold out' };
  }
  return { title: 'Sales closed', sub: 'Ticket sales for this night have ended.', button: 'Closed' };
}

/** Summary line under the total on the amber bar, e.g. "2 × Early bird". */
export function barSummary(qty: number, name: string, free: boolean): string {
  return free && qty === 1 ? '1 ticket' : `${qty} × ${name}`;
}
