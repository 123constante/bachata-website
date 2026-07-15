import { describe, expect, it } from 'vitest';
import { pack, unpack } from './dehydrateCodec';

// A representative slice of get_map_events_v1 rows (all 27 columns), including the
// null-heavy fields (area is always null; class/party splits often null) and a
// cancelled row — the shapes the homepage actually dehydrates.
const mapRows = [
  {
    occurrence_id: '11111111-1111-4111-8111-111111111111',
    event_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Sensual Vibes',
    cover_image_url: 'https://x.r2.dev/covers/a.webp',
    venue_name: 'The Dance Hall',
    area: null,
    city_slug: 'london-gb',
    lat: 51.5,
    lng: -0.12,
    instance_date: '2026-07-20',
    start_time: '2026-07-20 20:00:00+00',
    end_time: '2026-07-20 23:00:00+00',
    type: 'standard',
    has_party: true,
    has_class: true,
    created_at: '2026-07-01T10:00:00+00:00',
    updated_at: '2026-07-10T12:00:00+00:00',
    freshness_kind: 'updated',
    is_cancelled: false,
    cancellation_reason_label: null,
    class_start: '20:00',
    class_end: '21:00',
    party_start: '21:00',
    party_end: '23:00',
    format: 'recurring',
    category: 'party',
    slug: 'sensual-vibes',
  },
  {
    occurrence_id: '22222222-2222-4222-8222-222222222222',
    event_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    name: 'ABCD Festival',
    cover_image_url: null,
    venue_name: null,
    area: null,
    city_slug: 'london-gb',
    lat: null,
    lng: null,
    instance_date: '2026-08-01',
    start_time: '2026-08-01 18:00:00+00',
    end_time: null,
    type: 'festival',
    has_party: false,
    has_class: false,
    created_at: '2026-06-15T09:00:00+00:00',
    updated_at: null,
    freshness_kind: 'added',
    is_cancelled: true,
    cancellation_reason_label: 'Venue closed',
    class_start: null,
    class_end: null,
    party_start: null,
    party_end: null,
    format: 'festival',
    category: 'fest',
    slug: 'abcd-festival',
  },
];

// Simulate the serialize/deserialize boundary: dehydrate() output is JSON-serialised
// into the HTML, so the packed form must survive a JSON round-trip and then unpack.
const jsonRoundTrip = (v: unknown) => JSON.parse(JSON.stringify(v));

describe('dehydrateCodec', () => {
  it('round-trips map-events losslessly through JSON', () => {
    const packed = pack(mapRows);
    expect((packed as Record<string, unknown>).__mapEventsColumnarV1).toBe(true);
    const restored = unpack(jsonRoundTrip(packed));
    expect(restored).toEqual(mapRows);
  });

  it('preserves null vs the reconstructed values exactly', () => {
    const restored = unpack(jsonRoundTrip(pack(mapRows))) as typeof mapRows;
    expect(restored[0].area).toBeNull();
    expect(restored[1].cover_image_url).toBeNull();
    expect(restored[1].updated_at).toBeNull();
    expect(restored[1].cancellation_reason_label).toBe('Venue closed');
    // Present-but-unread fields (category) are NOT dropped.
    expect(restored[0].category).toBe('party');
  });

  it('emits fewer characters than the array-of-objects form', () => {
    const before = JSON.stringify(mapRows).length;
    const after = JSON.stringify(pack(mapRows)).length;
    expect(after).toBeLessThan(before);
  });

  it('is an identity no-op on non-packable payloads', () => {
    const single = { id: 'x', name: 'detail-page-object' };
    const calendarRows = [
      { event_id: 'c1', name: 'A', start_time: 't', location: 'L' },
      { event_id: 'c2', name: 'B', start_time: 't', location: 'L' },
    ];
    // Heterogeneous keys, non-plain elements, too-short, primitives, empties.
    const heterogeneous = [{ a: 1 }, { a: 1, b: 2 }];
    const nonPlain = [new Date(), new Date()];
    const oneRow = [{ a: 1 }];

    for (const v of [single, null, undefined, [], oneRow, heterogeneous, nonPlain, 42, 'str', true]) {
      expect(pack(v)).toBe(v); // same reference — untouched
    }
    // calendarRows is a uniform array of plain objects, so it DOES pack — still lossless.
    expect(unpack(jsonRoundTrip(pack(calendarRows)))).toEqual(calendarRows);
  });

  it('unpack is an identity no-op on anything not sentinel-tagged', () => {
    for (const v of [mapRows, { cols: [], rows: [] }, null, 42, 'x', [1, 2, 3]]) {
      expect(unpack(v)).toBe(v);
    }
  });

  it('never throws on malformed sentinel shapes', () => {
    expect(() => unpack({ __mapEventsColumnarV1: true })).not.toThrow();
    expect(() => unpack({ __mapEventsColumnarV1: true, cols: null, rows: null })).not.toThrow();
    // A malformed sentinel is left as-is rather than crashing hydrate().
    const bad = { __mapEventsColumnarV1: true, cols: 'nope', rows: 5 };
    expect(unpack(bad)).toBe(bad);
  });
});
