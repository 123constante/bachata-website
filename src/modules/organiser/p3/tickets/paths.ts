import { P3_PATHS } from '../shell/paths';

/** The P3 ticketing URLs (flag organiserTicketing). Get paid lives under You. */
export const P3_TICKET_PATHS = {
  getPaid: (organiserId?: string | null) =>
    organiserId ? `${P3_PATHS.you}/get-paid?o=${encodeURIComponent(organiserId)}` : `${P3_PATHS.you}/get-paid`,
  /** Where Stripe sends the person back: `stripe=return` when finished, `stripe=refresh` when the link ran out. */
  stripeBack: (origin: string, organiserId: string, kind: 'return' | 'refresh', from?: 'start') =>
    `${origin}${from === 'start' ? GET_PAID_START : `${P3_PATHS.you}/get-paid`}?o=${encodeURIComponent(organiserId)}&stripe=${kind}`,
} as const;

/** The single Get paid screen (own frame, no tab bar). Part B writes this same literal; do not import across. */
export const GET_PAID_START = '/account/p3/get-paid';
export const getPaidStartPath = (organiserId: string): string => `${GET_PAID_START}?o=${encodeURIComponent(organiserId)}`;
/** The link an organiser who already has a login gets on WhatsApp: sign in, then land on the start screen. */
export const getPaidSignInLink = (origin: string, organiserId: string): string =>
  `${origin}/auth?mode=signin&returnTo=${encodeURIComponent(getPaidStartPath(organiserId))}`;
