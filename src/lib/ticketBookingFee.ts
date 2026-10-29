/**
 * The booking fee per PAID ticket, in pence: the one client copy, read by the buyer
 * checkout totals, its fee line, the terms of sale and the organiser preview.
 *
 * The server's value is the ticket-checkout edge function's env `TICKET_BOOKING_FEE_PENCE`,
 * and that is what Stripe charges. Owner order 2026-10-29: NO booking fee, so this is 0 and
 * the server env must be set to 0 (leave it unset ONLY once the admin-side default is 0; today
 * an unset env means 50). Changing one without the other shows buyers a total Stripe will not
 * charge (docs/review/ticketing-checkout-1063.md, finding 1).
 *
 * At 0 every screen hides the fee line and the fee wording; a later non-zero value brings them
 * back (bookingFee.shared.test.tsx proves it at 75p), but the terms-of-sale fee wording then
 * needs fresh owner approval (legalCopy.ts).
 */
export const BOOKING_FEE_PENCE = 0;
