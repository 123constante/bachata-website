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
