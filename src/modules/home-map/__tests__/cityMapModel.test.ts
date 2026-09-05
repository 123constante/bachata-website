import { describe, it, expect } from 'vitest';
import type { MapEvent } from '../mapTypes';
import { buildCityMapModel, matchesType, isMapTypeFilter } from '../cityMapModel';

const base: MapEvent = {
  occurrence_id: 'o',
  event_id: 'e',
  name: 'Test',
  cover_image_url: null,
  venue_name: 'Venue A',
  area: 'Soho',
  city_slug: 'london-gb',
  lat: 51.5,
  lng: -0.1,
  instance_date: '2026-09-11',
  start_time: '2026-09-11 21:00:00+00',
  end_time: '2026-09-12 02:00:00+00',
  type: 'standard',
  format: 'recurring',
  has_party: true,
  has_class: false,
  class_start: null,
  class_end: null,
  party_start: null,
  party_end: null,
  created_at: null,
  updated_at: null,
  freshness_kind: null,
  is_cancelled: false,
  cancellation_reason_label: null,
};
const ev = (o: Partial<MapEvent>): MapEvent => ({ ...base, ...o });

const TODAY = '2026-09-05';
const args = (o: Partial<Parameters<typeof buildCityMapModel>[1]> = {}) => ({
  citySlug: 'london-gb',
  type: 'all' as const,
  q: '',
  from: null,
  today: TODAY,
  ...o,
});

describe('isMapTypeFilter', () => {
  it('accepts the four known values and nothing else', () => {
    expect(['all', 'parties', 'classes', 'courses'].every(isMapTypeFilter)).toBe(true);
    expect(isMapTypeFilter('festivals')).toBe(false);
    expect(isMapTypeFilter(null)).toBe(false);
    expect(isMapTypeFilter('')).toBe(false);
  });
});

describe('matchesType', () => {
  const party = ev({ has_party: true, has_class: false });
  const klass = ev({ has_party: false, has_class: true });
  const both = ev({ has_party: true, has_class: true });
  const course = ev({ format: 'course', has_party: false, has_class: true });

  it('lets everything through on all', () => {
    for (const e of [party, klass, both, course]) expect(matchesType(e, 'all')).toBe(true);
  });

  it('puts a class-and-party night under BOTH parties and classes', () => {
    expect(matchesType(both, 'parties')).toBe(true);
    expect(matchesType(both, 'classes')).toBe(true);
  });

  it('keeps a course out of classes, and only under courses', () => {
    expect(matchesType(course, 'courses')).toBe(true);
    expect(matchesType(course, 'classes')).toBe(false);
    expect(matchesType(course, 'parties')).toBe(false);
    expect(matchesType(klass, 'courses')).toBe(false);
  });

  it('falls back to the legacy type column when format is null', () => {
    const legacy = ev({ format: null, type: 'course', has_class: true });
    expect(matchesType(legacy, 'courses')).toBe(true);
    expect(matchesType(legacy, 'classes')).toBe(false);
  });
});

describe('buildCityMapModel', () => {
  const twoVenues = [
    ev({ occurrence_id: 'a1', event_id: 'a', venue_name: 'Venue A', lat: 51.5, lng: -0.1 }),
    ev({
      occurrence_id: 'b1',
      event_id: 'b',
      name: 'Salsa Social',
      venue_name: 'Venue B',
      lat: 51.52,
      lng: -0.12,
      instance_date: '2026-09-08',
      has_party: false,
      has_class: true,
    }),
  ];

  it('keeps the pin set stable when a filter narrows the visible set', () => {
    const all = buildCityMapModel(twoVenues, args());
    const classes = buildCityMapModel(twoVenues, args({ type: 'classes' }));
    // The pins EventMap builds markers from must NOT move -- that is what keeps
    // a filter tap from rebuilding the whole marker layer.
    expect(classes.pins.map((p) => p.occurrence_id)).toEqual(
      all.pins.map((p) => p.occurrence_id),
    );
    expect(all.visible).toHaveLength(2);
    expect(classes.visible).toEqual(['b1']);
  });

  it('reports N of M, counting venues not events', () => {
    const m = buildCityMapModel(twoVenues, args({ type: 'classes' }));
    expect(m.shownVenues).toBe(1);
    expect(m.totalVenues).toBe(2);
  });

  it('excludes rows from another city', () => {
    const rows = [...twoVenues, ev({ occurrence_id: 'x', event_id: 'x', city_slug: 'paris-fr' })];
    expect(buildCityMapModel(rows, args()).totalVenues).toBe(2);
  });

  it('collapses one venue with several events into ONE row', () => {
    const rows = [
      ...twoVenues,
      ev({ occurrence_id: 'a2', event_id: 'a-second', venue_name: 'Venue A', lat: 51.5, lng: -0.1 }),
    ];
    const m = buildCityMapModel(rows, args());
    expect(m.totalVenues).toBe(2);
    const a = m.rows.find((r) => r.venueName === 'Venue A');
    expect(a?.visibleCount).toBe(2);
    expect([...(a?.eventIds ?? [])].sort()).toEqual(['a', 'a-second']);
  });

  it('narrows to today on from=tonight', () => {
    const rows = [
      ev({ occurrence_id: 't', event_id: 't', instance_date: TODAY, venue_name: 'Tonight Only' }),
      ...twoVenues,
    ];
    const m = buildCityMapModel(rows, args({ from: 'tonight' }));
    expect(m.visible).toEqual(['t']);
    expect(m.rows.map((r) => r.venueName)).toEqual(['Tonight Only']);
    expect(m.totalVenues).toBe(3);
  });

  it('searches over the fields matchesQuery covers, and empty q matches all', () => {
    expect(buildCityMapModel(twoVenues, args({ q: '' })).visible).toHaveLength(2);
    expect(buildCityMapModel(twoVenues, args({ q: 'Salsa' })).visible).toEqual(['b1']);
    expect(buildCityMapModel(twoVenues, args({ q: 'Venue B' })).visible).toEqual(['b1']);
    expect(buildCityMapModel(twoVenues, args({ q: 'zzzz' })).visible).toEqual([]);
  });

  it('gives a zero-results model rather than throwing', () => {
    const m = buildCityMapModel(twoVenues, args({ q: 'zzzz' }));
    expect(m.rows).toEqual([]);
    expect(m.shownVenues).toBe(0);
    expect(m.totalVenues).toBe(2);
    expect(buildCityMapModel([], args()).totalVenues).toBe(0);
  });
});

describe('buildCityMapModel -- row shape and order', () => {
  it('sorts soonest first, then name, then repOccId', () => {
    const rows = [
      ev({ occurrence_id: 'z', event_id: 'z', venue_name: 'Zed', lat: 51.6, lng: -0.2, instance_date: '2026-09-20' }),
      ev({ occurrence_id: 'b', event_id: 'b', venue_name: 'Beta', lat: 51.55, lng: -0.15, instance_date: '2026-09-10' }),
      ev({ occurrence_id: 'a', event_id: 'a', venue_name: 'Alpha', lat: 51.5, lng: -0.1, instance_date: '2026-09-10' }),
    ];
    const m = buildCityMapModel(rows, args());
    expect(m.rows.map((r) => r.venueName)).toEqual(['Alpha', 'Beta', 'Zed']);
  });

  it('carries a coordKey that resolves back to the venue rows', () => {
    const m = buildCityMapModel([ev({ lat: 51.500004, lng: -0.100004 })], args());
    expect(m.rows[0].coordKey).toBe('51.5000,-0.1000');
  });

  it('lists category swatches in a stable order with no repeats', () => {
    const rows = [
      ev({ occurrence_id: 'p', event_id: 'p', has_party: true, has_class: false }),
      ev({ occurrence_id: 'p2', event_id: 'p2', has_party: true, has_class: false }),
      ev({ occurrence_id: 'c', event_id: 'c', has_party: false, has_class: true }),
    ];
    expect(buildCityMapModel(rows, args()).rows[0].categories).toEqual(['party', 'class']);
  });

  it('takes nextDate from the visible members only', () => {
    const rows = [
      ev({ occurrence_id: 'soon', event_id: 'soon', instance_date: '2026-09-06', has_party: true, has_class: false }),
      ev({ occurrence_id: 'later', event_id: 'later', instance_date: '2026-09-20', has_party: false, has_class: true }),
    ];
    // Unfiltered, the soonest is the party. Filtered to classes it must become
    // the class's own date, not stay on a row the list is no longer showing.
    expect(buildCityMapModel(rows, args()).rows[0].nextDate).toBe('2026-09-06');
    expect(buildCityMapModel(rows, args({ type: 'classes' })).rows[0].nextDate).toBe('2026-09-20');
  });

  it('separates two venues sharing one coordinate into two rows', () => {
    const rows = [
      ev({ occurrence_id: 'v1', event_id: 'v1', venue_name: 'Upstairs', lat: 51.5, lng: -0.1 }),
      ev({ occurrence_id: 'v2', event_id: 'v2', venue_name: 'Downstairs', lat: 51.5, lng: -0.1 }),
    ];
    const m = buildCityMapModel(rows, args());
    expect(m.totalVenues).toBe(2);
    expect(m.rows.map((r) => r.venueName).sort()).toEqual(['Downstairs', 'Upstairs']);
  });

  it('drops coordless rows from the map without dropping the city count', () => {
    const rows = [ev({ occurrence_id: 'nc', event_id: 'nc', lat: null, lng: null })];
    const m = buildCityMapModel(rows, args());
    expect(m.pins).toEqual([]);
    expect(m.totalVenues).toBe(0);
  });
});
