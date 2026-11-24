// Pick screen (layout A): pure grouping, search and refusal logic. No React.
import type { OpenNight } from '../model';
import { FALLBACK_TITLE, type PickRefusal } from './pickCopy';

export type PickDate = { occurrenceId: string; label: string; night: OpenNight };
export type PickEvent = {
  key: string; title: string; venueName: string | null; posterUrl: string | null; dates: PickDate[];
};
export type PickSelection = { eventKey: string; occurrenceId: string } | null;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'Thursday 26 Nov' from a London-local 'YYYY-MM-DDTHH:MM:SS'. No time, no zone conversion. */
export function formatPickDate(startLocal: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(startLocal);
  if (!m) return '';
  const wd = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  return `${WEEKDAYS[wd]} ${+m[3]} ${MONTHS[+m[2] - 1]}`;
}

/** A night with no public_event_id is its own one-date event (keyed by its occurrence). */
export const eventKeyOf = (n: OpenNight): string => n.publicEventId ?? `occ:${n.occurrenceId}`;

export function groupNights(nights: OpenNight[]): PickEvent[] {
  const byKey = new Map<string, PickEvent>();
  for (const n of nights) {
    const key = eventKeyOf(n);
    let ev = byKey.get(key);
    if (!ev) {
      ev = { key, title: n.title || FALLBACK_TITLE, venueName: n.venueName, posterUrl: n.posterUrl, dates: [] };
      byKey.set(key, ev);
    }
    ev.dates.push({ occurrenceId: n.occurrenceId, label: formatPickDate(n.startLocal), night: n });
  }
  for (const ev of byKey.values()) ev.dates.sort((a, b) => a.night.startLocal.localeCompare(b.night.startLocal));
  return [...byKey.values()];
}

export function filterEvents(events: PickEvent[], q: string): PickEvent[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return events;
  return events.filter((e) => `${e.title} ${e.venueName ?? ''}`.toLowerCase().includes(needle));
}

/** One-off event: its only date is chosen for the person. */
export const autoSelection = (ev: PickEvent): PickSelection =>
  ev.dates.length === 1 ? { eventKey: ev.key, occurrenceId: ev.dates[0].occurrenceId } : null;

export function selectedNight(events: PickEvent[], sel: PickSelection): { event: PickEvent; date: PickDate } | null {
  if (!sel) return null;
  const event = events.find((e) => e.key === sel.eventKey);
  const date = event?.dates.find((d) => d.occurrenceId === sel.occurrenceId);
  return event && date ? { event, date } : null;
}

/**
 * A refused lock: what the list looks like afterwards. The selection is always cleared.
 * spot_taken / night_not_open remove that date; already_been_to_event removes the whole event;
 * honesty_required keeps the night.
 */
export function applyRefusal(nights: OpenNight[], reason: PickRefusal, refused: OpenNight): { nights: OpenNight[]; selection: PickSelection } {
  const key = eventKeyOf(refused);
  let kept = nights;
  if (reason === 'spot_taken' || reason === 'night_not_open') kept = nights.filter((n) => n.occurrenceId !== refused.occurrenceId);
  else if (reason === 'already_been_to_event') kept = nights.filter((n) => eventKeyOf(n) !== key);
  return { nights: kept, selection: null };
}
