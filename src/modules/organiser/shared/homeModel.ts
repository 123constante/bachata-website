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
  upcoming_count: number;
  next_dates: HomeDate[];
  latest_decision: HomeDecision | null;
}

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

export type AttentionKind = 'rejected' | 'in_review' | 'cancelled' | 'tonight';

export interface AttentionItem {
  kind: AttentionKind;
  seriesId: string;
  text: string;
}

/**
 * What needs the organiser now, most urgent first: a series sent back with a
 * reason, one waiting for review, a cancelled upcoming date (dancers see it),
 * and tonight's date.
 */
export function attentionItems(series: HomeSeriesFull[], today: string): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const s of series) {
    if (s.lifecycle_status === 'rejected') {
      const reason = s.latest_decision?.reason?.trim();
      items.push({ kind: 'rejected', seriesId: s.id, text: `"${s.name}" needs changes${reason ? `: ${reason}` : ''}.` });
    }
  }
  for (const s of series) {
    if (s.lifecycle_status === 'pending_review') {
      items.push({ kind: 'in_review', seriesId: s.id, text: `"${s.name}" is waiting for review, usually within a day.` });
    }
  }
  for (const s of series) {
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
  for (const s of series) {
    const tonight = s.next_dates.find((d) => d.occurrence_date === today && !isCancelled(d));
    if (tonight && s.lifecycle_status === 'live') {
      const time = localAsZTime(tonight.materialised_start_utc);
      items.push({ kind: 'tonight', seriesId: s.id, text: `"${s.name}" is on tonight${time ? ` at ${time}` : ''}.` });
    }
  }
  return items;
}

export interface OrganiserStatusView {
  /** The line under the organiser's name, or null for a live organiser. */
  note: string | null;
  tone: 'muted' | 'destructive';
  /** Offer "Send for review" (submit_organiser_profile_v1 admits draft and rejected). */
  canSendForReview: boolean;
}

/**
 * The organiser's own status on its home header (mockup 05-A): a draft or a
 * rejected organiser (after its reason) is offered "Send for review"; one in
 * review says how long the team takes.
 */
export function organiserStatusView(
  name: string,
  lifecycle: string,
  reason: string | null | undefined,
): OrganiserStatusView {
  switch (lifecycle) {
    case 'draft':
      return {
        note: `${name} is not public yet. Send it for review; once the team approves it you can add your events.`,
        tone: 'muted',
        canSendForReview: true,
      };
    case 'rejected': {
      const why = reason?.trim();
      return { note: `${name} needs changes${why ? `: ${why}` : '.'}`, tone: 'destructive', canSendForReview: true };
    }
    case 'pending_review':
      return { note: 'The team checks new organisers within a day.', tone: 'muted', canSendForReview: false };
    default:
      return { note: null, tone: 'muted', canSendForReview: false };
  }
}

// event_series_p5.category values measured on prod 2026-10-04.
export const CATEGORY_LABEL: Record<string, string> = {
  party: 'Party',
  class: 'Class',
  workshop: 'Workshop',
};
