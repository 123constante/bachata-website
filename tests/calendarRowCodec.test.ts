import { describe, expect, it } from 'vitest';
import { parseCalendarEventRow } from '@/integrations/supabase/eventRpcs';
import { formatWallClockTime, wallClockToInstant } from '@/lib/time/wallClock';

// The generated Returns marks every column non-null; live data does not. The
// codec is the single producer of a branded CalendarEventRow -- it must brand the
// time fields, map the COALESCE(...,'') session sentinel to null, and normalise a
// 'UTC' city_timezone to null so the London default applies. We build a minimal
// raw row (extra generated columns are irrelevant to the branding under test).
const rawRow = (over: Record<string, unknown> = {}) =>
  ({
    event_id: 'e1',
    name: 'Test',
    photo_url: [],
    location: 'Venue',
    instance_date: '2026-07-17',
    start_time: '2026-07-17 20:00:00+00', // SPACE form (::text cast)
    end_time: '2026-07-17 23:00:00+00',
    occurrence_starts_at: '2026-07-17T20:00:00+00', // T form, same value
    occurrence_ends_at: '2026-07-17T23:00:00+00',
    occurrence_id: 'o1',
    is_recurring: false,
    meta_data: {},
    key_times: {},
    has_class: false,
    has_party: true,
    class_start: '', // COALESCE(...,'') sentinel = absent session
    class_end: '',
    party_start: '20:00',
    party_end: '23:00',
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
    slug: 'test',
    is_cancelled: false,
    cancellation_reason_label: '',
    primary_organiser_name: 'Org',
    venue_lat: 51.5,
    venue_lng: -0.1,
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe('parseCalendarEventRow (the calendar-row codec)', () => {
  it('brands the stored wall clocks so they read as-stored (space AND T forms)', () => {
    const row = parseCalendarEventRow(rawRow());
    expect(formatWallClockTime(row.start_time)).toBe('8 PM');
    expect(formatWallClockTime(row.occurrence_starts_at)).toBe('8 PM');
    // ...and convert to the correct BST instant (20:00 London -> 19:00Z).
    expect(wallClockToInstant(row.occurrence_starts_at)?.getTime()).toBe(
      new Date('2026-07-17T19:00:00Z').getTime(),
    );
  });

  it('maps the empty-string session sentinel to null', () => {
    const row = parseCalendarEventRow(rawRow());
    expect(row.class_start).toBeNull();
    expect(row.original_party_start).toBeNull();
    // A present session survives.
    expect(formatWallClockTime(row.party_start)).toBe('8 PM');
  });

  it("normalises a 'UTC' city_timezone to null (so the London default applies)", () => {
    expect(parseCalendarEventRow(rawRow({ city_timezone: 'UTC' })).city_timezone).toBeNull();
    expect(parseCalendarEventRow(rawRow({ city_timezone: 'Africa/Tunis' })).city_timezone).toBe(
      'Africa/Tunis',
    );
  });
});
