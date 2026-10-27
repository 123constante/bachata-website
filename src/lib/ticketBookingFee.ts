/**
 * The booking fee per PAID ticket, in pence: the one client copy, read by the buyer
 * checkout totals, its fee line, the terms of sale and the organiser preview.
 *
 * The server's value is the ticket-checkout edge function's env `TICKET_BOOKING_FEE_PENCE`
 * (default 50 when unset), and that is what Stripe charges. Keep the env UNSET (or 50)
 * while this says 50; changing one without the other shows buyers a total Stripe will
 * not charge (docs/review/ticketing-checkout-1063.md, finding 1).
 */
export const BOOKING_FEE_PENCE = 50;
