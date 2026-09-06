// The venue panel's content: what a pin on the map page actually contains.
//
// MEASURED, and it is the whole reason this file exists rather than a list of
// dated rows: 29 venues, median 13 occurrences each, but 19 of 29 run exactly
// ONE distinct event. Sway Bar's 39 occurrences are 3 nights repeating. A panel
// listing occurrences shows 39 rows that say the same three things; a panel
// listing NIGHTS shows three.
//
// Pure module, no React and no DOM -- the same split mapListDerivations was
// extracted for, so the arithmetic can be tested without mounting anything.

import type { MapEvent, MapCategory } from './mapTypes';
import { deriveCategory, formatTime } from './mapTypes';
import { weekdayOfKey, londonDaysBetweenKeys } from '@/lib/londonDate';

// Plural weekday names. mapListDerivations has a singular WEEKDAYS array and
// londonDate has none; neither is exported, and a night's pattern wants the
// plural ("Fridays"), so this is its own list rather than a suffix rule.
const WEEKDAY_PLURAL = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
];

// Singular weekday names and short months, for dateLabel below. Weekdays are
// spelled in FULL per the house copy rule ("Friday", never "Fri"); months stay
// short, because the rule is about weekdays and "11 September" costs a line
// wrap in a list cell that "11 Sep" does not.
const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * '11 Sep', or 'Friday 11 Sep' when the weekday is worth saying.
 *
 * Built from the key's own parts, never `new Date('2026-09-13')` -- that parses
 * as UTC midnight and prints the previous weekday for a London date once BST
 * puts the browser an hour ahead. weekdayOfKey is the sanctioned helper and is
 * UTC-noon anchored for exactly this reason.
 */
export function dateLabel(key: string, withWeekday: boolean): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return '';
  const day = Number(m[3]);
  const month = MONTHS_SHORT[Number(m[2]) - 1] ?? '';
  const stem = `${day} ${month}`.trim();
  return withWeekday ? `${WEEKDAYS[weekdayOfKey(key)]} ${stem}` : stem;
}

/**
 * Rounded-coordinate key at the same ~11m precision dedupePins and
 * groupPinsByLocation use, so a venue identified on the map resolves to the
 * same rows here.
 *
 * There is no venue_id on get_map_events_v1 -- coordinate + venue_name IS the
 * venue identity in this layer, and every venue-shaped grouping in the module
 * agrees on that key by construction rather than by comment.
 */
export const venueCoordKey = (
  lat: number | null | undefined,
  lng: number | null | undefined,
): string => `${lat?.toFixed(4) ?? ''},${lng?.toFixed(4) ?? ''}`;

/** One regular night at a venue: an event, its rhythm, and its next date. */
export interface VenueNight {
  eventId: string;
  name: string;
  category: MapCategory;
  /** 'Fridays' | 'Fortnightly' | 'Monthly' | 'Occasional' | 'One-off'. */
  pattern: string;
  /** The pattern IS a weekday name. Carried as data rather than left for the
   *  renderer to infer by string-matching the label: the panel drops the
   *  weekday from the date when the pattern already says it ('Fridays . next
   *  11 Sep' beats 'Fridays . next Friday 11 Sep'), and a string test would
   *  quietly stop working the day a label is reworded. */
  isWeekly: boolean;
  /** 'YYYY-MM-DD' of the next upcoming date, or the latest PAST one when the
   *  loaded window holds nothing upcoming. Never null: a night is built from
   *  its dates, so one with no dates cannot exist. */
  nextDate: string;
  /** occurrence_id of nextDate's row -- what /event/:id?occurrenceId= needs. */
  nextOccId: string;
  /** Wall-clock start of nextDate's row, house-formatted ('9:00pm'), or null. */
  time: string | null;
  /** Distinct dates for this event inside the loaded window. */
  dateCount: number;
  /** nextDate's row is cancelled. */
  isCancelled: boolean;
}

export interface VenueNightsArgs {
  /** event_ids at this venue-coordinate (a LocationGroup's members). */
  eventIds: Set<string>;
  /** venueCoordKey of the group whose pin was tapped. */
  coordKey: string;
  /** London day key. 'Next' is measured from here, never from Date.now(). */
  today: string;
}

/**
 * The pattern a set of dates falls into, decided by the MEDIAN gap between
 * consecutive dates.
 *
 * A mean is skewed by one long break: a Friday night that goes dark for August
 * reads as 'Monthly' on a mean and 'Fridays' on a median, and the median is the
 * one a human would give. The weekday is taken from nextDate rather than from
 * the modal weekday so the label and the date beside it can never disagree --
 * a night that moved from Fridays to Saturdays last month says 'Saturdays'
 * next to a Saturday.
 */
function patternOf(dates: string[], nextDate: string): { pattern: string; isWeekly: boolean } {
  if (dates.length <= 1) return { pattern: 'One-off', isWeekly: false };
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    gaps.push(londonDaysBetweenKeys(dates[i - 1], dates[i]));
  }
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (median <= 8) {
    return { pattern: WEEKDAY_PLURAL[weekdayOfKey(nextDate)], isWeekly: true };
  }
  if (median <= 16) return { pattern: 'Fortnightly', isWeekly: false };
  if (median <= 45) return { pattern: 'Monthly', isWeekly: false };
  return { pattern: 'Occasional', isWeekly: false };
}

/**
 * The regular nights at one venue-coordinate, soonest first.
 *
 * TAKES RAW ROWS, NOT PINS. dedupePins has already collapsed every event to a
 * single soonest day by the time it produces `pins`, so a LocationGroup's
 * members carry no recurrence information at all -- deriving a pattern from
 * them would give every night in the city 'One-off'. The caller passes
 * useMapEvents' unfiltered rows and names the venue with (eventIds, coordKey).
 */
export function regularNights(rows: MapEvent[], a: VenueNightsArgs): VenueNight[] {
  const byEvent = new Map<string, MapEvent[]>();
  for (const r of rows) {
    if (!a.eventIds.has(r.event_id)) continue;
    // Coord guard. One event_id can run at two venues, and the pin that opened
    // this panel is ONE of them; without this the other venue's dates would be
    // listed, and dated, under this venue's heading.
    if (venueCoordKey(r.lat, r.lng) !== a.coordKey) continue;
    if (!r.instance_date) continue;
    const arr = byEvent.get(r.event_id);
    if (arr) arr.push(r);
    else byEvent.set(r.event_id, [r]);
  }

  const nights: VenueNight[] = [];
  for (const [eventId, occ] of byEvent) {
    // One row per DATE before any arithmetic. A festival's multi-row day, or a
    // duplicate occurrence, would otherwise contribute a zero-day gap and drag
    // the median down to 'weekly' for a night that is nothing of the kind.
    const byDate = new Map<string, MapEvent>();
    for (const o of occ) {
      const key = o.instance_date as string;
      const prev = byDate.get(key);
      // Live-wins on a doubled date, matching pickLiveRep: a cancelled row must
      // not become the face of a date that also has a live one.
      if (!prev || (prev.is_cancelled && !o.is_cancelled)) byDate.set(key, o);
    }
    const dates = [...byDate.keys()].sort();
    // Dates are 'YYYY-MM-DD', so a lexical >= IS a calendar >= -- the same
    // comparison homeStats and tonightEvents make.
    const nextDate = dates.find((d) => d >= a.today) ?? dates[dates.length - 1];
    const row = byDate.get(nextDate) as MapEvent;
    const { pattern, isWeekly } = patternOf(dates, nextDate);
    nights.push({
      eventId,
      name: row.name,
      category: deriveCategory(row),
      pattern,
      isWeekly,
      nextDate,
      nextOccId: row.occurrence_id,
      time: formatTime(row.start_time) || null,
      dateCount: dates.length,
      isCancelled: row.is_cancelled,
    });
  }

  // Soonest first, then name. The name tiebreak is not cosmetic: a panel can be
  // closed and reopened, and two nights sharing a date would otherwise swap
  // places between openings on Map iteration order alone.
  return nights.sort(
    (x, y) => x.nextDate.localeCompare(y.nextDate) || x.name.localeCompare(y.name),
  );
}
