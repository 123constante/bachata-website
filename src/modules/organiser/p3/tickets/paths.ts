import { P3_PATHS } from '../shell/paths';

/** The P3 ticketing URLs (flag organiserTicketing). Get paid lives under You. */
export const P3_TICKET_PATHS = {
  getPaid: (organiserId?: string | null) =>
    organiserId ? `${P3_PATHS.you}/get-paid?o=${encodeURIComponent(organiserId)}` : `${P3_PATHS.you}/get-paid`,
  /** Where Stripe sends the person back: `stripe=return` when finished, `stripe=refresh` when the link ran out. */
  stripeBack: (origin: string, organiserId: string, kind: 'return' | 'refresh') =>
    `${origin}${P3_PATHS.you}/get-paid?o=${encodeURIComponent(organiserId)}&stripe=${kind}`,
} as const;
