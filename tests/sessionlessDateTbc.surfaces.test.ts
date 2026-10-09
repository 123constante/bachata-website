// @vitest-environment node
/**
 * Time to be confirmed (owner decision 2026-10-09, option B; admin migration 20261109920000).
 *
 * A date with no timed session carries the series default (the organiser-create 20:00-01:00) as
 * its start/end. The readers now say so with has_timed_session. Every public surface must then
 * show the date only with "Time to be confirmed", and never the clock time; a timed date, and a
 * payload that does not carry the flag yet (served before the migration), render exactly as before.
 *
 * Table-driven: every surface x every shape. The calendar popup and list are rendered in
 * tests/client/sessionlessDateTbcCalendar.test.tsx (jsdom). Shapes are the prod ones (read-only
 * survey 2026-10-09): the 18 draft organiser dates (no session, 20:00 for 300 min) and a live date
 * with a party session.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const rpc = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: async () => ({ data: rpc.rows, error: null }) },
}));

import { parseCalendarEventRow } from '@/integrations/supabase/eventRpcs';
import { transformCalendarEvents } from '@/components/calendar/calendarUtils';
import { buildEventPageModel } from '@/modules/event-page/buildEventPageModel';
import { parseEventPageSnapshot } from '@/modules/event-page/useEventPageQuery';
import { emptyScheduleView } from '@/modules/event-page/bento/blocks/schedule/emptyScheduleView';
import { buildGoogleCalendarUrl, buildIcs } from '@/modules/event-page/bento/utils/ics';
import {
  asWallClock,
  TIME_TBC_HINT,
  TIME_TBC_LABEL,
  allDayDateRange,
  isTimeToBeConfirmed,
  timeLabelOrTbc,
} from '@/lib/time/wallClock';

type Flag = boolean | null | undefined;
// [shape, has_timed_session on the wire, does the surface say "to be confirmed"]
const SHAPES: Array<[string, Flag, boolean]> = [
  ['date with a timed session (flag true)', true, false],
  ['date with no timed session (flag false)', false, true],
  ['payload served before the migration (flag absent)', undefined, false],
  ['flag null (unknown)', null, false],
];
const withFlag = <T extends object>(row: T, flag: Flag): T =>
  flag === undefined ? row : { ...row, has_timed_session: flag };

// get_calendar_events_v2 row for the organiser-create shape (no programme, 20:00 for 300 min).
const calendarRow = {
  event_id: 'e0000000-0000-0000-0000-000000000001', name: 'Draft Party', photo_url: [], location: 'Venue',
  instance_date: '2026-10-15', start_time: '2026-10-15 20:00:00+00', end_time: '2026-10-16 01:00:00+00',
  is_recurring: true, meta_data: { music_styles: [] },
  key_times: { classes: { active: null, start: '', end: '' }, party: { active: null, start: '', end: '' } },
  type: 'party', has_party: false, has_class: false, class_start: '', class_end: '', party_start: '', party_end: '',
  city_slug: 'london-gb', cover_image_url: null, occurrence_id: 'o0000000-0000-0000-0000-000000000001',
  occurrence_starts_at: '2026-10-15T20:00:00+00:00', occurrence_ends_at: '2026-10-16T01:00:00+00:00',
  city_timezone: 'Europe/London', venue_lat: null, venue_lng: null, primary_organiser_name: 'Org',
  is_cancelled: false, cancellation_reason_label: null, original_class_start: null, original_class_end: null,
  original_party_start: null, original_party_end: null, format: 'recurring', category: 'party', slug: 'draft-party',
};

// get_public_events_list_v2 row (ICS feed + embed).
const listRow = {
  event_id: 'e0000000-0000-0000-0000-000000000001', occurrence_id: 'o0000000-0000-0000-0000-000000000001',
  name: 'Draft Party', type: 'party', occurrence_date: '2026-10-15',
  starts_at: '2026-10-15T20:00:00+00:00', ends_at: '2026-10-16T01:00:00+00:00',
  city_slug: 'london-gb', city_name: 'London', city_timezone: 'Europe/London', venue_id: null,
  venue_name: 'Venue', venue_address: null, organiser_id: null, organiser_name: null,
  cover_image_url: null, is_recurring: true, format: 'recurring', category: 'party',
};

// event_view_p5 snapshot_compat payload (one date, no programme).
const snapshotPayload = (flag: Flag) => {
  const occ = withFlag({
    occurrence_id: 'o0000000-0000-0000-0000-000000000001',
    starts_at: '2026-10-15T20:00:00+00:00', ends_at: '2026-10-16T01:00:00+00:00', local_date: '2026-10-15',
    timezone: 'Europe/London', is_cancelled: false, cancellation_reason_label: null,
    is_live: false, is_past: false, is_upcoming: true,
    lineup: { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] },
  }, flag);
  return {
    event_id: 'e0000000-0000-0000-0000-000000000001',
    occurrence_id: occ.occurrence_id,
    event: {
      name: 'Draft Party', description: '', status: 'published', is_published: true, lifecycle_status: 'live',
      type: 'party', format: 'recurring', category: 'party', photo_urls: [], video_urls: [], music_styles: [],
      key_times: null, meta_data_public: { tickets: [], promo_codes: [] }, payment_methods: [],
      actions: { ticket_url: null, website_url: null, facebook_url: null, instagram_url: null, pricing: {} },
    },
    organisers: [], organiser_card: { slot_1: null, slot_2: null },
    occurrences: [occ], occurrence_effective: occ,
    location_default: { city: null, venue: null, timezone: 'Europe/London' },
    attendance: { going_count: 0, interested_count: 0, current_user_status: null, preview: [] },
  };
};

describe('the one mapping (src/lib/time/wallClock.ts)', () => {
  it.each(SHAPES)('%s -> to be confirmed: %s', (_shape, flag, tbc) => {
    expect(isTimeToBeConfirmed(flag)).toBe(tbc);
    expect(timeLabelOrTbc(flag, '8:00 PM')).toBe(tbc ? TIME_TBC_LABEL : '8:00 PM');
  });
  it('all-day range is the date and the next day (exclusive end), across a month end', () => {
    expect(allDayDateRange(asWallClock('2026-10-31T20:00:00+00:00'))).toEqual({ start: '20261031', end: '20261101' });
    expect(allDayDateRange(null)).toBeNull();
  });
  it('the words live in ONE place: no other source file spells them', () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = path.join(dir, f);
        if (statSync(p).isDirectory()) { if (!['__tests__', 'node_modules'].includes(f)) walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(f) || /\.test\.tsx?$/.test(f)) continue;
        if (readFileSync(p, 'utf8').includes(TIME_TBC_LABEL)) hits.push(p);
      }
    };
    walk(path.join(process.cwd(), 'src'));
    walk(path.join(process.cwd(), 'app'));
    expect(hits).toEqual([path.join(process.cwd(), 'src', 'lib', 'time', 'wallClock.ts')]);
  });
});

describe.each(SHAPES)('every surface, shape: %s', (_shape, flag, tbc) => {
  it('calendar (popup + list read CalendarEventItem.timeTbc)', () => {
    const [item] = transformCalendarEvents([parseCalendarEventRow(withFlag(calendarRow, flag) as never)]);
    expect(item.timeTbc).toBe(tbc);
    expect(item.hasParty || item.hasClass).toBe(false); // the popup's fallback row is the one that changes
  });

  const model = () => {
    const snapshot = parseEventPageSnapshot(snapshotPayload(flag));
    return buildEventPageModel({ snapshot, canEdit: false, isLoading: false, hasError: false });
  };

  it('event page: the snapshot parser carries the flag, the schedule time is withheld', () => {
    const snapshot = parseEventPageSnapshot(snapshotPayload(flag));
    expect(snapshot?.occurrenceEffective?.hasTimedSession ?? null).toBe(flag ?? null);
    const m = model();
    expect(m.schedule.timeToBeConfirmed).toBe(tbc);
    if (tbc) expect(m.schedule.timeLabel).toBeNull();
    else expect(m.schedule.timeLabel).toMatch(/8:00/);
    expect(m.schedule.dateLabel).not.toBeNull(); // the date is always shown
  });

  it('event page schedule block (emptyScheduleView): TBC with what to do, else the time', () => {
    const m = model();
    const view = emptyScheduleView({
      isLoading: false, sessionCount: 0,
      fallbackTimeLabel: m.schedule.timeLabel, timeToBeConfirmed: m.schedule.timeToBeConfirmed,
    });
    if (tbc) expect(view).toEqual({ kind: 'tbc', text: TIME_TBC_LABEL, hint: TIME_TBC_HINT });
    else expect(view.kind).toBe('time');
  });

  it('event page add-to-calendar (.ics + Google): all-day on the date, never 20:00', () => {
    const input = {
      eventId: 'e1', title: 'Draft Party', startIso: asWallClock('2026-10-15T20:00:00+00:00'),
      endIso: asWallClock('2026-10-16T01:00:00+00:00'), allDay: model().schedule.timeToBeConfirmed === true,
      timezone: 'Europe/London', description: null, locationName: null, locationAddress: null, pageUrl: 'https://x',
    };
    const ics = buildIcs(input);
    const google = new URL(buildGoogleCalendarUrl(input)).searchParams.get('dates');
    if (tbc) {
      expect(ics).toContain('DTSTART;VALUE=DATE:20261015');
      expect(ics).toContain('DTEND;VALUE=DATE:20261016');
      expect(ics).not.toMatch(/DTSTART:\d{8}T/);
      expect(google).toBe('20261015/20261016');
    } else {
      expect(ics).toContain('DTSTART:20261015T190000Z'); // 20:00 BST
      expect(google).toBe('20261015T190000Z/20261016T000000Z');
    }
  });

  it('public ICS feed (/api/ics/calendar): all-day VEVENT, no clock time', async () => {
    rpc.rows = [withFlag(listRow, flag)];
    const { loader } = await import('../app/routes/api.ics.calendar');
    const body = await (await loader({ request: new Request('https://x/api/ics/calendar') } as never)).text();
    if (tbc) {
      expect(body).toContain('DTSTART;VALUE=DATE:20261015');
      expect(body).toContain('DTEND;VALUE=DATE:20261016');
      expect(body).not.toMatch(/DTSTART:\d{8}T/);
      expect(body).toContain(TIME_TBC_LABEL);
    } else {
      expect(body).toContain('DTSTART:20261015T190000Z');
      expect(body).not.toContain(TIME_TBC_LABEL);
    }
  });

  it.each(['list', 'cards'])('embed widget, %s layout (public list cards): TBC instead of 20:00', async (layout) => {
    rpc.rows = [withFlag(listRow, flag)];
    const { loader } = await import('../app/routes/api.embed.calendar');
    const html = await (await loader({ request: new Request(`https://x/api/embed/calendar?layout=${layout}`) } as never)).text();
    expect(html).toContain('Draft Party');
    if (tbc) {
      expect(html).toContain(`<span class="time">${TIME_TBC_LABEL}</span>`);
      expect(html).not.toContain('<span class="time">20:00</span>');
    } else {
      expect(html).toContain('<span class="time">20:00</span>');
    }
  });
});
