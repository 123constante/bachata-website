import { wallClockDateKey } from '@/lib/time/wallClock';
import { eventHref } from '@/lib/seo/eventHref';
import { formatKeyDayLabel } from '@/lib/londonDate';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';

export type NextNight = {
  occurrenceId: string;
  dateKey: string;
  /** "Thursday 26 November" */
  dateLabel: string;
  href: string;
};

/** ONE builder for a night's address (`/event/<slug>?occurrenceId=<id>`), via `eventHref` (one link builder). */
export const buildNightHref = (eventKey: string, occurrenceId: string): string =>
  eventHref({ slug: eventKey, event_id: eventKey }, occurrenceId);

/**
 * The next public, NOT cancelled night of the same series after the shown night.
 * `occurrences` is the page snapshot's public nights list. A night counts only if its London date
 * is after the shown night's and not before `todayKey` (a finished night must not point at another
 * finished night). Null when there is none: the caller hides the button.
 */
export function nextPublicNight(
  occurrences: readonly EventPageSnapshotOccurrence[],
  shownOccurrenceId: string | null,
  eventKey: string | null,
  todayKey: string,
): NextNight | null {
  if (!eventKey) return null;
  const shown = occurrences.find((o) => o.occurrenceId === shownOccurrenceId);
  const shownKey = shown ? wallClockDateKey(shown.localDate ?? shown.startsAt) : null;
  let best: { o: EventPageSnapshotOccurrence; key: string } | null = null;
  for (const o of occurrences) {
    if (o.isCancelled || o.occurrenceId === shownOccurrenceId) continue;
    const key = wallClockDateKey(o.localDate ?? o.startsAt);
    if (!key || key < todayKey) continue;
    if (shownKey && key <= shownKey) continue;
    if (!best || key < best.key) best = { o, key };
  }
  if (!best) return null;
  const dateLabel = formatKeyDayLabel(best.key);
  if (!dateLabel) return null;
  return {
    occurrenceId: best.o.occurrenceId,
    dateKey: best.key,
    dateLabel,
    href: buildNightHref(eventKey, best.o.occurrenceId),
  };
}
