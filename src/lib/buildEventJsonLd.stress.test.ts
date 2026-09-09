import { describe, expect, it } from 'vitest';
import { buildEventJsonLd } from './buildEventJsonLd';

// The builder returns Record<string, unknown>, so a location node has to be
// read through a shape. These name only the keys the cases below assert, and
// the cast claims nothing: an absent location makes the read THROW rather than
// pass vacuously, and every field is still checked by an expect().
type PostalAddressNode = {
  addressLocality?: string;
  addressCountry?: string;
  streetAddress?: string;
};
type PlaceNode = { name?: string; address?: PostalAddressNode };
const placeOf = (out: Record<string, unknown>) => out.location as PlaceNode;

describe('buildEventJsonLd — stress test', () => {
  it('emits all five Search Console required fields when fully populated', () => {
    const out = buildEventJsonLd({
      name: 'Bachata Wednesday',
      url: 'https://bachatacalendar.co.uk/event/abc',
      startDate: '2026-06-01T19:00:00+01:00',
      endDate: '2026-06-01T23:30:00+01:00',
      description: 'Weekly bachata night',
      image: ['https://r2.example.com/c.jpg'],
      venue: { name: 'The Hub', address: '1 High St', postcode: 'SW1A 1AA', city: 'london' },
      organiser: { name: 'Ricky', url: 'https://example.com/r' },
      performers: [{ name: 'DJ Salsabor', type: 'Person' }],
      offers: [{ url: 'https://t.example.com', name: 'Standard', price: '10', currency: 'GBP' }],
    });

    expect(out['@context']).toBe('https://schema.org');
    expect(out['@type']).toBe('Event');
    expect(out.name).toBe('Bachata Wednesday');
    expect(out.description).toBe('Weekly bachata night');
    expect(out.eventStatus).toBe('https://schema.org/EventScheduled');
    expect(out.image).toEqual(['https://r2.example.com/c.jpg']);

    const loc = out.location as any;
    expect(loc['@type']).toBe('Place');
    expect(loc.address['@type']).toBe('PostalAddress');
    expect(loc.address.streetAddress).toBe('1 High St');
    expect(loc.address.addressLocality).toBe('London');
    expect(loc.address.postalCode).toBe('SW1A 1AA');
    // addressCountry is DELETED, not derived -- honest-claims P5b. It was the
    // literal 'GB' on every event including four that are not in Britain.
    expect(loc.address.addressCountry).toBeUndefined();

    const org = out.organizer as any;
    expect(org['@type']).toBe('Organization');
    expect(org.name).toBe('Ricky');
    expect(org.url).toBe('https://example.com/r');

    const perf = out.performer as any[];
    expect(Array.isArray(perf)).toBe(true);
    expect(perf[0].name).toBe('DJ Salsabor');

    const offers = out.offers as any[];
    expect(Array.isArray(offers)).toBe(true);
    expect(offers[0].url).toBe('https://t.example.com');
    expect(offers[0].price).toBe('10');
    expect(offers[0].priceCurrency).toBe('GBP');
    // A ticket row is a price and a link. Nothing in it records stock, so the
    // Offer says nothing about availability (honest-claims P5b).
    expect(offers[0].availability).toBeUndefined();
  });

  // addressCountry was DELETED, not derived (honest-claims P5b). Deriving it
  // from the city slug was built twice in this phase and reverted both times --
  // it needs a country the SERVER can see, an ISO-validating contract check,
  // and buildEventListJsonLd's Phase-Q gate leak closed first. What must hold
  // now is simply that no event asserts a country it cannot evidence.
  it('never asserts a country, for a UK event or a foreign one', () => {
    for (const city of ['london', 'gammarth', 'barcelona']) {
      const out = buildEventJsonLd({
        name: 'Somewhere',
        url: 'https://bachatacalendar.co.uk/event/s',
        startDate: '2026-06-01T19:00:00+01:00',
        venue: { name: 'A Venue', city },
      });
      const addr = placeOf(out).address;
      expect(addr?.addressLocality).toBeDefined();
      expect(addr?.addressCountry).toBeUndefined();
      expect(JSON.stringify(out)).not.toContain('"GB"');
    }
  });

  // The first draft of P5b emitted -- and pinned here as correct --
  // `{'@type':'Place','address':{'@type':'PostalAddress'}}` for this input: an
  // address object with no address in it, wrapped in a Place with no name. That
  // is a container shaped like a claim, holding none, and Google requires
  // location.address for an offline event. Omit the whole node instead.
  it('omits location entirely when nothing about the place is known', () => {
    const out = buildEventJsonLd({
      name: 'Empty',
      url: 'https://bachatacalendar.co.uk/event/x',
      startDate: '2026-06-01T19:00:00+01:00',
      venue: null,
    });
    expect(out.location).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('United Kingdom');
    expect(JSON.stringify(out)).not.toContain('PostalAddress');
  });

  it('emits a Place with an address as soon as ANY part of the place is known', () => {
    const base = {
      name: 'Partial',
      url: 'https://bachatacalendar.co.uk/event/x',
      startDate: '2026-06-01T19:00:00+01:00',
    };
    // A city alone is enough for an address worth emitting.
    const cityOnly = buildEventJsonLd({ ...base, venue: { city: 'gammarth' } });
    expect(placeOf(cityOnly).address?.addressLocality).toBe('Gammarth');
    // A venue name alone gives a Place.name but no address to carry. This is
    // the shape a hard `location.address` guard assertion would have rejected;
    // that assertion was built in this phase and reverted for it.
    const nameOnly = buildEventJsonLd({ ...base, venue: { name: 'The Hub' } });
    expect(placeOf(nameOnly).name).toBe('The Hub');
    expect(placeOf(nameOnly).address).toBeUndefined();
    // A STREET ADDRESS alone -- no name, no city -- is the ONLY input on which
    // the `|| hasAddress` arm decides anything: placeName is null, and the
    // Place exists solely because the address does. Review round 3 mutated the
    // condition to `if (placeName)` and all 24 cases stayed green, so the
    // arm's only distinguishing input had no coverage at all. This is it.
    const addressOnly = buildEventJsonLd({ ...base, venue: { address: '1 High St' } });
    expect(placeOf(addressOnly).name).toBeUndefined();
    expect(placeOf(addressOnly).address?.streetAddress).toBe('1 High St');
  });

  it('flips eventStatus to EventCancelled when isCancelled is true', () => {
    const out = buildEventJsonLd({
      name: 'Cancelled',
      url: 'https://bachatacalendar.co.uk/event/c',
      startDate: '2026-06-01T19:00:00+01:00',
      isCancelled: true,
    });
    expect(out.eventStatus).toBe('https://schema.org/EventCancelled');
  });

  // INVERTED (honest-claims P5): was 'falls back to Bachata Calendar organizer'.
  // Naming ourselves as organiser of a night we do not run was the single most
  // repeated false statement the arc found -- 25 of 25 nodes on the home list.
  it('omits organizer entirely when no organiser resolves', () => {
    const out = buildEventJsonLd({
      name: 'NoOrg',
      url: 'https://bachatacalendar.co.uk/event/n',
      startDate: '2026-06-01T19:00:00+01:00',
      organiser: null,
    });
    expect(out.organizer).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('Bachata Calendar');
  });

  it('omits organizer when the organiser name is blank or whitespace', () => {
    const out = buildEventJsonLd({
      name: 'BlankOrg',
      url: 'https://bachatacalendar.co.uk/event/bo',
      startDate: '2026-06-01T19:00:00+01:00',
      organiser: { name: '   ', url: 'https://example.com/r' },
    });
    expect(out.organizer).toBeUndefined();
  });

  it('omits the organizer url when the organiser has no website', () => {
    const out = buildEventJsonLd({
      name: 'OrgNoUrl',
      url: 'https://bachatacalendar.co.uk/event/onu',
      startDate: '2026-06-01T19:00:00+01:00',
      organiser: { name: 'Ritmo Latino', url: null },
    });
    expect((out.organizer as any).name).toBe('Ritmo Latino');
    expect((out.organizer as any).url).toBeUndefined();
  });

  // INVERTED (honest-claims P5): was 'uses generic PerformingGroup'. The
  // fallback named a group that does not exist on every event with no lineup
  // on file, to keep a recommended field from reading as missing.
  it('omits performer entirely when no performers provided', () => {
    const out = buildEventJsonLd({
      name: 'NoPerf',
      url: 'https://bachatacalendar.co.uk/event/p',
      startDate: '2026-06-01T19:00:00+01:00',
      performers: [],
    });
    expect(out.performer).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('Bachata Artists');
  });

  // Was 'falls back to event URL as Offer.url when no tickets provided'. That
  // fallback asserted a sale nobody had evidenced -- an Offer marked InStock
  // whose buy link pointed at our own event page -- and it fired on most
  // /event/ pages, because most nights carry no ticket rows.
  it('emits NO offers node when there are no tickets, rather than inventing one', () => {
    const out = buildEventJsonLd({
      name: 'NoOffers',
      url: 'https://bachatacalendar.co.uk/event/nf',
      startDate: '2026-06-01T19:00:00+01:00',
      offers: [],
    });
    expect(out.offers).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('InStock');
    expect(JSON.stringify(out)).not.toContain('availability');
  });

  it('emits no offers node when offers is null or absent entirely', () => {
    const base = {
      name: 'NoOffers',
      url: 'https://bachatacalendar.co.uk/event/nf2',
      startDate: '2026-06-01T19:00:00+01:00',
    };
    expect(buildEventJsonLd({ ...base, offers: null }).offers).toBeUndefined();
    expect(buildEventJsonLd(base).offers).toBeUndefined();
  });

  it('stringifies numeric offer prices and omits priceCurrency when absent', () => {
    const out = buildEventJsonLd({
      name: 'NumericPrice',
      url: 'https://bachatacalendar.co.uk/event/np',
      startDate: '2026-06-01T19:00:00+01:00',
      offers: [{ url: 'https://t.example.com', name: 'Door', price: 40 }],
    });
    const offers = out.offers as any[];
    expect(offers[0].price).toBe('40');
    expect(offers[0].priceCurrency).toBeUndefined();
    expect(offers[0].availability).toBeUndefined();
  });

  it('filters out blank/whitespace performer names', () => {
    const out = buildEventJsonLd({
      name: 'PartialPerf',
      url: 'https://bachatacalendar.co.uk/event/pp',
      startDate: '2026-06-01T19:00:00+01:00',
      performers: [
        { name: '', type: 'Person' },
        { name: '   ', type: 'Person' },
        { name: 'Real Person', type: 'Person' },
      ],
    });
    const perf = out.performer as any[];
    expect(perf).toHaveLength(1);
    expect(perf[0].name).toBe('Real Person');
  });

  it('capitalises hyphenated city slugs', () => {
    const out = buildEventJsonLd({
      name: 'HyphenCity',
      url: 'https://bachatacalendar.co.uk/event/hc',
      startDate: '2026-06-01T19:00:00+01:00',
      venue: { city: 'milton-keynes' },
    });
    const loc = out.location as any;
    expect(loc.address.addressLocality).toBe('Milton keynes');
    expect(loc.name).toBe('Milton keynes');
  });

  it('truncates description over 5000 chars', () => {
    const out = buildEventJsonLd({
      name: 'LongDesc',
      url: 'https://bachatacalendar.co.uk/event/ld',
      startDate: '2026-06-01T19:00:00+01:00',
      description: 'x'.repeat(10000),
    });
    expect((out.description as string).length).toBe(5000);
  });

  it('omits description when null/empty/whitespace', () => {
    const out = buildEventJsonLd({
      name: 'Empty',
      url: 'https://bachatacalendar.co.uk/event/e',
      startDate: '2026-06-01T19:00:00+01:00',
      description: '   ',
    });
    expect(out.description).toBeUndefined();
  });

  it('omits endDate when null', () => {
    const out = buildEventJsonLd({
      name: 'NoEnd',
      url: 'https://bachatacalendar.co.uk/event/ne',
      startDate: '2026-06-01T19:00:00+01:00',
      endDate: null,
    });
    expect(out.endDate).toBeUndefined();
  });

  it('emits the REQUIRED fields with minimal input, and invents nothing else', () => {
    const out = buildEventJsonLd({
      name: 'Minimal',
      url: 'https://bachatacalendar.co.uk/event/m',
      startDate: '2026-06-01T19:00:00+01:00',
    });
    // name and startDate are the only required fields derivable from an input
    // this bare. location is required by Google too -- and is OMITTED here,
    // deliberately: with no venue, no city and no slug there is nothing true to
    // put in it, and forfeiting the rich result beats inventing a place. That
    // is unreachable on real data (all 67 published events resolve a city);
    // the shape exists so the builder has an honest answer rather than a
    // container shaped like one.
    expect(out.name).toBeDefined();
    expect(out.startDate).toBeDefined();
    expect(out.location).toBeUndefined();
    // organizer and performer went in honest-claims P5, offers in P5b. All
    // three are RECOMMENDED, and all three were being satisfied by inventing
    // the value: a default organiser (us, on other people's nights), a
    // "Bachata Artists" performing group that does not exist, and an Offer
    // asserting InStock for a sale that was never happening. A minimal event
    // now takes three rich-result warnings rather than making three claims.
    expect(out.organizer).toBeUndefined();
    expect(out.performer).toBeUndefined();
    expect(out.offers).toBeUndefined();
    // description is optional — Google warning, not error
  });

  it('is JSON-serialisable in all cases', () => {
    const inputs = [
      { name: 'a', url: 'u', startDate: '2026-01-01' },
      { name: 'b', url: 'u', startDate: '2026-01-01', venue: null, organiser: null, performers: null, offers: null },
      { name: 'c', url: 'u', startDate: '2026-01-01', performers: [{ name: 'x' }] },
    ];
    for (const i of inputs) {
      expect(() => JSON.stringify(buildEventJsonLd(i))).not.toThrow();
    }
  });

  // Series-termination arc P4b. The page's banner and og:description say the run
  // has finished; the JSON-LD on the SAME page was telling Google a ticket was
  // InStock. Both offers branches used to assert availability, including a
  // fallback that fired when there were no tickets at all -- so passing an empty
  // array was not enough and the suppression had to live here.
  //
  // honest-claims P5b deleted both the fallback and the availability claim, so
  // the ORIGINAL reason is gone. isEnded is still load-bearing for a different
  // one, which the tests below now pin: an ended series with REAL ticket rows
  // must not advertise them.
  describe('an ended series', () => {
    const ENDED = {
      name: 'June Styling Course',
      url: 'https://bachatacalendar.co.uk/event/june-styling',
      startDate: '2026-06-28T13:00:00+01:00',
      isEnded: true,
    };

    it('emits NO offers node at all, with or without tickets', () => {
      expect(buildEventJsonLd(ENDED).offers).toBeUndefined();
      expect(
        buildEventJsonLd({
          ...ENDED,
          offers: [{ url: 'https://t.example.com', name: 'Standard', price: '10', currency: 'GBP' }],
        }).offers,
      ).toBeUndefined();
    });

    // The other direction. There is no longer a fallback Offer to compare
    // against -- honest-claims P5b deleted it -- so with no tickets, ended and
    // live now agree on emitting nothing. That makes the isEnded return look
    // redundant, and this is the case proving it is NOT: give the ended series
    // real ticket rows and it must STILL stay silent, while the same rows on a
    // live event are published.
    it('suppresses REAL ticket rows on an ended series, and publishes them when live', () => {
      const tickets = [{ url: 'https://t.example.com', name: 'Standard', price: '10', currency: 'GBP' }];
      expect(buildEventJsonLd({ ...ENDED, offers: tickets }).offers).toBeUndefined();

      const live = buildEventJsonLd({ ...ENDED, isEnded: false, offers: tickets });
      expect(live.offers).toEqual([
        {
          '@type': 'Offer',
          url: 'https://t.example.com',
          name: 'Standard',
          price: '10',
          priceCurrency: 'GBP',
        },
      ]);
    });

    it('emits nothing for a live event with no tickets either', () => {
      expect(buildEventJsonLd({ ...ENDED, isEnded: false }).offers).toBeUndefined();
    });

    // eventStatus is deliberately NOT touched. schema.org has no "finished"
    // value, and a run that reached its last night was not EventCancelled --
    // saying so would be a new false statement, worse than the one being fixed.
    // Google reads past-ness off startDate/endDate.
    it('keeps EventScheduled -- an ended run was not cancelled', () => {
      expect(buildEventJsonLd(ENDED).eventStatus).toBe('https://schema.org/EventScheduled');
      expect(buildEventJsonLd({ ...ENDED, isCancelled: true }).eventStatus).toBe(
        'https://schema.org/EventCancelled',
      );
    });

    // Everything above offers still has to survive the early return.
    it('keeps name, dates, venue and organiser', () => {
      const out = buildEventJsonLd({
        ...ENDED,
        endDate: '2026-06-28T15:00:00+01:00',
        description: 'This course has finished and is no longer running.',
        venue: { name: 'Dance Attic', city: 'london' },
        organiser: { name: 'Alex Boneva' },
      });
      expect(out.name).toBe('June Styling Course');
      expect(out.endDate).toBe('2026-06-28T15:00:00+01:00');
      expect(out.description).toBe('This course has finished and is no longer running.');
      expect(out.location).toBeTruthy();
      expect(out.organizer).toBeTruthy();
    });
  });
});
