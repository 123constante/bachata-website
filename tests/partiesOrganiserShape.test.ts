/**
 * /parties ("Find Your Next Party", EventCalendar defaultCategory="parties") and
 * the organiser one-date party (owner walk 2026-10-08, zz-test-delete-me-party2).
 *
 * The row below is what get_calendar_events_v2 returns for that shape while the
 * series is LIVE (read-only prod survey of the function body and the series,
 * 2026-10-08): recurring, recurrence_rule NULL, no series programme items, one
 * date with a per-date added 'party' session 21:00-02:00. The RPC UNIONs
 * event_occurrence_added_session_p5 into key_times / meta_data.program, so the
 * client's hasParty comes out true and the row is listed under Parties by design.
 * (The RPC lists only lifecycle 'live' series; this one was live about five
 * minutes, 15:16-15:21 UTC, before it was archived.)
 */
import { describe, expect, it } from 'vitest';
import { parseCalendarEventRow } from '@/integrations/supabase/eventRpcs';
import { isEventVisibleOnDay, matchesCategory, transformCalendarEvents } from '@/components/calendar/calendarUtils';

const organiserOneDateParty = {
  event_id: 'c81746db-0000-0000-0000-000000000000',
  name: 'Party', photo_url: [], location: 'Some Venue', instance_date: '2026-10-15',
  start_time: '2026-10-15 20:00:00+00', end_time: '2026-10-16 01:00:00+00', is_recurring: false,
  meta_data: { music_styles: [], program: [{ type: 'party', title: 'Party', start: '21:00', end: '02:00' }] },
  key_times: { classes: { active: false, start: '', end: '' }, party: { active: true, start: '21:00', end: '02:00' } },
  type: 'party', has_party: true, has_class: false, class_start: '', class_end: '', party_start: '21:00', party_end: '02:00',
  city_slug: 'london-gb', cover_image_url: null, occurrence_id: 'occ-1',
  occurrence_starts_at: '2026-10-15T20:00:00+00:00', occurrence_ends_at: '2026-10-16T01:00:00+00:00',
  city_timezone: 'Europe/London', venue_lat: 51.5, venue_lng: -0.1, primary_organiser_name: 'Org',
  is_cancelled: false, cancellation_reason_label: null, original_class_start: null, original_class_end: null,
  original_party_start: null, original_party_end: null, format: 'recurring', category: 'party', slug: 'party',
};

describe('/parties lists an organiser one-date party (rule NULL, sessions per date)', () => {
  const [item] = transformCalendarEvents([parseCalendarEventRow(organiserOneDateParty as never)]);
  it('is a party, not a class', () => {
    expect(item.hasParty).toBe(true);
    expect(item.hasClass).toBe(false);
    expect(matchesCategory(item, 'parties')).toBe(true);
    expect(matchesCategory(item, 'classes')).toBe(false);
  });
  // CalendarGrid / DayDetailModal pass the day at local noon.
  it('shows on its own date in the Parties calendar', () => {
    expect(isEventVisibleOnDay(item, new Date(2026, 9, 15, 12), 'parties')).toBe(true);
    expect(isEventVisibleOnDay(item, new Date(2026, 9, 16, 12), 'parties')).toBe(false);
  });
  it('a date whose only session is a performance is not a party (shape limit, by design)', () => {
    const perf = { ...organiserOneDateParty,
      meta_data: { music_styles: [], program: [{ type: 'performance', title: 'Show', start: '21:00', end: '22:00' }] },
      key_times: { classes: { active: false, start: '', end: '' }, party: { active: false, start: '', end: '' } } };
    const [p] = transformCalendarEvents([parseCalendarEventRow(perf as never)]);
    expect(matchesCategory(p, 'parties')).toBe(false);
  });
});
