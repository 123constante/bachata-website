// A multi-day festival must appear on EVERY day it runs (owner 2026-10-25:
// Pulse Festival, 30 Oct - 1 Nov, was listed on Friday only). The RPCs return one
// row per festival day, all sharing ONE occurrence_id; these tests pin that every
// day-scoped surface keeps each of those rows on its own day, beside the
// ordinary events of that day.
import { describe, it, expect } from 'vitest';
import type { MapEvent } from '../mapTypes';
import { localFeedGroups, listFor } from '../mapListDerivations';
import { transformCalendarEvents, isEventVisibleOnDay } from '@/components/calendar/calendarUtils';
import type { CalendarEventRow } from '@/integrations/supabase/eventRpcs';

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
};

interface Fest { id: string; start: string; days: number; cancelled?: string[] }
interface Shape { name: string; fests: Fest[]; ordinaryOn: string[] }

const SHAPES: Shape[] = [
  { name: '1-day festival', fests: [{ id: 'f1', start: '2026-10-31', days: 1 }], ordinaryOn: ['2026-10-31'] },
  { name: '3-day festival (Pulse shape)', fests: [{ id: 'pulse', start: '2026-10-30', days: 3 }], ordinaryOn: ['2026-10-31', '2026-10-31', '2026-10-31'] },
  { name: '10-day festival', fests: [{ id: 'f10', start: '2026-11-05', days: 10 }], ordinaryOn: ['2026-11-06', '2026-11-14'] },
  { name: 'festival straddling a month end', fests: [{ id: 'fm', start: '2026-11-29', days: 4 }], ordinaryOn: ['2026-11-30', '2026-12-01'] },
  {
    name: 'two festivals overlapping one day',
    fests: [{ id: 'fa', start: '2026-10-30', days: 2 }, { id: 'fb', start: '2026-10-31', days: 2 }],
    ordinaryOn: ['2026-10-31'],
  },
  { name: 'a cancelled festival day', fests: [{ id: 'fc', start: '2026-10-30', days: 3, cancelled: ['2026-10-31'] }], ordinaryOn: ['2026-10-31'] },
];

const festDays = (f: Fest) => Array.from({ length: f.days }, (_, i) => addDays(f.start, i));

// ---- Festival Map feed (get_map_events_v1 rows) ---------------------------

const mapRow = (o: Partial<MapEvent>): MapEvent => ({
  occurrence_id: 'o', event_id: 'e', name: 'Test', cover_image_url: null, venue_name: 'Venue',
  area: null, city_slug: 'london-gb', lat: 51.5, lng: -0.1, instance_date: '2026-10-30',
  start_time: '2026-10-30 20:00:00+00', end_time: '2026-10-31 02:00:00+00', type: 'standard',
  has_party: true, has_class: false, class_start: null, class_end: null, party_start: null,
  party_end: null, created_at: null, updated_at: null, freshness_kind: null, is_cancelled: false,
  cancellation_reason_label: null, ...o,
});

const mapRows = (s: Shape): MapEvent[] => {
  const rows: MapEvent[] = [];
  for (const f of s.fests) {
    for (const d of festDays(f)) {
      // ONE occurrence id fanned across every day, exactly as the RPC returns it.
      rows.push(mapRow({
        occurrence_id: `occ-${f.id}`, event_id: f.id, name: f.id, format: 'festival', type: 'festival',
        instance_date: d, is_cancelled: f.cancelled?.includes(d) ?? false,
      }));
    }
  }
  s.ordinaryOn.forEach((d, i) => rows.push(mapRow({ occurrence_id: `ord-${i}`, event_id: `ord-${i}`, name: `ord-${i}`, format: 'recurring', instance_date: d })));
  return rows.sort((a, b) => (a.instance_date ?? '').localeCompare(b.instance_date ?? ''));
};

const expectedOn = (s: Shape, day: string) => [
  ...s.fests.filter((f) => festDays(f).includes(day)).map((f) => f.id),
  ...s.ordinaryOn.map((d, i) => (d === day ? `ord-${i}` : null)).filter((x): x is string => x !== null),
].sort();

const allDays = (s: Shape) => [...new Set([...s.fests.flatMap(festDays), ...s.ordinaryOn])].sort();

describe.each(SHAPES)('festival on every day: $name', (s) => {
  it('All-Events feed: every day group lists the festival and that day\'s ordinary events', () => {
    const groups = localFeedGroups(mapRows(s));
    expect(groups.map((g) => g.key)).toEqual(allDays(s));
    for (const g of groups) {
      expect(g.items.map((e) => e.event_id).sort(), g.key).toEqual(expectedOn(s, g.key));
    }
  });

  it('All-Events feed: each festival day keeps its own cancelled flag and the full range badge', () => {
    const groups = localFeedGroups(mapRows(s));
    for (const f of s.fests) {
      for (const d of festDays(f)) {
        const row = groups.find((g) => g.key === d)!.items.find((e) => e.event_id === f.id)!;
        expect(row.instance_date).toBe(d);
        expect(row.is_cancelled).toBe(f.cancelled?.includes(d) ?? false);
        expect(Boolean(row.festivalDateRange)).toBe(f.days > 1);
      }
    }
  });

  it('Calendar tab day list: every day lists the festival', () => {
    const events = mapRows(s);
    for (const day of allDays(s)) {
      const list = listFor('cal', { events, day, q: '', user: null, today: '2026-10-25' });
      expect(list.map((e) => e.event_id).sort(), day).toEqual(expectedOn(s, day));
    }
  });

  it('DayDetailModal day filter (get_calendar_events_v2 rows): every day lists the festival', () => {
    const rows = mapRows(s).map((r) => ({
      event_id: r.event_id, occurrence_id: r.occurrence_id, name: r.name, instance_date: r.instance_date,
      format: r.format, type: r.type, is_cancelled: r.is_cancelled, location: 'Venue',
      start_time: null, end_time: null, class_start: null, class_end: null, party_start: null, party_end: null,
      key_times: { party: { active: true } }, meta_data: null, photo_url: null,
    })) as unknown as CalendarEventRow[];
    const items = transformCalendarEvents(rows);
    for (const day of allDays(s)) {
      const [y, m, d] = day.split('-').map(Number);
      // DayDetailModal's own check date: local noon of the selected day.
      const checkDate = new Date(y, m - 1, d, 12, 0, 0, 0);
      const shown = items.filter((e) => isEventVisibleOnDay(e, checkDate, 'all')).map((e) => e.id).sort();
      expect(shown, day).toEqual(expectedOn(s, day));
    }
  });
});
