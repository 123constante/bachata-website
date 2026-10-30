import { P3_PATHS } from '../p3/shell/paths';
import { P3_TICKET_PATHS } from '../p3/tickets/paths';

/** The retired organiser ticketing area (T6). Only its redirect still answers here. */
export const LEGACY_TICKETS_BASE = '/account/tickets';

/**
 * Where an old /account/tickets URL goes now. Stripe links the old screens minted come back
 * as `?o=<page>&stripe=return|refresh`; they land on P3's Get paid with the same params, so an
 * organiser mid-onboarding never meets a dead end. An old event screen goes to P3's event page
 * (its Tickets row); anything else goes to Get paid, keeping the page. Pure.
 */
export const legacyTicketsTarget = (pathname: string, search: string): string => {
  const rest = pathname.slice(LEGACY_TICKETS_BASE.length).replace(/\/+$/, '');
  const event = /^\/events\/([^/]+)$/.exec(rest);
  if (event) return P3_PATHS.event(decodeSafe(event[1]));
  const params = new URLSearchParams(search);
  const page = params.get('o');
  const stripe = params.get('stripe');
  if (page && (stripe === 'return' || stripe === 'refresh')) return P3_TICKET_PATHS.stripeBack('', page, stripe);
  return P3_TICKET_PATHS.getPaid(page);
};

/** A malformed %-escape in a pasted URL must not crash the redirect. */
const decodeSafe = (part: string): string => {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
};
