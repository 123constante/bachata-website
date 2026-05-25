/**
 * buildEventListJsonLd - Schema.org ItemList of Event nodes for the home
 * page's "this week" list. Emitted as an inline <script> so search engines
 * can surface event rich results. Mirrors buildVenueJsonLd's "optional fields
 * just drop out" approach: any missing value is omitted, never null.
 *
 * Per the SEO master plan: JSON-LD across key surfaces. The home page is the
 * highest-traffic surface, so an ItemList of upcoming Events is the biggest
 * rich-result lever here.
 */
import type { CalendarEventRow } from '@/integrations/supabase/eventRpcs';

export interface BuildEventListJsonLdInput {
  events: CalendarEventRow[];
  /** Absolute origin, e.g. 'https://bachatacalendar.co.uk'. */
  origin: string;
  /** Cap the number of events emitted to keep the payload sane. */
  limit?: number;
}

export const buildEventListJsonLd = ({
  events,
  origin,
  limit = 25,
}: BuildEventListJsonLdInput): Record<string, unknown> => {
  const itemListElement = events.slice(0, limit).map((e, i) => {
    const event: Record<string, unknown> = {
      '@type': 'Event',
      name: e.name,
      startDate: e.start_time,
      url: `${origin}/event/${e.event_id}`,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    };
    if (e.end_time) event.endDate = e.end_time;
    if (Array.isArray(e.photo_url) && e.photo_url.length > 0) {
      event.image = [e.photo_url[0]];
    }
    if (e.location) {
      event.location = { '@type': 'Place', name: e.location };
    }
    return {
      '@type': 'ListItem',
      position: i + 1,
      item: event,
    };
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement,
  };
};

/** Stringify the payload for a <script type="application/ld+json"> tag. */
export const renderEventListJsonLd = (input: BuildEventListJsonLdInput): string =>
  JSON.stringify(buildEventListJsonLd(input));
