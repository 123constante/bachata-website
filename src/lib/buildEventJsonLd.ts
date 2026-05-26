/**
 * buildEventJsonLd — returns a Schema.org Event JSON-LD blob for an
 * individual event detail page. Emitted as an inline <script> so search
 * engines (and rich-result previews) can index the event with full
 * date/location/organizer/performer/offers data.
 *
 * Mirrors buildVenueJsonLd.ts's "optional fields just drop out" philosophy.
 * The caller stringifies and inlines via dangerouslySetInnerHTML.
 */

export type EventJsonLdInput = {
  name: string;
  url: string;
  startDate: string;
  endDate?: string | null;
  description?: string | null;
  image?: string[] | null;
  isCancelled?: boolean | null;
  venue?: {
    name?: string | null;
    address?: string | null;
    postcode?: string | null;
    city?: string | null;
  } | null;
  organiser?: {
    name: string;
    url?: string | null;
  } | null;
  performers?: Array<{ name: string; type?: 'Person' | 'PerformingGroup' }> | null;
  offers?: Array<{
    url?: string | null;
    name?: string | null;
    price?: string | number | null;
    currency?: string | null;
  }> | null;
};

const capitalise = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ') : s;

export const buildEventJsonLd = (e: EventJsonLdInput): Record<string, unknown> => {
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.name,
    url: e.url,
    startDate: e.startDate,
    eventStatus: e.isCancelled
      ? 'https://schema.org/EventCancelled'
      : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  };

  if (e.endDate) node.endDate = e.endDate;

  if (e.description && e.description.trim()) {
    node.description = e.description.trim().slice(0, 5000);
  }

  if (Array.isArray(e.image) && e.image.length > 0) {
    node.image = e.image.filter(Boolean);
  }

  // Location: always emit a Place with at minimum a country, even when no
  // venue detail is available. Satisfies Google's location.address warning.
  const venue = e.venue ?? null;
  const placeName = venue?.name || venue?.city || 'United Kingdom';
  const postal: Record<string, string> = {
    '@type': 'PostalAddress',
    addressCountry: 'GB',
  };
  if (venue?.address) postal.streetAddress = venue.address;
  if (venue?.city) postal.addressLocality = capitalise(venue.city);
  if (venue?.postcode) postal.postalCode = venue.postcode;
  node.location = {
    '@type': 'Place',
    name: placeName,
    address: postal,
  };

  // Organizer: always emit (default to Bachata Calendar if no event organiser).
  const org = e.organiser ?? null;
  node.organizer = {
    '@type': 'Organization',
    name: org?.name || 'Bachata Calendar',
    url: org?.url || 'https://bachatacalendar.co.uk',
  };

  // Performer: always emit at least a generic PerformingGroup so the
  // recommended field isn't missing. If real names are present, list them.
  const performers = (e.performers ?? []).filter((p) => p?.name?.trim());
  if (performers.length > 0) {
    node.performer = performers.map((p) => ({
      '@type': p.type ?? 'Person',
      name: p.name.trim(),
    }));
  } else {
    node.performer = { '@type': 'PerformingGroup', name: 'Bachata Artists' };
  }

  // Offers: always emit at least one Offer pointing at the event URL.
  const realOffers = (e.offers ?? []).filter((o) => o && (o.url || o.price));
  if (realOffers.length > 0) {
    node.offers = realOffers.map((o) => {
      const offer: Record<string, unknown> = {
        '@type': 'Offer',
        url: o.url || e.url,
        availability: 'https://schema.org/InStock',
      };
      if (o.name) offer.name = o.name;
      if (o.price != null) offer.price = String(o.price);
      if (o.currency) offer.priceCurrency = o.currency;
      return offer;
    });
  } else {
    node.offers = {
      '@type': 'Offer',
      url: e.url,
      availability: 'https://schema.org/InStock',
    };
  }

  return node;
};

export const renderEventJsonLd = (input: EventJsonLdInput): string =>
  JSON.stringify(buildEventJsonLd(input));
