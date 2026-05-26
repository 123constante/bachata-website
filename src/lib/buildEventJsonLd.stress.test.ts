import { describe, expect, it } from 'vitest';
import { buildEventJsonLd } from './buildEventJsonLd';

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
    expect(loc.address.addressCountry).toBe('GB');

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
  });

  it('still emits location.address when venue is null', () => {
    const out = buildEventJsonLd({
      name: 'Empty',
      url: 'https://bachatacalendar.co.uk/event/x',
      startDate: '2026-06-01T19:00:00+01:00',
      venue: null,
    });
    const loc = out.location as any;
    expect(loc.address['@type']).toBe('PostalAddress');
    expect(loc.address.addressCountry).toBe('GB');
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

  it('falls back to Bachata Calendar organizer when none provided', () => {
    const out = buildEventJsonLd({
      name: 'NoOrg',
      url: 'https://bachatacalendar.co.uk/event/n',
      startDate: '2026-06-01T19:00:00+01:00',
      organiser: null,
    });
    const org = out.organizer as any;
    expect(org.name).toBe('Bachata Calendar');
    expect(org.url).toBe('https://bachatacalendar.co.uk');
  });

  it('uses generic PerformingGroup when no performers provided', () => {
    const out = buildEventJsonLd({
      name: 'NoPerf',
      url: 'https://bachatacalendar.co.uk/event/p',
      startDate: '2026-06-01T19:00:00+01:00',
      performers: [],
    });
    const perf = out.performer as any;
    expect(perf['@type']).toBe('PerformingGroup');
    expect(perf.name).toBe('Bachata Artists');
  });

  it('falls back to event URL as Offer.url when no tickets provided', () => {
    const out = buildEventJsonLd({
      name: 'NoOffers',
      url: 'https://bachatacalendar.co.uk/event/nf',
      startDate: '2026-06-01T19:00:00+01:00',
      offers: [],
    });
    const o = out.offers as any;
    expect(o['@type']).toBe('Offer');
    expect(o.url).toBe('https://bachatacalendar.co.uk/event/nf');
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

  it('emits all five Search Console required fields with minimal input', () => {
    const out = buildEventJsonLd({
      name: 'Minimal',
      url: 'https://bachatacalendar.co.uk/event/m',
      startDate: '2026-06-01T19:00:00+01:00',
    });
    // The five fields Google flagged as missing — all must be present now.
    expect(out.location).toBeDefined();
    expect((out.location as any).address).toBeDefined();
    expect(out.organizer).toBeDefined();
    expect((out.organizer as any).url).toBeDefined();
    expect(out.performer).toBeDefined();
    expect(out.offers).toBeDefined();
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
});
