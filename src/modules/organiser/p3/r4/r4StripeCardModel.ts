import { hubSteps } from '../tickets/model';
import { canSetUpPayouts, stripeStateOf, type StripeRow } from '@/modules/organiser/tickets/ticketModel';

/** Stripe-for-organisers v2 S2a: the one status card on Home and Tickets (flag stripeNudgeV2). */
export const R4_STRIPE_CARD = {
  notStartedTitle: 'Sell tickets for this night',
  notStartedBody: 'Dancers pay by card. No commission from us.',
  notStartedButton: 'Set up payouts',
  notStartedTitleNoNight: 'Sell tickets',
  waitingTitle: 'Stripe is checking your details. This can take a few minutes.',
  waitingButton: 'Check again',
  halfButton: 'Finish setting up',
} as const;

export interface R4StripeCard {
  kind: 'not_started' | 'half' | 'waiting';
  title: string;
  body: string | null;
  pct: number | null;
  button: string;
}

/** null = render nothing: flag off, role cannot set up payouts, still loading, or already connected. */
export function r4StripeCardOf(i: { flagOn: boolean; role: string | null | undefined; loaded: boolean; hasNight?: boolean; row: StripeRow | null | undefined }): R4StripeCard | null {
  if (!i.flagOn || !i.loaded || !canSetUpPayouts(i.role as Parameters<typeof canSetUpPayouts>[0])) return null;
  const s = stripeStateOf(i.row);
  if (s === 'connected') return null;
  if (s === 'none') return { kind: 'not_started', title: i.hasNight === false ? R4_STRIPE_CARD.notStartedTitleNoNight : R4_STRIPE_CARD.notStartedTitle, body: R4_STRIPE_CARD.notStartedBody, pct: null, button: R4_STRIPE_CARD.notStartedButton };
  if (s === 'waiting') return { kind: 'waiting', title: R4_STRIPE_CARD.waitingTitle, body: null, pct: null, button: R4_STRIPE_CARD.waitingButton };
  // same count the Get paid hub shows: both read hubSteps
  const done = hubSteps(s).filter((x) => x.done).length;
  return { kind: 'half', title: `Nearly there: ${done} of 3 done`, body: null, pct: Math.round((done / 3) * 100), button: R4_STRIPE_CARD.halfButton };
}
