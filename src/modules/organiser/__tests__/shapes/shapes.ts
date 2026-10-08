// F4: the DISTINCT shapes of real organiser series, from a read-only survey of
// production (2026-10-08, counts only, see docs/organiser-rebuild/HANDOVER.md F4).
// Every name here is made up; only the SHAPE (lifecycle x format x rule x ended_on
// x how many dates, past / upcoming / cancelled, sessions, styles, nulls) is real.
// The builders return exactly what the RPCs return, so the screens run through
// their real parsers:
//  - admin_event_workspace_p5: the newest 100 dates by date DESC + meta.has_more
//  - organiser_home_v1: upcoming_count + the next 3 upcoming dates per series
import { addDaysToKey } from '@/lib/londonDate';

/** Thursday 8 Oct 2026, London. */
export const TODAY = '2026-10-08';

export type DateStatus = 'scheduled' | 'cancelled';
export interface ShapeDate { id: string; date: string; status: DateStatus }

export interface SeriesShape {
  key: string;
  /** What the survey row was (for the test name). */
  about: string;
  id: string;
  name: string;
  lifecycle: string;
  format: string;
  rule: unknown;
  endedOn: string | null;
  startDate: string | null;
  dates: ShapeDate[];
  styles: string[];
  venueId: string | null;
  venueName: string | null;
  description: string | null;
  cover: string | null;
  gallery: string[];
  videos: string[];
  /** The next upcoming date has sessions (and people on them). */
  sessionsOnNext: boolean;
}

/** `count` dates `step` days apart from `first`; ids carry the shape key. */
function run(key: string, first: string, count: number, step = 7, cancelled: (i: number) => boolean = () => false): ShapeDate[] {
  return Array.from({ length: count }, (_, i) => {
    const date = addDaysToKey(first, i * step);
    return { id: `${key}-${date}`, date, status: cancelled(i) ? 'cancelled' : 'scheduled' };
  });
}
/** `count` weekly dates on the weekday of `anchor`, ending the week before today (past only). */
const pastRun = (key: string, last: string, count: number, cancelled?: (i: number) => boolean) =>
  run(key, addDaysToKey(last, -7 * (count - 1)), count, 7, cancelled);

const weekly = (weekday: number, end: Record<string, unknown> = { kind: 'none' }, interval: number | null = 1) =>
  (interval == null ? { mode: 'weekly', weekdays: [weekday], end } : { mode: 'weekly', interval, weekdays: [weekday], end });

let n = 0;
function shape(s: Partial<SeriesShape> & Pick<SeriesShape, 'key' | 'about' | 'lifecycle' | 'format' | 'dates'>): SeriesShape {
  n += 1;
  return {
    id: `series-${s.key}`,
    name: `Test Event ${n}`,
    rule: null,
    endedOn: null,
    startDate: s.dates[0]?.date ?? null,
    styles: ['Bachata'],
    venueId: 'v1',
    venueName: 'Studio One',
    description: 'A night of dancing.',
    cover: 'https://cdn.example/cover.webp',
    gallery: [],
    videos: [],
    sessionsOnNext: true,
    ...s,
  };
}

// Saturdays: 2026-10-10 is the next one; 2026-10-03 the last past one.
const NEXT_SAT = '2026-10-10';
const LAST_SAT = '2026-10-03';

export const SHAPES: SeriesShape[] = [
  // The owner's 'Bachata Picnic' shape: ended, recurring, NO rule, ended_on set,
  // 13 past Saturdays (one cancelled), 0 upcoming, start date not on a Saturday,
  // lowercase styles incl. 'zouk' (not on the chip list).
  shape({
    key: 'ended-picnic', about: 'ended / recurring / no rule / ended_on / 13 past / 0 upcoming / lowercase styles',
    lifecycle: 'ended', format: 'recurring', endedOn: '2026-09-05', startDate: '2026-06-10',
    dates: run('ended-picnic', '2026-06-13', 13, 7, (i) => i === 4),
    styles: ['bachata', 'sensual bachata', 'salsa', 'merengue', 'kizomba', 'zouk'],
  }),
  shape({
    key: 'ended-upcoming-cancelled', about: 'ended / recurring / no rule / 40 past / 35 upcoming all cancelled',
    lifecycle: 'ended', format: 'recurring', endedOn: '2026-10-01',
    dates: [...pastRun('ended-upcoming-cancelled', LAST_SAT, 40), ...run('ended-upcoming-cancelled', NEXT_SAT, 35, 7, () => true)],
  }),
  shape({
    key: 'ended-course', about: 'ended / course / no rule / 10 past',
    lifecycle: 'ended', format: 'course', endedOn: '2026-08-04',
    dates: run('ended-course', '2026-05-26', 11, 7),
    styles: ['bachata'],
  }),
  shape({
    key: 'live-weekly-open', about: 'live / recurring / weekly, end none / 52 upcoming / 15 past / 2 cancelled',
    lifecycle: 'live', format: 'recurring', rule: weekly(6),
    dates: [...pastRun('live-weekly-open', LAST_SAT, 15, (i) => i === 3), ...run('live-weekly-open', NEXT_SAT, 52, 7, (i) => i === 2)],
    styles: ['Bachata', 'Salsa'],
  }),
  shape({
    key: 'live-weekly-over100', about: 'live / recurring / weekly, end none / 60 upcoming / 68 past (128 dates: API returns newest 100)',
    lifecycle: 'live', format: 'recurring', rule: weekly(6),
    dates: [...pastRun('live-weekly-over100', LAST_SAT, 68), ...run('live-weekly-over100', NEXT_SAT, 60)],
  }),
  shape({
    key: 'live-weekly-until', about: 'live / recurring / weekly, until_date / 6 upcoming / 3 past (the editable baseline)',
    lifecycle: 'live', format: 'recurring', rule: weekly(6, { kind: 'until_date', date: addDaysToKey(NEXT_SAT, 35) }),
    startDate: addDaysToKey(LAST_SAT, -14),
    dates: [...pastRun('live-weekly-until', LAST_SAT, 3), ...run('live-weekly-until', NEXT_SAT, 6)],
  }),
  shape({
    key: 'live-weekly-aftercount', about: 'live / recurring / weekly, after_count 16 / 10 upcoming / 6 past',
    lifecycle: 'live', format: 'recurring', rule: weekly(6, { kind: 'after_count', count: 16 }),
    dates: [...pastRun('live-weekly-aftercount', LAST_SAT, 6), ...run('live-weekly-aftercount', NEXT_SAT, 10)],
  }),
  shape({
    key: 'draft-weekly-nointerval', about: 'draft / recurring / weekly without an interval key / 35 upcoming / 2 past',
    lifecycle: 'draft', format: 'recurring', rule: weekly(6, { kind: 'none' }, null),
    dates: [...pastRun('draft-weekly-nointerval', LAST_SAT, 2), ...run('draft-weekly-nointerval', NEXT_SAT, 35)],
  }),
  shape({
    key: 'pending-weekly', about: 'in review / recurring / weekly, end none / 40 upcoming / 0 past / no sessions, no cover, null description',
    lifecycle: 'pending_review', format: 'recurring', rule: weekly(6),
    dates: run('pending-weekly', NEXT_SAT, 40), sessionsOnNext: false, cover: null, description: null, styles: [],
  }),
  shape({
    key: 'paused-weekly', about: 'paused / recurring / weekly, end none / 40 upcoming / 30 past / 1 cancelled',
    lifecycle: 'paused', format: 'recurring', rule: weekly(6),
    dates: [...pastRun('paused-weekly', LAST_SAT, 30, (i) => i === 9), ...run('paused-weekly', NEXT_SAT, 40)],
  }),
  shape({
    key: 'live-monthly-nth', about: 'live / recurring / monthly, first Friday, end none / 12 upcoming / 4 past',
    lifecycle: 'live', format: 'recurring', rule: { mode: 'monthly', interval: 1, monthly: { kind: 'nth_weekday', nth: 1, weekday: 5 }, end: { kind: 'none' } },
    dates: [
      ...['2026-06-05', '2026-07-03', '2026-08-07', '2026-09-04'].map((date) => ({ id: `live-monthly-nth-${date}`, date, status: 'scheduled' as const })),
      ...['2026-11-06', '2026-12-04', '2027-01-01', '2027-02-05', '2027-03-05', '2027-04-02', '2027-05-07', '2027-06-04', '2027-07-02', '2027-08-06', '2027-09-03', '2027-10-01']
        .map((date) => ({ id: `live-monthly-nth-${date}`, date, status: 'scheduled' as const })),
    ],
  }),
  shape({
    key: 'archived-monthly-dom', about: 'archived / recurring / monthly, day 18, after_count / 0 upcoming / 5 past',
    lifecycle: 'archived', format: 'recurring', rule: { mode: 'monthly', interval: 1, monthly: { kind: 'day_of_month', day: 18 }, end: { kind: 'after_count', count: 5 } },
    dates: ['2026-04-18', '2026-05-18', '2026-06-18', '2026-07-18', '2026-08-18'].map((date) => ({ id: `archived-monthly-dom-${date}`, date, status: 'scheduled' as const })),
  }),
  shape({
    key: 'live-custom', about: 'live / recurring / custom dates rule / 2 upcoming / 1 past',
    lifecycle: 'live', format: 'recurring', rule: { mode: 'custom', dates: ['2026-10-17', '2026-10-31'] },
    dates: ['2026-09-19', '2026-10-17', '2026-10-31'].map((date) => ({ id: `live-custom-${date}`, date, status: 'scheduled' as const })),
  }),
  shape({
    key: 'live-norule-few', about: 'live / recurring / NO rule (dates added one by one) / 3 upcoming / 5 past / 1 cancelled',
    lifecycle: 'live', format: 'recurring',
    dates: [...pastRun('live-norule-few', LAST_SAT, 5, (i) => i === 1), ...run('live-norule-few', NEXT_SAT, 3)],
  }),
  shape({
    key: 'live-norule-cancelled-only', about: 'live / recurring / NO rule / 2 upcoming, both cancelled / 8 past',
    lifecycle: 'live', format: 'recurring',
    dates: [...pastRun('live-norule-cancelled-only', LAST_SAT, 8), ...run('live-norule-cancelled-only', NEXT_SAT, 2, 7, () => true)],
  }),
  shape({
    key: 'live-norule-lapsed', about: 'live / recurring / NO rule / 0 upcoming / 6 past / 1 cancelled',
    lifecycle: 'live', format: 'recurring',
    dates: pastRun('live-norule-lapsed', LAST_SAT, 6, (i) => i === 0),
  }),
  shape({
    key: 'live-oneoff-past', about: 'live / one_off / 1 past / 0 upcoming',
    lifecycle: 'live', format: 'one_off', dates: [{ id: 'live-oneoff-past-1', date: '2026-09-12', status: 'scheduled' }],
  }),
  shape({
    key: 'live-oneoff-upcoming', about: 'live / one_off / 1 upcoming (prod: draft and live one_offs with a date)',
    lifecycle: 'live', format: 'one_off', dates: [{ id: 'live-oneoff-upcoming-1', date: '2026-11-14', status: 'scheduled' }],
  }),
  shape({
    key: 'live-course', about: 'live / course / weekly rule / 4 upcoming / 6 past',
    lifecycle: 'live', format: 'course', rule: weekly(2, { kind: 'after_count', count: 10 }),
    dates: [...pastRun('live-course', '2026-10-06', 6), ...run('live-course', '2026-10-13', 4)],
  }),
  shape({
    key: 'live-festival', about: 'live / festival / no rule / 3 upcoming days in a row',
    lifecycle: 'live', format: 'festival', dates: run('live-festival', '2026-11-20', 3, 1),
  }),
  shape({
    key: 'archived-oneoff-empty', about: 'archived / one_off / 0 dates / null venue / null description',
    lifecycle: 'archived', format: 'one_off', dates: [], venueId: null, venueName: null, description: null, cover: null, sessionsOnNext: false, styles: [],
  }),
  shape({
    key: 'archived-norule-past', about: 'archived / recurring / no rule / 0 upcoming / 9 past',
    lifecycle: 'archived', format: 'recurring', dates: pastRun('archived-norule-past', LAST_SAT, 9),
  }),
];

export const shapeByKey = (key: string) => {
  const s = SHAPES.find((x) => x.key === key);
  if (!s) throw new Error(`no shape ${key}`);
  return s;
};

export const upcomingOf = (s: SeriesShape) => s.dates.filter((d) => d.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date));
export const pastOf = (s: SeriesShape) => s.dates.filter((d) => d.date < TODAY);

/** admin_event_workspace_p5 exactly as the server builds it (newest 100, date DESC). */
export function workspaceOf(s: SeriesShape) {
  const sorted = [...s.dates].sort((a, b) => b.date.localeCompare(a.date));
  const page = sorted.slice(0, 100);
  return {
    series: {
      series: {
        id: s.id, name: s.name, slug: s.key, format: s.format, category: 'party', type: 'party',
        lifecycle_status: s.lifecycle, version: 5, default_venue_id: s.venueId, default_city_id: 'c1',
        default_local_start_time: '20:00:00', default_duration: '04:00:00', default_level: null,
        default_ticket_url: null, default_description: s.description, default_cover_image_url: s.cover,
        default_start_date: s.startDate, instagram_url: null, passes: null, created_at: '2026-01-01T00:00:00Z',
        recurrence_rule: s.rule, removed_dates: [], default_music_styles: s.styles, gallery: s.gallery,
        video_urls: s.videos, ended_on: s.endedOn, is_template: false,
      },
      program: [],
    },
    occurrences: page.map((d) => ({
      id: d.id, occurrence_date: d.date, lifecycle_status: d.status, version: 1, has_override: d.status === 'cancelled',
      session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: `${d.date}T20:00:00Z`, updated_at: null,
    })),
    meta: { version: 5, generated_at: `${TODAY}T09:00:00Z`, has_more: sorted.length > 100, total_loaded: page.length },
  };
}

/** One series row of organiser_home_v1. */
export function homeSeriesOf(s: SeriesShape) {
  const up = upcomingOf(s);
  return {
    id: s.id, name: s.name, slug: s.key, format: s.format, category: 'party', lifecycle_status: s.lifecycle, version: 5,
    default_city_id: 'c1', default_venue_id: s.venueId, default_venue_name: s.venueName, default_local_start_time: '20:00:00',
    default_cover_image_url: s.cover, updated_at: null, upcoming_count: up.length, latest_decision: null,
    next_dates: up.slice(0, 3).map((d) => ({
      occurrence_id: d.id, occurrence_date: d.date, lifecycle_status: d.status, materialised_start_utc: `${d.date}T20:00:00Z`,
      version: 1, has_own_changes: false, venue_id: s.venueId, venue_name: s.venueName, cancellation_reason_label: d.status === 'cancelled' ? 'Illness' : null,
    })),
  };
}

export function homeOf(shapes: SeriesShape[]) {
  return {
    generated_at: `${TODAY}T09:00:00Z`, today: TODAY, user_id: 'u1',
    organisers: [{
      id: 'org1', name: 'Test Organiser', slug: 'test-organiser', avatar_url: null, city_id: 'c1', lifecycle_status: 'live',
      role: 'owner', is_primary: true, joined_at: null, latest_decision: null, team: [], series: shapes.map(homeSeriesOf),
    }],
  };
}

/** organiser_get_occurrence_programme_v1 for one date of a shape, as the server answers it. */
export function programmeOf(s: SeriesShape, d: ShapeDate, withSessions = s.sessionsOnNext) {
  const closed = s.lifecycle === 'ended' || s.lifecycle === 'archived';
  const reason = closed ? 'series_closed' : d.status === 'cancelled' ? 'date_cancelled' : d.date < TODAY ? 'past_date' : null;
  return {
    occurrence_id: d.id, series_id: s.id, occurrence_date: d.date, version: 3, editable: reason === null, not_editable_reason: reason,
    sessions: withSessions ? [
      { series_item_id: 'i1', type: 'class', title: 'Beginners', start_time: '20:00', end_time: '21:00', ends_next_day: false, level_keys: ['beginner'], removed: false },
      { series_item_id: 'i2', type: 'party', title: 'Party', start_time: '21:00', end_time: '23:30', ends_next_day: false, level_keys: [], removed: false },
    ] : [],
    session_people: withSessions ? [
      { series_item_id: 'i1', people: [{ profile_id: 'p1', display_name: 'Teacher One', role: 'teaching' }] },
      { series_item_id: 'i2', people: [{ profile_id: 'p2', display_name: 'DJ Two', role: 'djing' }] },
    ] : [],
  };
}

/** event_view_p5 (occurrence target, organiser role) for one date. */
export function dateViewOf(s: SeriesShape, d: ShapeDate) {
  return {
    occurrence: { id: d.id, date: d.date, version: 1, lifecycle_status: d.status, materialised_start_utc: `${d.date}T20:00:00Z` },
    event: { venue_id: s.venueId, cancellation_reason_label: d.status === 'cancelled' ? 'Illness' : null },
    schedule: {},
  };
}

export const VENUES = [
  { id: 'v1', name: 'Studio One', neighbourhood: 'Soho', city_name: 'London', address: null, postcode: null },
  { id: 'v2', name: 'Salsa Hall', neighbourhood: 'Leith', city_name: 'Edinburgh', address: null, postcode: null },
];

/** The lifecycle words every screen must agree on (the old module's labels). */
export const LIFECYCLE_WORD: Record<string, string> = {
  draft: 'Draft', pending_review: 'In review', live: 'Live', rejected: 'Changes needed', paused: 'Paused', ended: 'Ended', archived: 'Archived',
};
