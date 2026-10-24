import { DANCER_TABS } from '../../shell/routes';
import { keyToUtcNoon, londonDaysBetweenKeys } from '@/lib/londonDate';

/**
 * The PURE half of the nights model: dates, the nights path and the switch-off
 * line. No going import on purpose -- the /app/* first load (Home's lineup and
 * date blocks, the switch-off Nights screen) reads these, and the going module
 * must stay out of that load while the going switch is off (perf-budgets.json,
 * dancer-app row). nightsModel.ts re-exports everything here.
 */

/** The nights screens' title while the going switch is off (nothing about going renders then). */
export const NIGHTS_OFF_LINE = 'No nights to show yet.';

const NIGHTS_PATH = DANCER_TABS.find((t) => t.id === 'nights')?.path ?? '/app/nights';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type DateParts = { weekday: string; fullWeekday: string; day: number; month: string };

export const dateParts = (key: string): DateParts => {
  const d = new Date(keyToUtcNoon(key));
  return { weekday: DAYS[d.getUTCDay()], fullWeekday: FULL_DAYS[d.getUTCDay()], day: d.getUTCDate(), month: MONTHS[d.getUTCMonth()] };
};

/** "Saturday 18 Oct" (D119: the weekday is always spelled out). */
export const fullDate = (key: string | null): string => {
  if (!key) return 'Date to be confirmed';
  const p = dateParts(key);
  return `${p.fullWeekday} ${p.day} ${p.month}`;
};

/** Kept for the callers that already import it; the weekday is spelled out now (D119). */
export const shortDate = fullDate;

/** "in 4 days", "tonight", "tomorrow". */
export const inDaysLabel = (key: string, todayKey: string): string => {
  const n = londonDaysBetweenKeys(todayKey, key);
  if (n <= 0) return 'tonight';
  if (n === 1) return 'tomorrow';
  return `in ${n} days`;
};

/** "Thursday 29 Oct \u00B7 9 PM \u00B7 Camden Club" with whatever is known. */
export const placeAndTime = (n: { when: string | null; date: string | null; venue: string | null }): string =>
  [n.when ?? (n.date ? fullDate(n.date) : null), n.venue].filter(Boolean).join(' \u00B7 ');

/** /app/nights with one series focused (the Home nudge's target). */
export const nightsPath = (focusSeriesId?: string | null): string =>
  focusSeriesId ? `${NIGHTS_PATH}?focus=${encodeURIComponent(focusSeriesId)}` : NIGHTS_PATH;

