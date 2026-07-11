import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';
import { wallClockToInstant } from '@/lib/time/wallClock';

// 6h grace period so an event that just finished doesn't immediately flip to
// "ended" (punters may still be socialising; the page stays interactive).
const PAST_GRACE_MS = 6 * 3600 * 1000;

/**
 * True when the effective occurrence finished more than 6 hours ago.
 *
 * Multi-day behaviour: `ends_at` on a multi-day occurrence is the END of the
 * full span (e.g. Monday 03:00 for a Fri→Mon weekender), so this naturally
 * waits until 6h after the last day finishes before flipping past.
 */
export const isPast = (occurrence: EventPageSnapshotOccurrence | null): boolean => {
  if (!occurrence) return false;
  const anchor = occurrence.endsAt ?? occurrence.startsAt;
  if (!anchor) return false;
  // Compare the TRUE instant the wall clock denotes (via the event tz) against
  // real now -- naive Date.parse treated the naive stamp as UTC and flipped
  // "past" an hour late all BST season.
  const t = wallClockToInstant(anchor, occurrence.timezone ?? 'Europe/London');
  if (!t) return false;
  return t.getTime() + PAST_GRACE_MS < Date.now();
};