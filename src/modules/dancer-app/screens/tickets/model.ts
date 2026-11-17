/**
 * The Tickets tab's pure parts (brief option-a-tickets-tab): what the QR card shows, the
 * "What are you?" chips and where each one goes. No React, no I/O: the matrix test reads
 * these directly.
 */
import type { OrderQrTicket } from '@/modules/tickets/myTicketsModel';
import { thanksCopy, type ThanksOrderState } from '@/modules/tickets/ticketCheckoutModel';

/** One ticket in the card: the order QR row, plus what only the full-screen door view shows. */
export type CardTicket = OrderQrTicket & { eventTitle: string | null; eventDate: string | null; eventCancelled?: boolean; refunded?: boolean };

export type CardView =
  | { kind: 'loading' }
  | { kind: 'pending'; free: boolean }
  | { kind: 'processing' }
  | { kind: 'paid_email' }
  | { kind: 'failed'; eventId: string | null; free: boolean }
  | { kind: 'qr_error' }
  | { kind: 'none' }
  | { kind: 'tickets'; tickets: CardTicket[] };

/** The card's words per state. British English, no buyer name or email. */
export const CARD_COPY = {
  loading: 'Getting your tickets\u2026',
  pending: 'Confirming your payment\u2026 This takes a few seconds.',
  pendingFree: 'Getting your free tickets ready\u2026 This takes a few seconds.',
  // The thank-you page's own words (thanksCopy): one copy of what processing and paid-by-email say.
  processing: thanksCopy(false, 'processing').body,
  paidEmail: thanksCopy(false, 'paid').title,
  failed: 'Your payment didn\u2019t go through, so no tickets were issued.',
  failedFree: 'This order didn\u2019t go through, so no tickets were issued.',
  failedLink: 'Back to the event to try again',
  qrError: 'We couldn\u2019t load your door codes just now. Your tickets are in your email.',
  retry: 'Try again',
  none: 'We couldn\u2019t find an order on this device. Your tickets are in your email.',
} as const;

/** The order states the thank-you page already reads (ThanksOrderState), mapped onto the card; paid goes on to the QR read. */
export function orderCardView(state: ThanksOrderState, eventId: string | null, free = false): CardView | 'read_qr' {
  if (state === 'paid') return 'read_qr';
  if (state === 'failed') return { kind: 'failed', eventId, free };
  if (state === 'processing') return { kind: 'processing' };
  if (state === 'none') return { kind: 'none' };
  return { kind: 'pending', free };
}

// The role chips live in ./roleChips (the shell's profile sheet imports them without pulling this module into the dancer-app entry chunk).
export { ROLE_CHIPS, ROLE_SOON, roleTarget, type RoleId } from './roleChips';

// profileIncomplete lives in ./profileIncomplete (the shell imports it without pulling this module into the dancer-app entry chunk).
export { profileIncomplete, type ProfileRead } from './profileIncomplete';
