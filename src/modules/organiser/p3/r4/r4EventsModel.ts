import { addDaysToKey } from '@/lib/londonDate';
import type { P3Row } from '../data/home';
import type { R4Tone } from './r4Model';

/** One event row on the R4 Events list (board R4Events). Every line is a real read from home_v1. */
export interface R4EventRow {
  id: string;
  name: string;
  /** "Fri 20 Nov, 21:00, Soho Dance Studio"; no next date = the place alone, or null. */
  when: string | null;
  /** Second line: "Needs a place" (draft, no place), "3 dates coming up" (repeating), else null. */
  extra: string | null;
  pill: { word: string; tone: R4Tone };
}

export interface R4EventsModel {
  week: R4EventRow[];
  later: R4EventRow[];
  past: R4EventRow[];
  /** Nothing at all on this page. */
  empty: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Fri 20 Nov" from an ISO date key (calendar day, no time zone). */
export function shortDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAYS[dt.getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

function toneOf(key: P3Row['status']['key']): R4Tone {
  return key === 'live' ? 'ok' : key === 'warn' || key === 'review' ? 'live' : 'grey';
}

const REPEATS = new Set(['weekly', 'monthly', 'course', 'custom']);

export function r4EventRowOf(r: P3Row): R4EventRow {
  const parts = r.next ? [shortDay(r.next.date), r.nextStart ? r.nextTime : null, r.place] : [r.place];
  const when = parts.filter(Boolean).join(', ') || null;
  let extra: string | null = null;
  if (r.lifecycle === 'draft' && !r.place) extra = 'Needs a place';
  else if (!r.status.past && REPEATS.has(r.kind) && r.upcoming > 1) extra = `${r.upcoming} dates coming up`;
  return { id: r.id, name: r.name, when, extra, pill: { word: r.status.label, tone: toneOf(r.status.key) } };
}

/**
 * Board R4Events: This week (next date within 7 days), Later (further on, or not dated yet),
 * Past nights (nothing coming up and finished). Rows arrive soonest first (rowsOf).
 */
export function r4EventsOf(rows: readonly P3Row[], today: string): R4EventsModel {
  const weekEnd = /^\d{4}-\d{2}-\d{2}$/.test(today) ? addDaysToKey(today, 6) : '';
  const week: R4EventRow[] = [];
  const later: R4EventRow[] = [];
  const past: R4EventRow[] = [];
  for (const r of rows) {
    const row = r4EventRowOf(r);
    // Finished always reads as history; live-with-nothing-coming (warn) stays up top so it gets seen.
    if (r.status.key === 'finished' || (r.status.past && !r.next && r.status.key !== 'warn')) past.push(row);
    else if (r.next && weekEnd && r.next.date <= weekEnd) week.push(row);
    else later.push(row);
  }
  return { week, later, past, empty: rows.length === 0 };
}
