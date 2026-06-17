import { describe, it, expect } from 'vitest';
import type { MapEvent } from '../mapTypes';
import { matchesFilter, deriveCategory, isFestivalFormat } from '../mapTypes';
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
