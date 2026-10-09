// @vitest-environment jsdom
/**
 * Calendar day popup (DayDetailModal) and calendar list (CalendarListView) for a date with no
 * timed session (owner decision 2026-10-09; admin 20261109920000). Before this change the popup
 * printed the literal label "Event" and the series default "20:00 - 01:00" (walk defect 1); the
 * list printed the bare default time. Table-driven over the same shapes as
 * tests/sessionlessDateTbc.surfaces.test.ts: only an explicit has_timed_session=false shows the
 * TBC words; a timed date and a payload without the flag render exactly as before.
 */
import './jsdomPolyfills';
import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { parseCalendarEventRow } from '@/integrations/supabase/eventRpcs';
import { transformCalendarEvents } from '@/components/calendar/calendarUtils';
import { DayDetailModal } from '@/components/calendar/DayDetailModal';
import { CalendarListView } from '@/components/calendar/CalendarListView';
import { TIME_TBC_LABEL } from '@/lib/time/timeToBeConfirmed';

type Flag = boolean | null | undefined;
const SHAPES: Array<[string, Flag, boolean]> = [
  ['flag true', true, false],
  ['flag false (no timed session)', false, true],
  ['flag absent (payload before the migration)', undefined, false],
  ['flag null', null, false],
];

// A date far enough ahead that the list view (which shows upcoming dates) includes it.
const Y = new Date().getFullYear() + 1;
const DAY = `${Y}-03-12`;
const row = (flag: Flag) => {
  const base = {
    event_id: 'e0000000-0000-0000-0000-000000000001', name: 'Draft Party', photo_url: [], location: 'Venue',
    instance_date: DAY, start_time: `${DAY} 20:00:00+00`, end_time: `${Y}-03-13 01:00:00+00`, is_recurring: true,
    meta_data: { music_styles: [] },
    key_times: { classes: { active: null, start: '', end: '' }, party: { active: null, start: '', end: '' } },
    type: 'party', has_party: false, has_class: false, class_start: '', class_end: '', party_start: '', party_end: '',
    city_slug: 'london-gb', cover_image_url: null, occurrence_id: 'o0000000-0000-0000-0000-000000000001',
    occurrence_starts_at: `${DAY}T20:00:00+00:00`, occurrence_ends_at: `${Y}-03-13T01:00:00+00:00`,
    city_timezone: 'Europe/London', venue_lat: null, venue_lng: null, primary_organiser_name: 'Org',
    is_cancelled: false, cancellation_reason_label: null, original_class_start: null, original_class_end: null,
    original_party_start: null, original_party_end: null, format: 'recurring', category: 'party', slug: 'draft-party',
  };
  return flag === undefined ? base : { ...base, has_timed_session: flag };
};
const items = (flag: Flag) => transformCalendarEvents([parseCalendarEventRow(row(flag) as never)]);

afterEach(cleanup);

describe.each(SHAPES)('calendar surfaces, %s', (_shape, flag, tbc) => {
  it('day popup: TBC words with no "Event" label and no clock time, else the time as before', () => {
    const { container } = render(
      <MemoryRouter>
        <DayDetailModal selectedDay={12} currentMonth={2} currentYear={Y} parentCategory="all"
          events={items(flag)} onClose={() => {}} />
      </MemoryRouter>,
    );
    const text = document.body.textContent ?? container.textContent ?? '';
    expect(text).toContain('Draft Party');
    if (tbc) {
      expect(text).toContain(TIME_TBC_LABEL);
      expect(text).not.toMatch(/Event\s*20:00/);
      expect(text).not.toContain('20:00');
    } else {
      expect(text).not.toContain(TIME_TBC_LABEL);
      expect(text).toMatch(/Event\s*20:00\s*–\s*01:00/);
    }
  });

  it('list view: TBC words instead of the default time', () => {
    render(
      <MemoryRouter>
        <CalendarListView currentMonth={2} currentYear={Y} selectedCategory="all" events={items(flag)}
          onClearFilters={() => {}} />
      </MemoryRouter>,
    );
    const text = document.body.textContent ?? '';
    expect(text).toContain('Draft Party');
    if (tbc) {
      expect(text).toContain(TIME_TBC_LABEL);
      expect(text).not.toContain('20:00');
    } else {
      expect(text).toContain('20:00');
      expect(text).not.toContain(TIME_TBC_LABEL);
    }
  });
});
