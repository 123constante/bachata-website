/**
 * buildEventJsonLd — returns a Schema.org Event JSON-LD blob for an
 * individual event detail page. Emitted as an inline <script> so search
 * engines (and rich-result previews) can index the event.
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
  /** Series-termination arc P4b: the SERIES has stopped for good. Suppresses the
   *  offers node entirely, INCLUDING real ticket rows still on file -- a run
   *  that has finished must not advertise passes. (It used to also suppress an
   *  unconditional fallback Offer; honest-claims P5b deleted that branch, so
   *  this flag now earns its keep on the real-offers path alone.) NOT wired to
   *  eventStatus: schema.org has no "finished" value, and an event that RAN is
   *  not EventCancelled. Google reads past-ness off startDate/endDate, so the
   *  honest node is one with no claim about availability at all. */
  isEnded?: boolean | null;
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

  // Location. Google requires `location` and `location.address` for an offline
  // event and documents ONLY Place -- schema.org's wider range (a bare
  // PostalAddress, Text, VirtualLocation) is a DIFFERENT document and is not
  // what the crawler reads, so the node shape stays Place.
  //
  // We do NOT always satisfy that requirement any more, and saying so is the
  // point. Deleting the 'GB' default removed the last field that guaranteed the
  // address was non-empty, so a venue with a name but no street, postcode or
  // city now emits a Place with no `address`, and an event with none of those
  // emits no `location` at all. Both forfeit the rich result. That is the
  // deliberate trade: a missing required field costs the rich result, an
  // invented one is a false statement. check-seo now WARNS rather than
  // hard-requires `location` and `location.address` (queued-seo-location-
  // address-assertion.md, built), the same demotion `offers` already had --
  // an organiser-data gap no longer reds the PR gate on code nobody changed.
  //
  // `placeName` used to fall back to the string 'United Kingdom', naming the
  // country as if it were the venue. It bought nothing on an event that had a
  // name or a city, and stood ready to mislabel the first event that lacked
  // both. No name, no `name` field.
  //
  // `addressCountry` was the literal 'GB' on every event, and four published
  // festivals are not in Great Britain: a Tunisian resort, two Spanish hotels
  // (one street address literally ending "Barcelona, Spain") and a Budapest
  // hotel all carried addressCountry GB on prod. The field is DELETED rather
  // than derived. Deriving it from the city slug was built and reviewed twice
  // in this phase and reverted: it needs a country the SERVER can see (the
  // event-page compat payload has no city_slug key at all), an ISO-validating
  // contract check that consumes this parser rather than re-implementing it,
  // and a resolution of buildEventListJsonLd's Phase-Q gate leak, which pairs
  // a real foreign country with a London-converted startDate. Those are a
  // phase, not a line. queued-jsonld-addresscountry-derivation.md carries them.
  //
  // Deleting it loses the true GB claims along with the false ones. That is
  // the honest trade while the derivation is unbuilt: Google documents no
  // requirement for addressCountry, so nothing breaks, and an omitted field
  // says nothing where a wrong one says something false.
  const venue = e.venue ?? null;
  const placeName = venue?.name || (venue?.city ? capitalise(venue.city) : null);
  const postal: Record<string, string> = { '@type': 'PostalAddress' };
  if (venue?.address) postal.streetAddress = venue.address;
  if (venue?.city) postal.addressLocality = capitalise(venue.city);
  if (venue?.postcode) postal.postalCode = venue.postcode;

  // An address object carrying nothing but its @type is not an address, and a
  // Place carrying neither a name nor an address is not a location. Striking
  // the 'GB' default and the 'United Kingdom' name together made both shapes
  // reachable, and the first draft of this phase emitted them and pinned them
  // in tests -- an empty container reads as "we know where this is" while
  // stating nothing, which is the same class of claim the arc is removing.
  // Emit only what has content; omit `location` entirely when there is none.
  //
  // The predicate names the three inputs that fill `postal`, rather than
  // counting its keys. buildVenueJsonLd.ts:55 already solves this exact
  // problem the same way, and the count form is a fail-open sentinel: it
  // means "more keys than the @type I put there", so the day anything else
  // is written unconditionally it reads TRUE forever and the empty container
  // this block exists to suppress comes back, with every fixture still green.
  const hasAddress = !!(venue?.address || venue?.city || venue?.postcode);
  if (placeName || hasAddress) {
    const place: Record<string, unknown> = { '@type': 'Place' };
    if (placeName) place.name = placeName;
    if (hasAddress) place.address = postal;
    node.location = place;
  }

  // Organizer: emit ONLY when a real organiser resolves. The default below
  // named Bachata Calendar as the organiser of every event it does not run --
  // on the homepage list that was 25 of 25 nodes, each a different business's
  // night. `organizer` is recommended, not required, so an event with no
  // organiser on file omits it rather than crediting us with someone's work.
  const org = e.organiser ?? null;
  const orgName = org?.name?.trim();
  if (orgName) {
    const organizer: Record<string, unknown> = {
      '@type': 'Organization',
      name: orgName,
    };
    if (org?.url) organizer.url = org.url;
    node.organizer = organizer;
  }

  // Performer: emit ONLY real names. The generic "Bachata Artists"
  // PerformingGroup existed to keep a recommended field from being missing,
  // and did it by naming a group that does not exist on every event with no
  // lineup on file. A missing recommended field costs a rich-result warning;
  // an invented performer is a false statement about who is playing.
  const performers = (e.performers ?? []).filter((p) => p?.name?.trim());
  if (performers.length > 0) {
    node.performer = performers.map((p) => ({
      '@type': p.type ?? 'Person',
      name: p.name.trim(),
    }));
  }

  // Offers: emit ONLY the tickets the organiser actually gave us.
  //
  // Two claims were struck here, and both were about a sale nobody had
  // evidenced. The first was the fallback Offer: an event with no ticket rows
  // still emitted `{ url: <our own event page>, availability: InStock }`, which
  // told Google a ticket was on sale and pointed the buy link at a page that
  // sells nothing. On prod that node was on 3 of the 4 non-UK festivals and on
  // most /event/ pages, because most nights have no ticket rows at all.
  //
  // The second was `availability: InStock` on the REAL offers. Nothing in the
  // ticket row records stock: an organiser's row is a price and a link, and
  // whether it is still buyable lives on their site, not ours. url, name, price
  // and currency are evidenced and stay; availability was inferred and goes.
  // schema.org offers no "unknown" value, and omitting the property is how you
  // say nothing -- SoldOut is false, and InStock was a guess that happened to
  // be phrased as a fact.
  //
  // The isEnded early return (series-termination arc P4b) now costs nothing
  // extra -- with no fallback there is nothing to suppress for an ended run
  // that has no tickets -- but it stays, because an ended series WITH ticket
  // rows on file must still not advertise them. `offers` is recommended for
  // rich results, never required, so an event with no ticket data omits it.
  if (e.isEnded) return node;

  // Left as truthiness DELIBERATELY: an offer with neither a link nor a price
  // states nothing, and dropping it keeps the node honest.
  //
  // Both call sites used to substitute a falsy default for "no price on file"
  // -- FestivalDetail `?? 0`, BentoPage `?? ''` -- so a priceless row arrived
  // here already wearing a price. Both defaults are deleted at source
  // (2026-09-08); a priceless row now arrives null and the `!= null` guard
  // below omits the field.
  //
  // Four claims that stood here have been STRUCK as false, not merely updated,
  // and none should be reinstated from git history: that every row carries a
  // non-null url (both call sites' ticketUrl are nullable), that the price arm
  // therefore decides nothing, that the `?? 0` defect was LIVE (FestivalDetail
  // filters passes by `amount > 0` before this map, so it never published), and
  // that 3 Barcelona passes were priceless (they hold real money under
  // `price_eur`/`label`, which the RPC does not read).
  //
  // Known gaps here, measured and queued rather than fixed: this arm reads
  // numeric 0 as absence while the guard below reads it as a price, so a free
  // offer with no ticket link is dropped; `priceCurrency` can still be emitted
  // beside no price; and neither arm normalises a whitespace-only price or url.
  // queued-jsonld-offer-price-default.md carries them, with repro output.
  const realOffers = (e.offers ?? []).filter((o) => o && (o.url || o.price));
  if (realOffers.length > 0) {
    node.offers = realOffers.map((o) => {
      // url ONLY when the organiser gave us one. `o.url || e.url` pointed the
      // buy link back at our own event page whenever a ticket row carried a
      // price but no link -- the same self-referential Offer the fallback
      // branch was struck for, surviving one level down on the real-offers
      // path. Both call sites can produce it: FestivalDetail maps every pass to
      // a single nullable `ticketUrl`, BentoPage to a nullable
      // `pageModel.actions.ticketUrl`. Offer.url is not required by Google.
      const offer: Record<string, unknown> = { '@type': 'Offer' };
      if (o.url) offer.url = o.url;
      if (o.name) offer.name = o.name;
      if (o.price != null) offer.price = String(o.price);
      if (o.currency) offer.priceCurrency = o.currency;
      return offer;
    });
  }

  return node;
};
