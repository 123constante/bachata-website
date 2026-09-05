import { describe, it, expect } from 'vitest';
import type { MapEvent } from '../mapTypes';
import { dateLabel, regularNights, venueCoordKey } from '../venueNights';

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
  instance_date: '2026-09-11',
  start_time: '2026-09-11 21:00:00+00',
  end_time: '2026-09-12 02:00:00+00',
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

/** Every row in these fixtures sits at base's coord unless it says otherwise. */
const HERE = venueCoordKey(51.5, -0.1);
const args = (eventIds: string[], today = '2026-09-05') => ({
  eventIds: new Set(eventIds),
  coordKey: HERE,
  today,
});

// Date keys are built by UTC-noon arithmetic, never by incrementing the day
// field: a naive `11 + i * 7` produces '2026-09-32' on the fourth week, which
// is not a date and would have made every multi-week fixture below a lie.
const keyPlus = (key: string, days: number): string =>
  new Date(new Date(`${key}T12:00:00Z`).getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

/** `n` occurrences of one event, `step` days apart, starting at `from`. */
const run = (
  n: number,
  step: number,
  from = '2026-09-11',
  over: Partial<MapEvent> = {},
): MapEvent[] =>
  Array.from({ length: n }, (_, i) => {
    const date = keyPlus(from, i * step);
    return ev({
      occurrence_id: `${over.event_id ?? base.event_id}-${i}`,
      instance_date: date,
      start_time: `${date} 21:00:00+00`,
      ...over,
    });
  });

describe('venueCoordKey', () => {
  it('rounds to the ~11m precision dedupePins uses', () => {
    expect(venueCoordKey(51.500004, -0.100004)).toBe(venueCoordKey(51.5, -0.1));
    expect(venueCoordKey(51.5006, -0.1)).not.toBe(venueCoordKey(51.5, -0.1));
  });

  it('gives a stable key for a coordless row rather than throwing', () => {
    expect(venueCoordKey(null, null)).toBe(',');
    expect(venueCoordKey(undefined, undefined)).toBe(',');
  });
});

// Ported here when venuePanelHtml.ts was deleted with the reverted Leaflet
// popup: dateLabel outlived that module and its coverage had to move with it,
// not vanish with the file.
describe('dateLabel', () => {
  it('gives day and short month, with the full weekday when asked', () => {
    expect(dateLabel('2026-09-11', false)).toBe('11 Sep');
    expect(dateLabel('2026-09-11', true)).toBe('Friday 11 Sep');
  });

  it('spells the weekday in full, never abbreviated', () => {
    expect(dateLabel('2026-09-12', true)).toBe('Saturday 12 Sep');
    expect(dateLabel('2026-09-13', true)).toBe('Sunday 13 Sep');
  });

  it('does not zero-pad the day', () => {
    expect(dateLabel('2026-09-01', false)).toBe('1 Sep');
  });

  it('returns empty for a malformed key rather than NaN', () => {
    expect(dateLabel('not-a-date', true)).toBe('');
    expect(dateLabel('', false)).toBe('');
  });
});

describe('regularNights -- grouping', () => {
  it('groups by event_id, NOT by name: two events sharing a name stay two nights', () => {
    const rows = [
      ...run(3, 7, '2026-09-11', { event_id: 'a', name: 'Bachata Night' }),
      ...run(3, 7, '2026-09-12', { event_id: 'b', name: 'Bachata Night' }),
    ];
    const out = regularNights(rows, args(['a', 'b']));
    expect(out).toHaveLength(2);
    expect(out.map((n) => n.eventId).sort()).toEqual(['a', 'b']);
  });

  it('ignores events that are not at this pin', () => {
    const rows = [
      ...run(3, 7, '2026-09-11', { event_id: 'a' }),
      ...run(3, 7, '2026-09-11', { event_id: 'other' }),
    ];
    expect(regularNights(rows, args(['a'])).map((n) => n.eventId)).toEqual(['a']);
  });

  it('coord-guards: one event at two venues lists only the tapped venue dates', () => {
    const rows = [
      ...run(2, 7, '2026-09-11', { event_id: 'a' }),
      // Same event, different venue -- must not contribute its dates here.
      ...run(2, 7, '2026-09-14', { event_id: 'a', lat: 51.52, lng: -0.12 }),
    ];
    const [night] = regularNights(rows, args(['a']));
    expect(night.dateCount).toBe(2);
    expect(night.nextDate).toBe('2026-09-11');
  });

  it('drops rows with no instance_date rather than dating them', () => {
    const rows = [
      ev({ event_id: 'a', occurrence_id: 'x', instance_date: null }),
      ...run(2, 7, '2026-09-11', { event_id: 'a' }),
    ];
    expect(regularNights(rows, args(['a']))[0].dateCount).toBe(2);
  });

  it('returns nothing when no row matches, rather than an empty-shaped night', () => {
    expect(regularNights(run(3, 7), args(['nope']))).toEqual([]);
    expect(regularNights([], args(['a']))).toEqual([]);
  });
});

describe('regularNights -- pattern', () => {
  it('names the plural weekday of nextDate for a weekly run', () => {
    const [n] = regularNights(run(6, 7, '2026-09-11'), args(['e']));
    expect(n.nextDate).toBe('2026-09-11');
    expect(n.pattern).toBe('Fridays');
  });

  it('calls a single date One-off', () => {
    expect(regularNights(run(1, 7), args(['e']))[0].pattern).toBe('One-off');
  });

  it('bands 14-day, 30-day and 60-day rhythms', () => {
    expect(regularNights(run(5, 14), args(['e']))[0].pattern).toBe('Fortnightly');
    expect(regularNights(run(5, 30), args(['e']))[0].pattern).toBe('Monthly');
    expect(regularNights(run(5, 60), args(['e']))[0].pattern).toBe('Occasional');
  });

  it('flags isWeekly on exactly the patterns that name a weekday', () => {
    // The panel drops the weekday from the date when this is true, so it has to
    // agree with the label on every band, not just the weekly one.
    expect(regularNights(run(5, 7), args(['e']))[0].isWeekly).toBe(true);
    for (const step of [14, 30, 60]) {
      expect(regularNights(run(5, step), args(['e']))[0].isWeekly).toBe(false);
    }
    expect(regularNights(run(1, 7), args(['e']))[0].isWeekly).toBe(false);
  });

  it('uses the MEDIAN gap, so one long break does not demote a weekly night', () => {
    // Eight Fridays with a two-month summer gap in the middle. The mean gap is
    // ~15 days ('Fortnightly'); the median is 7.
    const rows = [
      ...run(4, 7, '2026-06-05', { event_id: 'e' }),
      ...run(4, 7, '2026-09-11', { event_id: 'e' }),
    ];
    const [n] = regularNights(rows, args(['e']));
    expect(n.pattern).toBe('Fridays');
  });

  it('takes the weekday from nextDate, so label and date cannot disagree', () => {
    // A night that moved from Fridays to Saturdays: the upcoming dates are
    // Saturdays, and that is what the panel must say.
    const rows = [
      ...run(3, 7, '2026-08-07', { event_id: 'e' }),
      ...run(3, 7, '2026-09-12', { event_id: 'e' }),
    ];
    const [n] = regularNights(rows, args(['e']));
    expect(n.nextDate).toBe('2026-09-12');
    expect(n.pattern).toBe('Saturdays');
  });

  it('collapses duplicate dates before the gap arithmetic', () => {
    // Two rows on every date. Counted raw, half the gaps are 0 and the median
    // collapses to 0 -- which still reads as weekly, so assert the COUNT too:
    // that is the number a doubled date actually corrupts.
    const weekly = run(4, 7, '2026-09-11', { event_id: 'e' });
    const doubled = weekly.map((r, i) => ev({ ...r, occurrence_id: `dup-${i}` }));
    const [n] = regularNights([...weekly, ...doubled], args(['e']));
    expect(n.dateCount).toBe(4);
    expect(n.pattern).toBe('Fridays');
  });
});

describe('regularNights -- next date, fields and order', () => {
  it('picks the first date on or after today, not the first date', () => {
    const [n] = regularNights(run(5, 7, '2026-08-14'), args(['e'], '2026-09-05'));
    expect(n.nextDate).toBe('2026-09-11');
  });

  it('counts today itself as upcoming', () => {
    const [n] = regularNights(run(3, 7, '2026-09-11'), args(['e'], '2026-09-11'));
    expect(n.nextDate).toBe('2026-09-11');
  });

  it('falls back to the latest PAST date when nothing is upcoming', () => {
    const [n] = regularNights(run(3, 7, '2026-06-05'), args(['e'], '2026-09-05'));
    expect(n.nextDate).toBe('2026-06-19');
    expect(n.dateCount).toBe(3);
  });

  it('carries nextDate own row: occurrence id, time and cancellation', () => {
    const rows = run(3, 7, '2026-09-11', { event_id: 'e' });
    rows[0] = ev({ ...rows[0], occurrence_id: 'the-one', start_time: '2026-09-11 19:30:00+00' });
    const [n] = regularNights(rows, args(['e']));
    expect(n.nextOccId).toBe('the-one');
    expect(n.time).toBe('7:30pm');
    expect(n.isCancelled).toBe(false);
  });

  it('reports a null time rather than an empty string', () => {
    const [n] = regularNights([ev({ event_id: 'e', start_time: null })], args(['e']));
    expect(n.time).toBeNull();
  });

  it('lets a live row win a date it shares with a cancelled one', () => {
    const rows = [
      ev({ event_id: 'e', occurrence_id: 'dead', is_cancelled: true }),
      ev({ event_id: 'e', occurrence_id: 'live', is_cancelled: false }),
    ];
    // Both orders, so the result cannot depend on which row arrives first.
    expect(regularNights(rows, args(['e']))[0].nextOccId).toBe('live');
    expect(regularNights([...rows].reverse(), args(['e']))[0].nextOccId).toBe('live');
  });

  it('still reports a date whose only row is cancelled', () => {
    const [n] = regularNights(
      [ev({ event_id: 'e', occurrence_id: 'dead', is_cancelled: true })],
      args(['e']),
    );
    expect(n.isCancelled).toBe(true);
  });

  it('derives the display category from the row', () => {
    const [n] = regularNights(
      [ev({ event_id: 'e', has_party: true, has_class: true })],
      args(['e']),
    );
    expect(n.category).toBe('mix');
  });

  it('sorts soonest first, then by name for a shared date', () => {
    const rows = [
      ...run(1, 7, '2026-09-20', { event_id: 'late', name: 'Zulu' }),
      ...run(1, 7, '2026-09-11', { event_id: 'b', name: 'Beta' }),
      ...run(1, 7, '2026-09-11', { event_id: 'a', name: 'Alpha' }),
    ];
    const out = regularNights(rows, args(['late', 'b', 'a']));
    expect(out.map((n) => n.name)).toEqual(['Alpha', 'Beta', 'Zulu']);
  });
});
