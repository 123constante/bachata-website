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
import { eventHref } from '@/lib/seo/eventHref';

export interface BuildEventListJsonLdInput {
  events: CalendarEventRow[];
  /** Absolute origin, e.g. 'https://bachatacalendar.co.uk'. */
  origin: string;
  /** Cap the number of events emitted to keep the payload sane. */
  limit?: number;
}

// City slugs are stored as `<city>-<country>` (e.g. `london-gb`). Strip the
// 2-letter country suffix before turning the rest into a Title Case display
// name so Schema.org's addressLocality reads like "London" not "London gb".
const slugToLocality = (slug: string): string => {
  if (!slug) return slug;
  const withoutCountry = slug.replace(/-[a-z]{2}$/i, '');
  return withoutCountry
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

export const buildEventListJsonLd = ({
  events,
  origin,
  limit = 25,
}: BuildEventListJsonLdInput): Record<string, unknown> => {
  const itemListElement = events.slice(0, limit).map((e, i) => {
    const eventUrl = `${origin}${eventHref(e)}`;
    const locality = e.city_slug ? slugToLocality(e.city_slug) : 'London';
    const description: string =
      (e.meta_data as Record<string, unknown>)?.description as string ||
      `${e.name} — Bachata event in ${locality}`;

    const event: Record<string, unknown> = {
      '@type': 'Event',
      name: e.name,
      startDate: e.start_time,
      url: eventUrl,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      description,
      organizer: {
        '@type': 'Organization',
        name: 'Bachata Calendar',
        url: origin,
      },
      performer: { '@type': 'PerformingGroup', name: 'Bachata Artists' },
      offers: {
        '@type': 'Offer',
        url: eventUrl,
        availability: 'https://schema.org/InStock',
      },
    };

    if (e.end_time) event.endDate = e.end_time;
    if (Array.isArray(e.photo_url) && e.photo_url.length > 0) {
      event.image = [e.photo_url[0]];
    }
    event.location = {
      '@type': 'Place',
      name: e.location || locality,
      address: {
        '@type': 'PostalAddress',
        addressLocality: locality,
        addressCountry: 'GB',
      },
    };

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
