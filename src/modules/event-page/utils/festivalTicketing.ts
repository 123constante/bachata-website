/**
 * TICKET_FESTIVAL_IN_SITE: the festival page's ticket CTA rule, the same one event pages use
 * (docs/design/ticket-lead-in-site.md). Our Buy leads only while it is buyable now for the
 * festival's night (`live` = the sticky bar's probe said siteBarState `buy`); otherwise the
 * organiser's link, else "Tickets TBA". An ended festival has no ticket CTA at all.
 */
export type FestivalTicketCta = 'none' | 'ours' | 'link' | 'tba';

export interface FestivalTicketingInput {
  publicTicketing: boolean;
  isEnded: boolean;
  isCancelled: boolean;
  lifecycleStatus: string | null;
}

/** May the page offer in-site tickets at all (flag on, festival still bookable)? */
export function festivalInSiteTicketing(i: FestivalTicketingInput): boolean {
  return i.publicTicketing && !i.isEnded && !i.isCancelled && i.lifecycleStatus !== 'paused';
}

export function festivalTicketCta(isEnded: boolean, live: boolean, ticketUrl: string | null): FestivalTicketCta {
  if (isEnded) return 'none';
  if (live) return 'ours';
  return ticketUrl ? 'link' : 'tba';
}

/** The festival's one night for the probe and the buy block: the snapshot's occurrence. */
export function festivalNightId(snapshotOccurrenceId: string | null | undefined, rawOccurrenceId: unknown): string | null {
  if (snapshotOccurrenceId) return snapshotOccurrenceId;
  return typeof rawOccurrenceId === 'string' && rawOccurrenceId ? rawOccurrenceId : null;
}
