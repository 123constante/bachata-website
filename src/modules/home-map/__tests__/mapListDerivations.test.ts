import { describe, it, expect } from 'vitest';
import type { MapEvent } from '../mapTypes';
import {
  matchesFilter,
  deriveCategory,
  isFestivalFormat,
  isRemoteRow,
  startMinutes,
  formatTime,
} from '../mapTypes';
import { instantToLondonWallClockStamp } from '@/lib/londonDate';
import {
  dedupePins,
  tonightEvents,
  newsEvents,
  groupByDate,
  formatDayLabel,
  calendarDays,
  listFor,
  mapVisibleFor,
  glowFor,
  buildMonthCells,
  homeStats,
  collapseFestivals,
  windowGroups,
  partitionRemote,
  INITIAL_FEED_DAYS,
  FEED_DAYS_CHUNK,
  festivalRangeLabel,
  groupPinsByLocation,
  isOnCityMap,
} from '../mapListDerivations';

const base: MapEvent = {
  occurrence_id: 'o',
  event_id: 'e',
  name: 'Test',
  cover_image_url: null,
  venue_name: 'Venue',
  area: null,
  city_slug: 'london-gb',
  lat: 51.5,
  lng: -0.1,
  instance_date: '2026-06-10',
  start_time: '2026-06-10 20:00:00+00',
  end_time: '2026-06-11 02:00:00+00',
  type: 'standard',
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

describe('dedupePins', () => {
  it('collapses multi-day occurrences of one event+venue into a single pin (soonest day)', () => {
    const events = [
      ev({ occurrence_id: 'o1', event_id: 'e1', instance_date: '2026-06-12' }),
      ev({ occurrence_id: 'o2', event_id: 'e1', instance_date: '2026-06-05' }),
      ev({ occurrence_id: 'o3', event_id: 'e2', instance_date: '2026-06-07' }),
    ];
    const { pins, pinKeyForOcc } = dedupePins(events);
    expect(pins).toHaveLength(2);
    expect(pinKeyForOcc.get('o1')).toBe('o2'); // both e1 days point at the soonest pin
    expect(pinKeyForOcc.get('o2')).toBe('o2');
    expect(pinKeyForOcc.get('o3')).toBe('o3');
  });

  it('drops coordless events from the pin set', () => {
    const { pins } = dedupePins([ev({ occurrence_id: 'x', lat: null, lng: null })]);
    expect(pins).toHaveLength(0);
  });
});

describe('isOnCityMap', () => {
  it('keeps rows whose city_slug matches the page city', () => {
    expect(isOnCityMap(ev({ city_slug: 'london-gb' }), 'london-gb')).toBe(true);
  });
  it('keeps rows with no city_slug (local/legacy) regardless of page city', () => {
    expect(isOnCityMap(ev({ city_slug: null }), 'london-gb')).toBe(true);
  });
  it('drops a feed-wide festival physically in another city', () => {
    // Tunisia festival surfaced in London's feed (real foreign coords) -> off map.
    expect(isOnCityMap(ev({ city_slug: 'gammarth-tn' }), 'london-gb')).toBe(false);
  });
  it('scopes nothing when the page city is null (pin everything)', () => {
    expect(isOnCityMap(ev({ city_slug: 'gammarth-tn' }), null)).toBe(true);
  });

  it('excludes the out-of-city pin from a city-scoped pin set but keeps London', () => {
    const events = [
      ev({ occurrence_id: 'lon', event_id: 'e1', city_slug: 'london-gb', lat: 51.5, lng: -0.1 }),
      ev({ occurrence_id: 'tun', event_id: 'e2', city_slug: 'gammarth-tn', lat: 36.93, lng: 10.28 }),
    ];
    const { pins } = dedupePins(events.filter((e) => isOnCityMap(e, 'london-gb')));
    expect(pins.map((p) => p.occurrence_id)).toEqual(['lon']);
  });
});

describe('tonightEvents', () => {
  it('keeps only today and sorts by distance, nulls last', () => {
    const today = '2026-06-10';
    const near = ev({ occurrence_id: 'near', lat: 51.51, lng: -0.1, instance_date: today });
    const far = ev({ occurrence_id: 'far', lat: 52.5, lng: -1.9, instance_date: today });
    const noco = ev({ occurrence_id: 'noco', lat: null, lng: null, instance_date: today });
    const other = ev({ occurrence_id: 'other', instance_date: '2026-06-11' });
    const out = tonightEvents([far, noco, near, other], { lat: 51.5, lng: -0.1 }, today);
    expect(out.map((e) => e.occurrence_id)).toEqual(['near', 'far', 'noco']);
  });
});

describe('newsEvents', () => {
  it('dedupes by event and sorts by freshness desc', () => {
    const a = ev({
      occurrence_id: 'a',
      event_id: 'ea',
      freshness_kind: 'added',
      created_at: '2026-06-01T10:00:00Z',
    });
    const a2 = ev({
      occurrence_id: 'a2',
      event_id: 'ea',
      freshness_kind: 'added',
      created_at: '2026-06-01T10:00:00Z',
      instance_date: '2026-06-20',
    });
    const b = ev({
      occurrence_id: 'b',
      event_id: 'eb',
      freshness_kind: 'updated',
      updated_at: '2026-06-05T10:00:00Z',
      created_at: '2026-05-01T00:00:00Z',
    });
    const out = newsEvents([a, a2, b], '2026-06-10');
    expect(out).toHaveLength(2); // a + a2 collapse to one event
    expect(out[0].event_id).toBe('eb'); // updated 06-05 newer than added 06-01
  });
});

describe('groupByDate / formatDayLabel', () => {
  it('groups ascending with full British weekday labels and counts', () => {
    const out = groupByDate([
      ev({ occurrence_id: '1', instance_date: '2026-06-12' }),
      ev({ occurrence_id: '2', instance_date: '2026-06-05' }),
      ev({ occurrence_id: '3', instance_date: '2026-06-05' }),
    ]);
    expect(out.map((g) => g.key)).toEqual(['2026-06-05', '2026-06-12']);
    expect(out[0].items).toHaveLength(2);
    expect(out[0].label).toBe('Friday, 5 June');
  });

  it('formats a date as "Weekday, D Month"', () => {
    expect(formatDayLabel('2026-06-06')).toBe('Saturday, 6 June');
  });
});

describe('calendarDays', () => {
  it('maps each date to its distinct categories', () => {
    const m = calendarDays([
      ev({ instance_date: '2026-06-10', has_party: true, has_class: false }),
      ev({ instance_date: '2026-06-10', has_party: false, has_class: true }),
      ev({ instance_date: '2026-06-10', has_party: true, has_class: false }),
    ]);
    expect(new Set(m.get('2026-06-10'))).toEqual(new Set(['party', 'class']));
  });

  it('only dots filter-matched events (dots respect the category filter)', () => {
    const events = [
      ev({ instance_date: '2026-06-10', type: 'festival', has_party: false, has_class: false }),
      ev({ instance_date: '2026-06-11', type: 'standard', has_party: false, has_class: true }),
    ];
    const fests = calendarDays(events.filter((e) => matchesFilter(e, 'festivals')));
    expect([...fests.keys()]).toEqual(['2026-06-10']);
    expect(fests.get('2026-06-10')).toEqual(['fest']);
  });

  it('splits a single class+party event into both dots (no purple mix)', () => {
    const m = calendarDays([
      ev({ instance_date: '2026-06-10', type: 'standard', has_party: true, has_class: true }),
    ]);
    expect(m.get('2026-06-10')).toEqual(['party', 'class']);
  });

  it('a festival contributes only a fest dot, not party/class', () => {
    const m = calendarDays([
      ev({ instance_date: '2026-06-10', type: 'festival', has_party: true, has_class: true }),
    ]);
    expect(m.get('2026-06-10')).toEqual(['fest']);
  });
});

describe('Phase 8 format-primary festival classification', () => {
  it('isFestivalFormat reads format first when present', () => {
    // format wins over a disagreeing legacy type
    expect(isFestivalFormat({ format: 'festival', type: 'standard' })).toBe(true);
    expect(isFestivalFormat({ format: 'recurring', type: 'festival' })).toBe(false);
    expect(isFestivalFormat({ format: 'one_off', type: 'standard' })).toBe(false);
  });

  it('isFestivalFormat falls back to legacy type when format is null/absent', () => {
    expect(isFestivalFormat({ format: null, type: 'festival' })).toBe(true);
    expect(isFestivalFormat({ format: null, type: 'standard' })).toBe(false);
    expect(isFestivalFormat({ type: 'festival' } as never)).toBe(true);
  });

  it('deriveCategory classifies as fest from format even when type disagrees', () => {
    expect(
      deriveCategory({ format: 'festival', type: 'standard', has_party: true, has_class: true }),
    ).toBe('fest');
  });

  it('a format=festival row contributes only a fest dot regardless of legacy type', () => {
    const m = calendarDays([
      ev({ instance_date: '2026-06-10', format: 'festival', type: 'standard', has_party: true, has_class: true }),
    ]);
    expect(m.get('2026-06-10')).toEqual(['fest']);
  });

  it('matchesFilter "festivals" gates on format-primary', () => {
    const festByFormat = ev({ format: 'festival', type: 'standard' });
    const recurringClass = ev({ format: 'recurring', type: 'festival', has_class: true });
    expect(matchesFilter(festByFormat, 'festivals')).toBe(true);
    expect(matchesFilter(recurringClass, 'festivals')).toBe(false);
  });
});

describe('listFor / mapVisibleFor / glowFor', () => {
  const today = '2026-06-10';
  const e1 = ev({
    occurrence_id: 'o1',
    event_id: 'e1',
    has_party: true,
    has_class: false,
    instance_date: today,
  });
  const e2 = ev({
    occurrence_id: 'o2',
    event_id: 'e2',
    has_party: false,
    has_class: true,
    instance_date: '2026-06-12',
    freshness_kind: 'added',
    created_at: new Date().toISOString(),
  });
  const events = [e1, e2];
  const { pinKeyForOcc } = dedupePins(events);

  it('all tab filters by category, then query', () => {
    const out = listFor('all', { events, day: null, filter: 'classes', q: '', user: null, today });
    expect(out.map((e) => e.occurrence_id)).toEqual(['o2']);
  });

  it('news + empty calendar keep the whole city; other tabs mirror the list', () => {
    const listAll = listFor('all', { events, day: null, filter: 'parties', q: '', user: null, today });
    expect(new Set(mapVisibleFor('all', null, listAll, pinKeyForOcc, events, '', 'parties'))).toEqual(
      new Set(['o1']),
    );
    expect(new Set(mapVisibleFor('news', null, [], pinKeyForOcc, events, '', 'all'))).toEqual(
      new Set(['o1', 'o2']),
    );
  });

  it('category filter composes with every tab (list + map)', () => {
    // e1 is a party today, e2 is a class on a later day -> Tonight+Classes is empty.
    const tonightClasses = listFor('tonight', { events, day: null, filter: 'classes', q: '', user: null, today });
    expect(tonightClasses.map((e) => e.occurrence_id)).toEqual([]);
    // News + Parties: the whole-city map narrows to the party pin only.
    expect(new Set(mapVisibleFor('news', null, [], pinKeyForOcc, events, '', 'parties'))).toEqual(
      new Set(['o1']),
    );
  });

  it('glow only on the news tab, only freshly-added pins', () => {
    expect(glowFor('all', events, pinKeyForOcc)).toEqual([]);
    expect(glowFor('news', events, pinKeyForOcc)).toEqual(['o2']);
  });
});

describe('buildMonthCells', () => {
  const cal = new Map<string, ('party' | 'class' | 'mix' | 'fest' | 'social')[]>([
    ['2026-06-10', ['party']],
    ['2026-06-12', ['class', 'fest']],
  ]);

  it('lays June 2026 out Monday-first with the right label and shape', () => {
    const g = buildMonthCells(2026, 5, cal, '2026-06-10', '2026-06-12');
    expect(g.label).toBe('June 2026');
    // June 1 2026 is a Monday, so no leading blanks; 30 days -> 5 padded weeks.
    expect(g.weeks).toHaveLength(5);
    expect(g.weeks.every((w) => w.length === 7)).toBe(true);
    expect(g.weeks[0][0].day).toBe(1);
    const realDays = g.weeks.flat().filter((c) => c.date != null);
    expect(realDays).toHaveLength(30);
  });

  it('tags categories, today, and the selected day', () => {
    const g = buildMonthCells(2026, 5, cal, '2026-06-10', '2026-06-12');
    const byDate = (d: string) => g.weeks.flat().find((c) => c.date === d)!;
    expect(byDate('2026-06-10').cats).toEqual(['party']);
    expect(byDate('2026-06-10').isToday).toBe(true);
    expect(byDate('2026-06-12').isSelected).toBe(true);
    expect(byDate('2026-06-12').cats).toEqual(['class', 'fest']);
    expect(byDate('2026-06-01').cats).toEqual([]);
  });

  it('pads leading blanks for a month that starts mid-week', () => {
    // July 2026 starts on a Wednesday -> 2 Monday-first leading blanks.
    const g = buildMonthCells(2026, 6, new Map(), '2026-07-01', null);
    expect(g.weeks[0][0].date).toBeNull();
    expect(g.weeks[0][1].date).toBeNull();
    expect(g.weeks[0][2].day).toBe(1);
  });

  it('flags days before today as past; blanks are never past', () => {
    const g = buildMonthCells(2026, 5, new Map(), '2026-06-15', null);
    const byDate = (d: string) => g.weeks.flat().find((c) => c.date === d)!;
    expect(byDate('2026-06-14').isPast).toBe(true);
    expect(byDate('2026-06-15').isPast).toBe(false);
    expect(byDate('2026-06-16').isPast).toBe(false);
    const jul = buildMonthCells(2026, 6, new Map(), '2026-06-15', null);
    expect(jul.weeks[0][0].date).toBeNull();
    expect(jul.weeks[0][0].isPast).toBe(false);
  });
});


describe('homeStats', () => {
  const today = '2026-06-10';

  it('counts distinct events this week and distinct venues', () => {
    const events = [
      ev({ occurrence_id: 's1', event_id: 'e1', instance_date: '2026-06-11', venue_name: 'A' }),
      ev({ occurrence_id: 's2', event_id: 'e1', instance_date: '2026-06-12', venue_name: 'A' }),
      ev({ occurrence_id: 's3', event_id: 'e2', instance_date: '2026-06-13', venue_name: 'B' }),
      ev({ occurrence_id: 's4', event_id: 'e3', instance_date: '2026-06-25', venue_name: 'C' }),
    ];
    const out = homeStats(events, today);
    expect(out.thisWeek).toBe(2); // e1 (two days collapse) + e2
    expect(out.venues).toBe(3); // A, B, C
  });

  it('ignores null venues and events outside the 7-day window', () => {
    const events = [
      ev({ occurrence_id: 'p1', event_id: 'past', instance_date: '2026-06-01', venue_name: null }),
      ev({ occurrence_id: 'st', event_id: 'far', instance_date: '2026-06-25', venue_name: null }),
    ];
    const out = homeStats(events, today);
    expect(out.thisWeek).toBe(0); // both outside the window
    expect(out.venues).toBe(0); // null venues ignored
  });
});
describe('festivalRangeLabel', () => {
  it('formats a same-month range with an en-dash', () => {
    expect(festivalRangeLabel(['2026-06-19', '2026-06-20', '2026-06-21'])).toBe('19\u201321 June');
  });
  it('formats a cross-month range', () => {
    expect(festivalRangeLabel(['2026-06-29', '2026-07-01'])).toBe('29 June \u2013 1 July');
  });
  it('returns null for a single distinct day', () => {
    expect(festivalRangeLabel(['2026-06-19'])).toBeNull();
    expect(festivalRangeLabel(['2026-06-19', '2026-06-19'])).toBeNull();
  });
});

describe('collapseFestivals', () => {
  it('collapses a single-occurrence multi-day festival to one row with a date range', () => {
    const events = [
      ev({ occurrence_id: 'o', event_id: 'f1', format: 'festival', instance_date: '2026-06-19' }),
      ev({ occurrence_id: 'o', event_id: 'f1', format: 'festival', instance_date: '2026-06-20' }),
      ev({ occurrence_id: 'o', event_id: 'f1', format: 'festival', instance_date: '2026-06-21' }),
    ];
    const out = collapseFestivals(events);
    expect(out).toHaveLength(1);
    expect(out[0].instance_date).toBe('2026-06-19');
    expect(out[0].festivalDateRange).toBe('19\u201321 June');
  });

  it('collapses a multi-row festival (one occurrence per day) to one ranged row', () => {
    const events = [
      ev({ occurrence_id: 'a', event_id: 'ab', format: 'festival', instance_date: '2027-03-26' }),
      ev({ occurrence_id: 'b', event_id: 'ab', format: 'festival', instance_date: '2027-03-27' }),
      ev({ occurrence_id: 'c', event_id: 'ab', format: 'festival', instance_date: '2027-03-28' }),
      ev({ occurrence_id: 'd', event_id: 'ab', format: 'festival', instance_date: '2027-03-29' }),
    ];
    const out = collapseFestivals(events);
    expect(out).toHaveLength(1);
    expect(out[0].instance_date).toBe('2027-03-26');
    expect(out[0].festivalDateRange).toBe('26\u201329 March');
  });

  it('passes non-festivals through and collapses festivals among them (order preserved)', () => {
    const events = [
      ev({ occurrence_id: 'p1', event_id: 'party', format: 'recurring', instance_date: '2026-06-19' }),
      ev({ occurrence_id: 'f1', event_id: 'fest', format: 'festival', instance_date: '2026-06-19' }),
      ev({ occurrence_id: 'f2', event_id: 'fest', format: 'festival', instance_date: '2026-06-20' }),
      ev({ occurrence_id: 'p2', event_id: 'party2', format: 'recurring', instance_date: '2026-06-20' }),
    ];
    const out = collapseFestivals(events);
    expect(out.map((e) => e.event_id)).toEqual(['party', 'fest', 'party2']);
    expect(out.find((e) => e.event_id === 'fest')!.festivalDateRange).toBe('19\u201320 June');
  });

  it('leaves a non-festival list untouched (no festivalDateRange)', () => {
    const out = collapseFestivals([
      ev({ occurrence_id: 'a', event_id: 'e1', format: 'recurring', instance_date: '2026-06-19' }),
      ev({ occurrence_id: 'b', event_id: 'e2', format: 'recurring', instance_date: '2026-06-20' }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.every((e) => e.festivalDateRange === undefined)).toBe(true);
  });

  it('does not stamp a range on a single-day festival', () => {
    const out = collapseFestivals([
      ev({ occurrence_id: 'o', event_id: 'f', format: 'festival', instance_date: '2026-06-19' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].festivalDateRange).toBeUndefined();
  });

  it('keeps a multi-day festival LIVE when only its first day is cancelled', () => {
    const out = collapseFestivals([
      ev({ occurrence_id: 'a', event_id: 'f', format: 'festival', instance_date: '2027-03-26', is_cancelled: true }),
      ev({ occurrence_id: 'b', event_id: 'f', format: 'festival', instance_date: '2027-03-27', is_cancelled: false }),
      ev({ occurrence_id: 'c', event_id: 'f', format: 'festival', instance_date: '2027-03-28', is_cancelled: false }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].is_cancelled).toBe(false);
    expect(out[0].instance_date).toBe('2027-03-27');
    expect(out[0].festivalDateRange).toBe('26\u201328 March');
  });

  it('marks a collapsed festival cancelled only when every day is cancelled', () => {
    const out = collapseFestivals([
      ev({ occurrence_id: 'a', event_id: 'f', format: 'festival', instance_date: '2027-03-26', is_cancelled: true }),
      ev({ occurrence_id: 'b', event_id: 'f', format: 'festival', instance_date: '2027-03-27', is_cancelled: true }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].is_cancelled).toBe(true);
    expect(out[0].instance_date).toBe('2027-03-26');
  });
});

describe('groupPinsByLocation', () => {
  it('collapses multiple distinct events at one venue-coordinate into a stack', () => {
    const pins = [
      ev({ occurrence_id: 'a', event_id: 'e1', venue_name: 'Pura', lat: 51.49, lng: -0.25, instance_date: '2026-06-12' }),
      ev({ occurrence_id: 'b', event_id: 'e2', venue_name: 'Pura', lat: 51.49, lng: -0.25, instance_date: '2026-06-10' }),
      ev({ occurrence_id: 'c', event_id: 'e3', venue_name: 'Pura', lat: 51.49, lng: -0.25, instance_date: '2026-06-14' }),
    ];
    const groups = groupPinsByLocation(pins);
    expect(groups).toHaveLength(1);
    expect(groups[0].isStack).toBe(true);
    expect(groups[0].members).toHaveLength(3);
    expect(groups[0].venueName).toBe('Pura');
    expect(groups[0].repOccId).toBe('b'); // soonest, non-cancelled
    expect(new Set(groups[0].memberOccs)).toEqual(new Set(['a', 'b', 'c']));
  });

  it('picks a non-cancelled representative over a sooner cancelled one', () => {
    const pins = [
      ev({ occurrence_id: 'x', event_id: 'e1', venue_name: 'V', lat: 51.5, lng: -0.1, instance_date: '2026-06-05', is_cancelled: true }),
      ev({ occurrence_id: 'y', event_id: 'e2', venue_name: 'V', lat: 51.5, lng: -0.1, instance_date: '2026-06-09' }),
    ];
    const groups = groupPinsByLocation(pins);
    expect(groups).toHaveLength(1);
    expect(groups[0].repOccId).toBe('y'); // cancelled 'x' is sooner but not the face
  });

  it('keeps different venue_names at the same coord as separate, offset pins', () => {
    const pins = [
      ev({ occurrence_id: 'a', event_id: 'e1', venue_name: 'Bar A', lat: 51.526, lng: -0.078 }),
      ev({ occurrence_id: 'b', event_id: 'e2', venue_name: 'Bar B', lat: 51.526, lng: -0.078 }),
    ];
    const groups = groupPinsByLocation(pins);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => !g.isStack)).toBe(true);
    expect(new Set(groups.map((g) => g.offsetIndex))).toEqual(new Set([0, 1]));
  });

  it('collapses NULL-venue colocated events with a neutral (null) venueName', () => {
    const pins = [
      ev({ occurrence_id: 'a', event_id: 'e1', venue_name: null, lat: 51.4, lng: -0.2 }),
      ev({ occurrence_id: 'b', event_id: 'e2', venue_name: null, lat: 51.4, lng: -0.2 }),
    ];
    const groups = groupPinsByLocation(pins);
    expect(groups).toHaveLength(1);
    expect(groups[0].isStack).toBe(true);
    expect(groups[0].venueName).toBeNull();
  });

  it('leaves a single-event location as a non-stack pin', () => {
    const groups = groupPinsByLocation([ev({ occurrence_id: 'solo', lat: 51.51, lng: -0.13 })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].isStack).toBe(false);
    expect(groups[0].repOccId).toBe('solo');
  });

  it('does not collapse coords that differ beyond ~11m (4dp)', () => {
    const pins = [
      ev({ occurrence_id: 'a', event_id: 'e1', venue_name: 'V', lat: 51.5, lng: -0.1 }),
      ev({ occurrence_id: 'b', event_id: 'e2', venue_name: 'V', lat: 51.502, lng: -0.1 }),
    ];
    const groups = groupPinsByLocation(pins);
    expect(groups).toHaveLength(2);
  });
});

describe('windowGroups (windowed SSR)', () => {
  // Build N day-groups, one dated event each, ascending from 2026-06-01.
  const groupsOf = (n: number) =>
    groupByDate(
      Array.from({ length: n }, (_, i) =>
        ev({ occurrence_id: `o${i}`, instance_date: `2026-06-${String(i + 1).padStart(2, '0')}` }),
      ),
    );

  it('withholds groups beyond the window and flags hasMore', () => {
    const groups = groupsOf(20);
    const { visible, hasMore } = windowGroups(groups, 7);
    expect(visible).toHaveLength(7);
    expect(hasMore).toBe(true);
    // The window is a prefix: the earliest days, in order, never a gap.
    expect(visible.map((g) => g.key)).toEqual(groups.slice(0, 7).map((g) => g.key));
  });

  it('shows every group and clears hasMore once the window covers them all', () => {
    const groups = groupsOf(5);
    const { visible, hasMore } = windowGroups(groups, INITIAL_FEED_DAYS);
    expect(visible).toEqual(groups);
    expect(hasMore).toBe(false);
  });

  it('treats the exact-fit boundary as no-more (no empty sentinel round)', () => {
    const groups = groupsOf(7);
    expect(windowGroups(groups, 7).hasMore).toBe(false);
  });

  it('never returns a windowed group with no rows (header-without-rows invariant)', () => {
    const groups = groupsOf(30);
    for (const g of windowGroups(groups, INITIAL_FEED_DAYS).visible) {
      expect(g.items.length).toBeGreaterThan(0);
    }
  });

  it('clamps a nonsensical negative window to empty, still hasMore', () => {
    const groups = groupsOf(10);
    const { visible, hasMore } = windowGroups(groups, -3);
    expect(visible).toHaveLength(0);
    expect(hasMore).toBe(true);
  });

  it('expansion chunk is a whole number of days', () => {
    expect(Number.isInteger(FEED_DAYS_CHUNK)).toBe(true);
    expect(FEED_DAYS_CHUNK).toBeGreaterThan(0);
  });

  // partitionRemote keeps remote rows OUT of this list entirely, so windowGroups
  // has no remote-awareness to test -- that separation is what fixes both the
  // scroll-jump and the dragged-local-rows defects. See partitionRemote's doc.
  it('takes no pin/exempt argument -- remote rows are partitioned out instead', () => {
    expect(windowGroups.length).toBe(2);
  });
});

describe('partitionRemote', () => {
  const mixed = () => [
    ev({ occurrence_id: 'o1', instance_date: '2026-06-01' }),
    ev({ occurrence_id: 'remote-f', instance_date: '2026-11-02' }),
    ev({ occurrence_id: 'o2', instance_date: '2026-06-02' }),
  ];

  it('splits on the sentinel, preserving order within each side', () => {
    const { local, remote } = partitionRemote(mixed());
    expect(local.map((e) => e.occurrence_id)).toEqual(['o1', 'o2']);
    expect(remote.map((e) => e.occurrence_id)).toEqual(['remote-f']);
  });

  it('loses no rows', () => {
    const all = mixed();
    const { local, remote } = partitionRemote(all);
    expect(local.length + remote.length).toBe(all.length);
  });

  it('returns empty sides rather than undefined when one side is absent', () => {
    expect(partitionRemote([]).local).toEqual([]);
    expect(partitionRemote([]).remote).toEqual([]);
  });

  // The point of partitioning: a remote row must never enter the windowed
  // stream, so window growth cannot displace it and it cannot drag a
  // far-future group's local rows past the window.
  it('keeps remote rows out of the windowed local groups entirely', () => {
    const { local, remote } = partitionRemote([
      ...Array.from({ length: 20 }, (_, i) =>
        ev({ occurrence_id: `o${i}`, instance_date: `2026-06-${String(i + 1).padStart(2, '0')}` }),
      ),
      ev({ occurrence_id: 'remote-f', instance_date: '2026-11-02' }),
    ]);
    const { visible } = windowGroups(groupByDate(local), 7);
    expect(visible.flatMap((g) => g.items.map((e) => e.occurrence_id))).not.toContain('remote-f');
    expect(remote).toHaveLength(1);
  });
});

describe('isRemoteRow', () => {
  it('matches the remote- sentinel the global-festivals merge stamps', () => {
    expect(isRemoteRow(ev({ occurrence_id: 'remote-abc' }))).toBe(true);
    expect(isRemoteRow(ev({ occurrence_id: 'o1' }))).toBe(false);
  });

  // The three misclassifications the sentinel exists to avoid. Each of these
  // rows is LOCAL; a date-, coord- or city-based test would wrongly call it
  // remote and route it to /festival/:id or exempt it from the feed window.
  it('does not mistake a far-future LONDON festival for a remote row', () => {
    expect(isRemoteRow(ev({ occurrence_id: 'o1', instance_date: '2027-12-31' }))).toBe(false);
  });

  it('does not mistake a coordless local row for a remote row', () => {
    expect(isRemoteRow(ev({ occurrence_id: 'o1', lat: null, lng: null }))).toBe(false);
  });

  it('does not mistake a null-city_slug local row for a remote row', () => {
    expect(isRemoteRow(ev({ occurrence_id: 'o1', city_slug: null }))).toBe(false);
  });
});

describe('startMinutes / time parsing', () => {
  it('parses the space-separated wall-clock form the occurrence RPCs emit', () => {
    expect(startMinutes(ev({ start_time: '2026-06-10 20:00:00+00' }))).toBe(20 * 60);
  });

  it('parses a bare HH:MM split token', () => {
    expect(startMinutes(ev({ start_time: null, class_start: '18:30' }))).toBe(18 * 60 + 30);
  });

  it('returns null for a string with no time', () => {
    expect(startMinutes(ev({ start_time: '2026-08-14' }))).toBeNull();
  });

  // T-form support is DEFENSIVE parity with formatTime, not an endorsement of
  // feeding instants in. Both helpers must agree on whatever they are handed,
  // so a row can never print one time and sort by another -- that mismatch
  // silently sank rows to the end of their day-group.
  it('agrees with formatTime on a T-separated string', () => {
    const t = '2026-08-14T19:00:00+00:00';
    expect(startMinutes(ev({ start_time: t }))).toBe(19 * 60);
    expect(formatTime(t)).toBe('7:00pm');
  });

  it('orders by the same value it displays, for both separators', () => {
    const early = ev({ occurrence_id: 'a', start_time: '2026-08-14T19:00:00+00:00' });
    const late = ev({ occurrence_id: 'b', start_time: '2026-08-14 23:30:00+00' });
    const [first, second] = groupByDate(
      [late, early].map((e) => ({ ...e, instance_date: '2026-08-14' })),
    )[0].items;
    expect(first.occurrence_id).toBe('a');
    expect(second.occurrence_id).toBe('b');
  });
});

// The real fix for the festivals feed: an instant must be converted to the
// naive local-as-UTC convention BEFORE it reaches the parsers above. Locking
// this down here because the failure is invisible in winter -- it only appears
// once BST is in force, i.e. it would have shipped green and broken in March.
describe('instantToLondonWallClockStamp (festivals-feed boundary)', () => {
  it('recovers the intended local start for a BST-period instant', () => {
    // Live-verified shape: BachaZouk UK, intended 12:00, arrives as 11:00+00.
    const stamped = instantToLondonWallClockStamp('2026-06-12T11:00:00+00:00');
    expect(stamped).toBe('2026-06-12 12:00:00+00');
    expect(formatTime(stamped)).toBe('12:00pm');
    expect(startMinutes(ev({ start_time: stamped }))).toBe(12 * 60);
  });

  it('is a no-op in GMT, where the instant already equals the wall clock', () => {
    // Live-verified: Any Body Can Dance, February, intended 10:00 -> 10:00+00.
    expect(instantToLondonWallClockStamp('2027-02-11T10:00:00+00:00')).toBe(
      '2027-02-11 10:00:00+00',
    );
  });

  it('crosses the date boundary correctly for a late-evening BST instant', () => {
    // 23:30 UTC in July is 00:30 the NEXT London day.
    expect(instantToLondonWallClockStamp('2026-07-10T23:30:00+00:00')).toBe(
      '2026-07-11 00:30:00+00',
    );
  });

  it('returns null for null/unparseable input rather than throwing', () => {
    expect(instantToLondonWallClockStamp(null)).toBeNull();
    expect(instantToLondonWallClockStamp('not a date')).toBeNull();
  });
});
