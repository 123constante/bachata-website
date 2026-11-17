import { createContext, useContext } from 'react';
import { TEASER_PATHS } from '../screens/teaser/teaserGate';

/**
 * Option A (brief option-a-tickets-tab): the ONE exception to "not allowed -> /account".
 * A signed-in person the dancer-area gate does not admit may still open /app/tickets -- their
 * own door QRs, read by my_ticket_order_qr_v1 / my_tickets_v1, which check the buyer
 * server-side -- and nothing else. Every other /app path still redirects, and the shell
 * draws the other tabs locked (they open the profile sheet, never the screen), so no
 * screen that reads or writes a member RPC is ever reached this way.
 */
export const VIEW_ONLY_PATHS: readonly string[] = ['/app/tickets'];

/** True when the gate may admit a not-allowed person to this path, view-only. Case- and slash-folded. */
export const admitsViewOnly = (pathname: string, ticketingOn: boolean, teaserOn = false): boolean => {
  if (!ticketingOn) return false;
  const p = pathname.toLowerCase().replace(/\/+$/, '');
  // The post-pay teaser (TICKET_TEASER_ENABLED) adds the four tabs: their read-only twins call no member RPC.
  // /app/welcome too, teaser on only: the lock sheet's Continue must reach the existing onboarding.
  return VIEW_ONLY_PATHS.includes(p) || (teaserOn && (TEASER_PATHS.includes(p) || p === '/app/welcome'));
};

/** Set by DancerAreaGate: true when this person is here only through admitsViewOnly. */
export const ViewOnlyContext = createContext(false);

export const useViewOnly = (): boolean => useContext(ViewOnlyContext);
