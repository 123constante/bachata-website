// Pure, client-free view model for the organiser home (Lever 2 W2, mockup
// 01-B with 01-C's attention notice). Input is organiser_home_v1's JSON.

export interface HomeDate {
  occurrence_id: string;
  /** Plain London calendar date, YYYY-MM-DD. */
  occurrence_date: string;
  lifecycle_status: string;
  /** London wall-clock time stored as if UTC (ADR-002 "local-as-Z"). */
  materialised_start_utc: string | null;
  has_own_changes: boolean;
}

export interface HomeDecision {
  action: string;
  to_state: string | null;
  reason: string | null;
  created_at: string;
}

export interface HomeSeriesFull {
  id: string;
  name: string;
  slug: string | null;
  format: string | null;
  category: string | null;
  lifecycle_status: string;
  default_local_start_time: string | null;
  /** The event's cover; null drives the D6 `no_cover` row. */
  default_cover_image_url: string | null;
  /** When the series was created (timestamptz); a draft older than 7 days is a D6 row. */
  created_at: string;
  /** SCHEDULED dates from today (home_v1 v2, R3-3): a cancelled date is not counted. */
  upcoming_count: number;
  /** Cancelled dates from today (R3-3): what C45 "Put it back" can offer. */
  cancelled_upcoming_count: number;
  /** The first scheduled dates from today (home_v1 returns 3). */
  next_dates: HomeDate[];
  latest_decision: HomeDecision | null;
}

/**
 * THE archived predicate (R3-4): every consumer of the home payload filters
 * series through this one function, so an archived series is never a row,
 * a chip or a count anywhere. organiser_home_v1 v2 also drops them server-side.
 */
export const isListedSeries = (s: { lifecycle_status: string }): boolean => s.lifecycle_status !== 'archived';

/**
 * HH:MM of a local-as-Z timestamp. The digits ARE London wall-clock time, so
 * they are read straight off the string; converting through a time zone
 * would shift them by the UTC offset (an hour in summer).
 */
export function localAsZTime(iso: string | null | undefined): string | null {
  const match = iso?.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "Tue 6 Oct" for a London calendar date, with the year when it is not
 * today's year ("Wed 6 Oct 2027"), so a date a year away never reads as this
 * one. An unknown `today` ('') always shows the year.
 */
export function calendarDate(date: string, today: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const year = String(y) === today.slice(0, 4) ? '' : ` ${y}`;
  return `${WEEKDAY[day]} ${d} ${MONTH[m - 1]}${year}`;
}

/** calendarDate, or "Tonight" for today's date. */
export function dateLabel(date: string, today: string): string {
  return date === today ? 'Tonight' : calendarDate(date, today);
}

export const isCancelled = (date: HomeDate) => date.lifecycle_status === 'cancelled';

export type AttentionKind = 'cancelled' | 'tonight';

export interface AttentionItem {
  kind: AttentionKind;
  seriesId: string;
  text: string;
}

/**
 * What needs the organiser now: a cancelled upcoming date (dancers see it),
 * then tonight's date. (Everything is live (D4): there is no review step.)
 */
export function attentionItems(series: HomeSeriesFull[], today: string): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const s of series.filter(isListedSeries)) {
    for (const d of s.next_dates) {
      if (isCancelled(d)) {
        items.push({
          kind: 'cancelled',
          seriesId: s.id,
          text: `"${s.name}" on ${dateLabel(d.occurrence_date, today)} is cancelled. Dancers see the cancellation.`,
        });
      }
    }
  }
  for (const s of series.filter(isListedSeries)) {
    const tonight = s.next_dates.find((d) => d.occurrence_date === today && !isCancelled(d));
    if (tonight && s.lifecycle_status === 'live') {
      const time = localAsZTime(tonight.materialised_start_utc);
      items.push({ kind: 'tonight', seriesId: s.id, text: `"${s.name}" is on tonight${time ? ` at ${time}` : ''}.` });
    }
  }
  return items;
}

