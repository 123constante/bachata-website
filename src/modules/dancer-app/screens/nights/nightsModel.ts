import { DANCER_TABS } from '../../shell/routes';
import { addDaysToKey, keyToUtcNoon, londonDaysBetweenKeys } from '@/lib/londonDate';

/**
 * ONE mapper for get_my_event_attendance_v2 (the read MyAttendance.tsx consumes).
 * Home and Nights both go through mapNights, so the same night reads the same on
 * both. `event_id` is the SERIES id: the event page passes it to the level vote
 * as `seriesId`, so a vote is keyed by `seriesId`, never by the occurrence date.
 */
export type AttendanceRow = {
  event_id: string;
  status: string;
  updated_at: string | null;
  name: string | null;
  occurrence_date: string | null;
  city_name: string | null;
  start_time: string | null;
  type: string | null;
  is_active?: boolean;
};

export type NightStatus = 'going' | 'interested' | 'other';

export type Night = {
  seriesId: string;
  name: string;
  /** London-calendar YYYY-MM-DD, or null when the row has no date. */
  date: string | null;
  city: string | null;
  /** HH:MM or null. */
  time: string | null;
  status: NightStatus;
  /** The status as the server said it, lower-cased (for the label of an `other`). */
  rawStatus: string;
  isFestival: boolean;
  /** Where "See event" goes (leaves the app). */
  href: string;
  past: boolean;
  /** false = the event is no longer listed (series not live): never the hero, never counted or nudged. */
  listed: boolean;
};

const NIGHTS_PATH = DANCER_TABS.find((t) => t.id === 'nights')?.path ?? '/app/nights';
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const statusOf = (raw: string): NightStatus => {
  const s = raw.toLowerCase();
  return s === 'going' || s === 'interested' ? s : 'other';
};

/**
 * Every RSVP status, in words (review S3). The live CHECK on event_attendance.status is
 * going / interested / not_going (read-only, 2026-10-15); registered / attended /
 * cancelled are the older vocabulary MyAttendance.tsx still labels. Anything else
 * says so plainly; no status ever reads "Saved".
 */
export const STATUS_LABELS: Readonly<Record<string, string>> = {
  going: 'Going',
  interested: 'Interested',
  not_going: 'Not going',
  registered: 'Registered',
  attended: 'Attended',
  cancelled: 'Cancelled',
};
export const STATUS_UNKNOWN = 'Status unknown';

export const statusLabel = (n: Pick<Night, 'status' | 'rawStatus'>): string => STATUS_LABELS[n.rawStatus] ?? STATUS_UNKNOWN;

/** The night counts as a plan: Going or Interested, and the event is still listed. */
const isPlan = (n: Night): boolean => n.listed && (n.status === 'going' || n.status === 'interested');

export const mapNight = (row: AttendanceRow, todayKey: string): Night => {
  const date = row.occurrence_date && DATE_KEY.test(row.occurrence_date.slice(0, 10)) ? row.occurrence_date.slice(0, 10) : null;
  const isFestival = (row.type ?? '').toLowerCase() === 'festival';
  return {
    seriesId: row.event_id,
    name: row.name?.trim() || 'Untitled event',
    date,
    city: row.city_name,
    time: row.start_time && /^\d{2}:\d{2}/.test(row.start_time) ? row.start_time.slice(0, 5) : null,
    status: statusOf(row.status ?? ''),
    rawStatus: (row.status ?? '').toLowerCase(),
    isFestival,
    href: isFestival ? `/festival/${row.event_id}` : `/event/${row.event_id}`,
    // A night with no date is never "past": it cannot be rated or nudged.
    past: date !== null && date < todayKey,
    listed: row.is_active !== false,
  };
};

export type MappedNights = { upcoming: Night[]; past: Night[] };

/** Upcoming soonest first (undated last); past most recent first. */
export const mapNights = (rows: readonly AttendanceRow[], todayKey: string): MappedNights => {
  const nights = rows.map((r) => mapNight(r, todayKey));
  const upcoming = nights
    .filter((n) => !n.past)
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.name.localeCompare(b.name));
  const past = nights.filter((n) => n.past).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return { upcoming, past };
};

/** The hero: the next upcoming night the person is Going to or Interested in. */
export const nextNight = (upcoming: readonly Night[]): Night | null =>
  upcoming.find((n) => n.date !== null && isPlan(n)) ?? null;

/** Going + Interested upcoming count (the Home tile). */
export const countCommitted = (upcoming: readonly Night[]): number =>
  upcoming.filter(isPlan).length;

export const NUDGE_WINDOW_DAYS = 7;

/**
 * Past nights the person was Going to within the last 7 days (not festivals: no
 * level vote there), most recent first, one per series. Whether the series is
 * already rated is read per series by the nudge (useSeriesLevelRating).
 */
export const nudgeCandidates = (past: readonly Night[], todayKey: string): Night[] => {
  const seen = new Set<string>();
  const out: Night[] = [];
  for (const n of past) {
    if (n.status !== 'going' || !n.listed || n.isFestival || n.date === null || seen.has(n.seriesId)) continue;
    const ago = londonDaysBetweenKeys(n.date, todayKey);
    if (ago < 1 || ago > NUDGE_WINDOW_DAYS) continue;
    seen.add(n.seriesId);
    out.push(n);
  }
  return out;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type DateParts = { weekday: string; day: number; month: string };

export const dateParts = (key: string): DateParts => {
  const d = new Date(keyToUtcNoon(key));
  return { weekday: DAYS[d.getUTCDay()], day: d.getUTCDate(), month: MONTHS[d.getUTCMonth()] };
};

/** "Sat 18 Oct" */
export const shortDate = (key: string | null): string => {
  if (!key) return 'Date to be confirmed';
  const p = dateParts(key);
  return `${p.weekday} ${p.day} ${p.month}`;
};

/** "in 4 days", "tonight", "tomorrow". */
export const inDaysLabel = (key: string, todayKey: string): string => {
  const n = londonDaysBetweenKeys(todayKey, key);
  if (n <= 0) return 'tonight';
  if (n === 1) return 'tomorrow';
  return `in ${n} days`;
};

/** "Camden \u00B7 21:00" with whatever is known. */
export const placeAndTime = (n: Pick<Night, 'city' | 'time'>): string =>
  [n.city, n.time].filter(Boolean).join(' \u00B7 ');

/** /app/nights with one series focused (the Home nudge's target). */
export const nightsPath = (focusSeriesId?: string): string =>
  focusSeriesId ? `${NIGHTS_PATH}?focus=${encodeURIComponent(focusSeriesId)}` : NIGHTS_PATH;

export { addDaysToKey };
