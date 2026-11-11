/**
 * TICKET_FESTIVAL_IN_SITE: the festival page's ticket CTA rule, the same one event pages use
 * (docs/design/ticket-lead-in-site.md). Our Buy leads only while it is buyable now for the
 * festival's night (`live` = the sticky bar's probe said siteBarState `buy`); otherwise the
 * organiser's link, else "Tickets TBA". An ended festival has no ticket CTA at all.
 */
export type FestivalTicketCta = 'none' | 'ours' | 'link' | 'tba' | 'pending';

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

/**
 * `pending` = in-site ticketing is possible and the probe has not answered for the night yet.
 * In that window the organiser's link is shown nowhere (the sticky bar already holds a
 * placeholder): her link would otherwise flash, then vanish when our Buy goes live. Once the
 * probe answers (quiet, no types, failed, timed out) her link returns.
 */
export function festivalTicketCta(isEnded: boolean, live: boolean, ticketUrl: string | null, pending = false): FestivalTicketCta {
  if (isEnded) return 'none';
  if (live) return 'ours';
  if (!ticketUrl) return 'tba';
  return pending ? 'pending' : 'link';
}

export interface FestivalPassRow { name: string; price: number | string | null; currency?: string | null }
export interface FestivalOffer { url: string | null; name: string; price: number | string | null; currency: string }

/**
 * JSON-LD offers for a festival. Live in-site: the url is our page, whose checkout sells the
 * LIVE ticket types at THEIR prices, so the offers are those types (name, price, GBP), never the
 * organiser's `passes` (a different list with different prices). Not live: her passes with her
 * link (unchanged). Our url is only ever emitted while live.
 */
export function festivalJsonLdOffers(
  live: boolean,
  pageUrl: string,
  organiserUrl: string | null,
  passes: FestivalPassRow[],
  liveTypes: Array<{ name: string; price: string }>,
): FestivalOffer[] {
  if (live) return liveTypes.map((t) => ({ url: pageUrl, name: t.name, price: t.price, currency: 'GBP' }));
  return passes.map((p) => ({ url: organiserUrl, name: p.name, price: p.price, currency: p.currency ?? 'GBP' }));
}

/** The festival's one night for the probe and the buy block: the snapshot's occurrence. */
export function festivalNightId(snapshotOccurrenceId: string | null | undefined, rawOccurrenceId: unknown): string | null {
  if (snapshotOccurrenceId) return snapshotOccurrenceId;
  return typeof rawOccurrenceId === 'string' && rawOccurrenceId ? rawOccurrenceId : null;
}
