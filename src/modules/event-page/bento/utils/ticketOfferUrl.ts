/**
 * TICKET_LEAD_IN_SITE: the URL a JSON-LD offer points at. Ours (the event page) while our Buy
 * is live for the night; the organiser's link otherwise (may be null).
 */
export function ticketOfferUrl(live: boolean, pageUrl: string, organiserUrl: string | null | undefined): string | null {
  return live ? pageUrl : organiserUrl ?? null;
}
