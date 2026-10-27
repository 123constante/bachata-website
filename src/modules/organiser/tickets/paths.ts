/**
 * Every URL in the organiser ticketing area (flag organiserTicketing). Its own base,
 * like P3, so nothing in the organiser area changes while the flag is off.
 */
export const TICKETS_BASE = '/account/tickets';

const withPage = (path: string, organiserId: string | null | undefined) =>
  organiserId ? `${path}?o=${encodeURIComponent(organiserId)}` : path;

export const TICKET_PATHS = {
  home: (organiserId?: string | null) => withPage(TICKETS_BASE, organiserId),
  event: (seriesId: string, organiserId?: string | null) =>
    withPage(`${TICKETS_BASE}/events/${encodeURIComponent(seriesId)}`, organiserId),
  /** Where Stripe sends the person back: `stripe=return` when finished, `stripe=refresh` when the link expired. */
  stripeBack: (origin: string, organiserId: string, kind: 'return' | 'refresh') =>
    `${origin}${TICKETS_BASE}?o=${encodeURIComponent(organiserId)}&stripe=${kind}`,
} as const;
