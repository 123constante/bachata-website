import { describe, expect, it } from 'vitest';
import { buildEventListJsonLd, renderEventListJsonLd } from '@/lib/buildEventListJsonLd';
import { parseCalendarEventRow } from '@/integrations/supabase/eventRpcs';

// Build a branded CalendarEventRow from a minimal raw wire row (extra generated
// columns are irrelevant to the JSON-LD under test).
const row = (over: Record<string, unknown> = {}) =>
  parseCalendarEventRow({
    event_id: 'e1',
    name: 'Makondo',
    photo_url: [],
    location: 'Venue',
    instance_date: '2026-07-18',
    start_time: '2026-07-18 19:15:00+00',
    end_time: '2026-07-19 03:00:00+00',
    occurrence_starts_at: '2026-07-18T19:15:00+00',
    occurrence_ends_at: '2026-07-19T03:00:00+00', // cross-midnight: next day 03:00
    occurrence_id: 'o1',
    is_recurring: false,
    meta_data: {},
    key_times: {},
    has_class: false,
    has_party: true,
    class_start: '',
    class_end: '',
    party_start: '19:15',
    party_end: '03:00',
    original_class_start: '',
    original_class_end: '',
    original_party_start: '',
    original_party_end: '',
    type: 'standard',
    format: 'one_off',
    category: 'social',
    city_slug: 'london-gb',
    city_timezone: 'Europe/London',
    cover_image_url: '',
    slug: 'makondo',
    is_cancelled: false,
    cancellation_reason_label: '',
    primary_organiser_name: 'Org',
    venue_lat: 51.5,
    venue_lng: -0.1,
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

const firstItem = (payload: Record<string, unknown>) =>
  (payload.itemListElement as Array<{ item: Record<string, unknown> }>)[0]?.item;

describe('buildEventListJsonLd', () => {
  it('emits valid ISO 8601 with endDate AFTER startDate for a cross-midnight event', () => {
    // The bug: composing from instance_date put the 03:00 end onto 2026-07-18,
    // BEFORE the 19:15 start. Converting occurrence_ends_at directly keeps its
    // real next-day date. BST (UTC+1): 19:15 London -> 18:15Z, 03:00 -> 02:00Z.
    const item = firstItem(buildEventListJsonLd({ events: [row()], origin: 'https://x.test' }));
    expect(item.startDate).toBe('2026-07-18T18:15:00.000Z');
    expect(item.endDate).toBe('2026-07-19T02:00:00.000Z');
    expect(new Date(item.endDate as string).getTime()).toBeGreaterThan(
      new Date(item.startDate as string).getTime(),
    );
  });

  it('holds non-London rows out of the ItemList (Phase-Q gate)', () => {
    const payload = buildEventListJsonLd({
      events: [row({ city_timezone: 'Africa/Tunis' })],
      origin: 'https://x.test',
    });
    expect((payload.itemListElement as unknown[]).length).toBe(0);
  });

  it('renders null (not an empty ItemList) when no eligible events remain', () => {
    expect(
      renderEventListJsonLd({ events: [row({ city_timezone: 'Africa/Tunis' })], origin: 'https://x.test' }),
    ).toBeNull();
    // A London row still renders.
    expect(renderEventListJsonLd({ events: [row()], origin: 'https://x.test' })).toContain('ItemList');
  });
});

// honest-claims P5. Every node this builder emitted carried the same four
// invented values: Bachata Calendar as organiser of a night it does not run, a
// "Bachata Artists" PerformingGroup that does not exist, an Offer asserting
// InStock for an event with no ticket data, and a description generated from
// the title. Measured on prod the day this was written: 25 of 25 nodes, each.
describe('buildEventListJsonLd -- claims the data evidences', () => {
  const build = (over: Record<string, unknown> = {}) =>
    firstItem(buildEventListJsonLd({ events: [row(over)], origin: 'https://x.test' }));

  it('names the row organiser, not Bachata Calendar', () => {
    const item = build({ primary_organiser_name: 'Ritmo Latino' });
    expect((item.organizer as any).name).toBe('Ritmo Latino');
    expect(JSON.stringify(item)).not.toContain('Bachata Calendar');
  });

  it('omits organizer when the row carries no organiser', () => {
    expect(build({ primary_organiser_name: null }).organizer).toBeUndefined();
    expect(build({ primary_organiser_name: '  ' }).organizer).toBeUndefined();
  });

  it('emits no performer and no offers -- this feed carries neither', () => {
    const item = build();
    expect(item.performer).toBeUndefined();
    expect(item.offers).toBeUndefined();
    const serialised = JSON.stringify(item);
    expect(serialised).not.toContain('Bachata Artists');
    expect(serialised).not.toContain('InStock');
  });

  it('omits description rather than manufacturing one from the title', () => {
    const item = build({ meta_data: {} });
    expect(item.description).toBeUndefined();
    expect(JSON.stringify(item)).not.toContain('Bachata event in');
  });

  it('uses the row description when there actually is one', () => {
    expect(build({ meta_data: { description: 'Real copy' } }).description).toBe('Real copy');
    expect(build({ meta_data: { description: '  padded  ' } }).description).toBe('padded');
  });

  it('drops a description that is not usable Text', () => {
    // meta_data is jsonb: whitespace-only, and non-string shapes that would
    // land in the JSON-LD where schema.org expects Text.
    expect(build({ meta_data: { description: '   ' } }).description).toBeUndefined();
    expect(build({ meta_data: { description: {} } }).description).toBeUndefined();
    expect(build({ meta_data: { description: 42 } }).description).toBeUndefined();
  });

  it('caps a very long description, as the single-event builder does', () => {
    const item = build({ meta_data: { description: 'x'.repeat(10000) } });
    expect((item.description as string).length).toBe(5000);
  });

  it('reads is_cancelled instead of asserting EventScheduled for everything', () => {
    expect(build({ is_cancelled: true }).eventStatus).toBe('https://schema.org/EventCancelled');
    expect(build({ is_cancelled: false }).eventStatus).toBe('https://schema.org/EventScheduled');
  });

  // honest-claims P5b. addressCountry was the literal 'GB' and the locality
  // defaulted to the literal 'London'. The Phase-Q gate means every row that
  // reaches the Place today IS London, so neither was visibly false here -- and
  // that is the point: both were claims the data had never been asked for,
  // waiting on a gate to lift. buildEventJsonLd, which has no such gate, was
  // already publishing addressCountry GB for a Tunisian resort.
  describe('location is derived from the row, not defaulted', () => {
    // The builder returns Record<string, unknown>, so the Place has to be read
    // through a shape. It names only the keys these cases assert, and claims
    // nothing: an omitted location makes the read THROW rather than pass.
    type PostalAddressNode = { addressLocality?: string; addressCountry?: string };
    type PlaceNode = { name?: string; address?: PostalAddressNode };
    const placeOf = (over: Record<string, unknown> = {}) => build(over).location as PlaceNode;
    const addressOf = (over: Record<string, unknown> = {}) => placeOf(over).address;

    it('derives addressLocality from city_slug, and asserts NO country', () => {
      const address = addressOf({ city_slug: 'london-gb' });
      expect(address?.addressLocality).toBe('London');
      // addressCountry is deleted, not derived -- honest-claims P5b.
      expect(address?.addressCountry).toBeUndefined();
    });

    it('strips the country suffix before Title Casing a multi-word city', () => {
      expect(addressOf({ city_slug: 'milton-keynes-gb' })?.addressLocality).toBe('Milton Keynes');
    });

    it('omits both when the row carries no city_slug, rather than saying London GB', () => {
      // `location` still resolves here, so the Place keeps its name and an
      // address is emitted only if something fills it.
      const address = addressOf({ city_slug: null });
      expect(address).toBeUndefined();
      expect(placeOf({ city_slug: null }).name).toBe('Venue');
    });

    // city_slug is genuinely nullable on the wire (eventRpcs' NullableWireCol:
    // rows predating the backfill). With no `location` string either, the first
    // draft of P5b emitted an address object holding nothing but its @type and
    // pinned that here as correct -- a container shaped like a claim with none
    // in it.
    it('omits location entirely when neither a venue string nor a slug resolves', () => {
      const item = build({ city_slug: null, location: '' });
      expect(item.location).toBeUndefined();
      expect(JSON.stringify(item)).not.toContain('PostalAddress');
    });

    // The Phase-Q gate above only skips a NON-NULL non-London timezone, so a
    // row with a null city_timezone and a foreign city_slug reaches the Place.
    // An earlier draft of this phase derived addressCountry here and pinned
    // 'TN' as desired -- which would have paired a correct country with a
    // startDate converted in Europe/London, a NEW false claim rather than a
    // fixed one. Asserting no country is what keeps the leak merely a gap.
    it('states no country even when the gate leaks a foreign row through', () => {
      const address = addressOf({ city_slug: 'gammarth-tn', city_timezone: null });
      expect(address?.addressLocality).toBe('Gammarth');
      expect(address?.addressCountry).toBeUndefined();
    });

    it('omits Place.name only when there is neither a venue string nor a locality', () => {
      expect(placeOf({ location: 'Makondo Bar' }).name).toBe('Makondo Bar');
      expect(placeOf({ location: '', city_slug: 'london-gb' }).name).toBe('London');
      expect(build({ location: '', city_slug: null }).location).toBeUndefined();
    });
  });
});
