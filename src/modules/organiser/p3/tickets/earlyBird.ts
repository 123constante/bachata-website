import type { ManagedType } from '../../tickets/priceSteps';
import { formatPence } from '../../tickets/ticketModel';

/*
 * Early bird on the organiser Tickets list (brief #2297). OFF = the list is exactly as before.
 * Turn on with VITE_ENABLE_TICKET_EARLY_BIRD=true (Vercel env) -- no code change.
 * Fields come from ticket_types_manage_v1; absent fields = no early tier.
 */
export const ticketEarlyBird = import.meta.env.VITE_ENABLE_TICKET_EARLY_BIRD === 'true';

export interface EarlyBirdView {
  /** The pill after the ticket name, e.g. "Early bird 4 left". */
  pill: string;
  /** The price part of the line, e.g. "£8 now, £15 after" (whole pounds drop .00, as formatPence). */
  price: string;
}

/** null = row exactly as today (flag off, no tier, or the early tier sold out / closed). */
export function earlyBirdOf(m: ManagedType | undefined, flag: boolean = ticketEarlyBird): EarlyBirdView | null {
  if (!flag || !m) return null;
  const { earlyPricePence: e, earlyLeft: left, earlyOpen: open, regularPricePence: r } = m;
  if (e == null || r == null || left == null || open !== true || left <= 0) return null;
  return { pill: `Early bird ${left} left`, price: `${formatPence(e)} now, ${formatPence(r)} after` };
}
