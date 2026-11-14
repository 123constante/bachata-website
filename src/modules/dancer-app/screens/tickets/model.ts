/**
 * The Tickets tab's pure parts (brief option-a-tickets-tab): what the QR card shows, the
 * "What are you?" chips and where each one goes. No React, no I/O: the matrix test reads
 * these directly.
 */
import type { OrderQrTicket } from '@/modules/tickets/myTicketsModel';
import type { ThanksOrderState } from '@/modules/tickets/ticketCheckoutModel';

/** One ticket in the card: the order QR row, plus what only the full-screen door view shows. */
export type CardTicket = OrderQrTicket & { eventTitle: string | null; eventDate: string | null };

export type CardView =
  | { kind: 'loading' }
  | { kind: 'pending' }
  | { kind: 'processing' }
  | { kind: 'failed'; eventId: string | null }
  | { kind: 'qr_error' }
  | { kind: 'none' }
  | { kind: 'tickets'; tickets: CardTicket[] };

/** The card's words per state. British English, no buyer name or email. */
export const CARD_COPY = {
  loading: 'Getting your tickets\u2026',
  pending: 'Confirming your payment\u2026 This takes a few seconds.',
  processing: 'Your order is still processing. Your tickets will arrive by email in a few minutes.',
  failed: 'Your payment didn\u2019t go through, so no tickets were issued.',
  failedLink: 'Back to the event to try again',
  qrError: 'We couldn\u2019t load your door codes just now. Your tickets are in your email.',
  retry: 'Try again',
  none: 'We couldn\u2019t find an order on this device. Your tickets are in your email.',
} as const;

/** The order states the thank-you page already reads (ThanksOrderState), mapped onto the card; paid goes on to the QR read. */
export function orderCardView(state: ThanksOrderState, eventId: string | null): CardView | 'read_qr' {
  if (state === 'paid') return 'read_qr';
  if (state === 'failed') return { kind: 'failed', eventId };
  if (state === 'processing') return { kind: 'processing' };
  if (state === 'none') return { kind: 'none' };
  return { kind: 'pending' };
}

/** "Ticket k of N" for ALL N (no cap). */
export const ticketCountLine = (index: number, total: number): string => `Ticket ${index + 1} of ${total}`;

/** Wraps around both ways, so N tickets give N positions. */
export const stepTicket = (index: number, delta: number, total: number): number => (total <= 0 ? 0 : (index + delta + total) % total);

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "YYYY-MM-DD" -> "Saturday 21 November 2026" (full weekday); any other text is shown as the server gave it. */
export function doorDate(date: string | null): string | null {
  if (!date) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export type RoleId = 'dancer' | 'dj' | 'teacher' | 'organiser' | 'videographer' | 'venue';

export const ROLE_CHIPS: readonly { id: RoleId; label: string }[] = [
  { id: 'dancer', label: 'Dancer' },
  { id: 'dj', label: 'DJ' },
  { id: 'teacher', label: 'Teacher' },
  { id: 'organiser', label: 'Organiser' },
  { id: 'videographer', label: 'Videographer' },
  { id: 'venue', label: 'Venue' },
];

/** Shown under the chips for a role with no flow to hand off to today. */
export const ROLE_SOON = 'is coming soon. We will add it here as soon as it opens.';

/**
 * Where a chip hands off: the EXISTING flows, never a copy of them. A chip is a link, so an
 * untouched sheet sends nothing. null = parked ("coming soon"). Dancer is parked for a person
 * the dancer-area gate does not admit (view-only): /app/welcome would only bounce them to
 * /account.
 */
export function roleTarget(role: RoleId, opts: { viewOnly: boolean; welcomeHref: string; organiserHref: string; teacherHref: string; djHref: string }): string | null {
  switch (role) {
    case 'dancer':
      return opts.viewOnly ? null : opts.welcomeHref;
    case 'organiser':
      return opts.organiserHref;
    case 'teacher':
      return opts.teacherHref;
    case 'dj':
      return opts.djHref;
    default:
      return null;
  }
}

/**
 * The bar and the locks show for an unfinished profile: view-only, no dancer profile
 * (my_dancer_edit_v1 says no_profile), or required steps not done. Not read yet, or a read
 * that failed for any other reason (offline), = not shown: a finished dancer is never locked
 * out by a network blip, and nothing flashes.
 */
export type ProfileRead = { status: 'pending' | 'error' | 'no_profile' | 'success'; requiredDone: boolean };

export function profileIncomplete(viewOnly: boolean, read: ProfileRead): boolean {
  if (viewOnly) return true;
  if (read.status === 'no_profile') return true;
  if (read.status !== 'success') return false;
  return !read.requiredDone;
}
