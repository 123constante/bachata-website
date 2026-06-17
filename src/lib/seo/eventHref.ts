/**
 * Internal URL for an event-detail page.
 *
 * Prefers the slug (added to the calendar / map RPCs in SEO plan 1.2); falls
 * back to the event UUID so this is deploy-order-safe. `occurrenceId` is
 * appended so the correct occurrence opens on tap / open-in-new-tab; the bot
 * middleware canonicalises the slug URL (query stripped) for crawl equity.
 */
export function eventHref(
  event: { slug?: string | null; event_id: string },
  occurrenceId?: string | null,
): string {
  const base = `/event/${event.slug || event.event_id}`;
  return occurrenceId ? `${base}?occurrenceId=${occurrenceId}` : base;
}
