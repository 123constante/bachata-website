/**
 * TICKET_LEAD_IN_SITE: the URL a JSON-LD offer points at. Ours (the event page) while our Buy
 * is live for the night; the organiser's link otherwise (may be null).
 */
export function ticketOfferUrl(live: boolean, pageUrl: string, organiserUrl: string | null | undefined): string | null {
  return live ? pageUrl : organiserUrl ?? null;
}

export interface OrganiserTicketRow { name: string; price: string | null; currency?: string | null }
export interface JsonLdOfferInput { url: string | null; name: string; price: string | null; currency: string | null }

/**
 * The JSON-LD offers for an event page. Live in-site: ours leads. With organiser rows on file
 * they are kept (our url, one offer per row, no duplicates); with none (a pure in-site event)
 * the buyable in-site types stand in, priced from the wire. Not live: the organiser's rows
 * with her link, or nothing. Our url is only ever emitted while live.
 */
export function buildJsonLdOffers(
  live: boolean,
  pageUrl: string,
  organiserUrl: string | null | undefined,
  rows: OrganiserTicketRow[],
  liveTypes: Array<{ name: string; price: string }>,
): JsonLdOfferInput[] {
  if (live && rows.length === 0) {
    return liveTypes.map((t) => ({ url: pageUrl, name: t.name, price: t.price, currency: 'GBP' }));
  }
  return rows.map((t) => ({
    url: ticketOfferUrl(live, pageUrl, organiserUrl),
    name: t.name,
    price: t.price,
    // Never a currency without a price (Google flags the pair);
    // default GBP when a price exists but the row has none.
    currency: t.price ? (t.currency ?? 'GBP') : null,
  }));
}
