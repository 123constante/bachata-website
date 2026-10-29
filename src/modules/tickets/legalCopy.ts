/**
 * APPROVED by the owner 2026-10-27 (50p fee, refund, 14-day and privacy wording). Terms of sale
 * and the ticket privacy paragraph for buyer checkout (S4). Any wording change needs a fresh
 * owner approval. Plain English, UK.
 * 2026-10-29 owner order "remove the 50p booking fee": while BOOKING_FEE_PENCE is 0 the fee
 * sentence is left out and the refund sentence names no fee (owner to confirm the result). The
 * approved 50p-era wording stays below so a non-zero fee does not silently sell without terms.
 * Edit the words here only: the block and its tests read this one file.
 */
import { BOOKING_FEE_LABEL, BOOKING_FEE_PENCE } from './ticketCheckoutModel';

const HAS_FEE = BOOKING_FEE_PENCE > 0;

export const LEGAL_COPY_STATUS = 'APPROVED' as const;

export const TERMS_CHECKBOX_LABEL = 'I accept the terms of sale and understand how my details are used.';

export const TERMS_OF_SALE: readonly string[] = [
  'You are buying tickets from the event organiser. Bachata Calendar runs the booking page; the organiser runs the event and is responsible for it.',
  'Payment is taken by Stripe and goes straight to the organiser. We never see or store your card details.',
  // The fee amount is the shared constant (approved at 50p); the words around it are unchanged.
  ...(HAS_FEE
    ? [`Paid tickets carry a booking fee of ${BOOKING_FEE_LABEL} per ticket. This fee is ours and pays for running the ticketing service. Free tickets have no fee.`]
    : []),
  'Your tickets are emailed to the address you give, each with a code to show at the door. Tickets are only issued once payment is confirmed.',
  HAS_FEE
    ? 'Refunds are up to the organiser. If the organiser gives you a full refund, the booking fee is refunded too. If the event is cancelled, contact the organiser.'
    : 'Refunds are up to the organiser. If the event is cancelled, contact the organiser.',
  'You can buy up to 20 tickets in one order. Prices are in pounds sterling (GBP).',
  'Your statutory rights under UK consumer law are not affected. Note that the 14-day cancellation right does not apply to tickets for events on a set date.',
];

export const PRIVACY_PARAGRAPH =
  'To issue your tickets we store your name (if you give it), your email address and your order (ticket type, number of tickets, amount paid and its status). ' +
  'We share these with the event organiser so they can check you in and contact you about the event, and with Stripe to take payment. ' +
  'We use your email only for your tickets and messages about this order, never for marketing.';

/** The last sentence of the privacy paragraph; the block renders `linkText` as a link to `path`. */
export const PRIVACY_POLICY_LINE = {
  lead: 'See our',
  linkText: 'privacy policy',
  path: '/privacy',
  tail: 'for how long we keep data and how to ask us to delete it.',
} as const;
