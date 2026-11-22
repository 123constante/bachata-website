import { ownerPassesFromStored } from '../../shared/seriesCommands';
import type { TicketStatus } from '../../tickets/ticketModel';

export type PayMode = 'here' | 'door' | 'link';

/**
 * How dancers pay (Tickets screen). Any live (on sale) ticket type = 'here'; else a ticket link = 'link'; else
 * 'door'. Paused, draft, sold-out and closed types do not count. `stripeConnected` is carried for the callers
 * that show the not-connected state; it never changes the mode. Pure.
 */
export function payModeOf(i: {
  ticketTypes: readonly { status: TicketStatus | string }[];
  defaultTicketUrl?: string | null;
  stripeConnected?: boolean | null;
}): PayMode {
  if (i.ticketTypes.some((t) => t.status === 'on_sale')) return 'here';
  if (i.defaultTicketUrl && i.defaultTicketUrl.trim()) return 'link';
  return 'door';
}

/** The usual door price: the first price-list entry's price (the same list Facts' priceLabel reads); null when none. */
export function doorPriceOf(passes: unknown): number | null {
  const first = (ownerPassesFromStored(passes) ?? [])[0];
  return first && typeof first.price === 'number' ? first.price : null;
}
