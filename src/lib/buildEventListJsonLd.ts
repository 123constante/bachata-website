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
import { type WallClock, wallClockToInstant } from '@/lib/time/wallClock';

// The stored clock is local-as-UTC; converting with Europe/London yields the
// true instant Google needs (a raw stamp is +1h in BST AND invalid ISO 8601 --
// space separator). occurrence_starts_at / occurrence_ends_at already carry the
// correct per-row date -- incl. the next day for a cross-midnight party and the
// last day of a multi-day festival -- so we convert them directly. (Composing
// from instance_date + time-of-day, as an earlier revision did, put a
// cross-midnight endDate BEFORE its startDate on ~26% of rows.)
const LONDON = 'Europe/London';
const toInstantIso = (wc: WallClock | null): string | null =>
  wallClockToInstant(wc, LONDON)?.toISOString() ?? null;

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
  const itemListElement: Array<Record<string, unknown>> = [];
  for (const e of events) {
    if (itemListElement.length >= limit) break;

    // PHASE-Q GATE: city_timezone is asEventTimeZone-normalised at the codec
    // ('UTC' -> null -> London-safe). Only London rows get a converted instant;
    // non-London (Tunis/Madrid) rows are held out until the convention is verified.
    const tz = e.city_timezone;
    if (tz != null && tz !== 'Europe/London') continue;

    // A valid schema.org Event needs a startDate; skip rows we can't convert.
    const startDate = toInstantIso(e.occurrence_starts_at);
    if (!startDate) continue;

    const eventUrl = `${origin}${eventHref(e)}`;
    const locality = e.city_slug ? slugToLocality(e.city_slug) : 'London';
    const description: string =
      ((e.meta_data as unknown as { description?: string } | null)?.description) ||
      `${e.name} — Bachata event in ${locality}`;

    const event: Record<string, unknown> = {
      '@type': 'Event',
      name: e.name,
      startDate,
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

    const endDate = toInstantIso(e.occurrence_ends_at);
    if (endDate) event.endDate = endDate;
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

    itemListElement.push({
      '@type': 'ListItem',
      position: itemListElement.length + 1,
      item: event,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement,
  };
};

/**
 * Stringify the payload for a <script type="application/ld+json"> tag, or null
 * when no eligible events remain (e.g. an all-non-London feed under the Phase-Q
 * gate) -- the caller then omits the script rather than emit an empty ItemList.
 */
export const renderEventListJsonLd = (input: BuildEventListJsonLdInput): string | null => {
  const payload = buildEventListJsonLd(input);
  const items = payload.itemListElement as unknown[];
  return items.length > 0 ? JSON.stringify(payload) : null;
};
