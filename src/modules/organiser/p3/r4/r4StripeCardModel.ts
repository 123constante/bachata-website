import { canSetUpPayouts, stripeStateOf, type StripeRow } from '@/modules/organiser/tickets/ticketModel';

/** Stripe-for-organisers v2 S2a: the one status card on Home and Tickets (flag stripeNudgeV2). */
export const R4_STRIPE_CARD = {
  notStartedTitle: 'Sell tickets for this night',
  notStartedBody: 'Dancers pay by card. No commission from us.',
  notStartedButton: 'Set up payouts',
  halfTitle: 'Nearly there: 2 of 3 done',
  halfPct: 66,
  halfButton: 'Finish setting up',
} as const;

export interface R4StripeCard {
  kind: 'not_started' | 'half';
  title: string;
  body: string | null;
  pct: number | null;
  button: string;
}

/** null = render nothing: flag off, role cannot set up payouts, still loading, or already connected. */
export function r4StripeCardOf(i: { flagOn: boolean; role: string | null | undefined; loaded: boolean; row: StripeRow | null | undefined }): R4StripeCard | null {
  if (!i.flagOn || !i.loaded || !canSetUpPayouts(i.role as Parameters<typeof canSetUpPayouts>[0])) return null;
  const s = stripeStateOf(i.row);
  if (s === 'connected') return null;
  if (s === 'none') return { kind: 'not_started', title: R4_STRIPE_CARD.notStartedTitle, body: R4_STRIPE_CARD.notStartedBody, pct: null, button: R4_STRIPE_CARD.notStartedButton };
  return { kind: 'half', title: R4_STRIPE_CARD.halfTitle, body: null, pct: R4_STRIPE_CARD.halfPct, button: R4_STRIPE_CARD.halfButton };
}
