import { clampRangeEndKey, isRealDateKey, londonDaysBetweenKeys } from '@/lib/londonDate';

/**
 * How much do we know about whether this festival is cancelled?
 *
 * Three states, not two. The page learns cancellation from the festival-snapshot
 * query, which is separate from the query supplying the dates — so "not cancelled"
 * and "we haven't been told yet" are genuinely different, and so is "we will never
 * be told" (the query errored, or never ran).
 *
 *  - `known`       the fact arrived. Trust `isCancelled`.
 *  - `pending`     still in flight. Assert nothing at all.
 *  - `unknowable`  the query failed or never ran. We will not learn it.
 */
export type CancellationState = 'known' | 'pending' | 'unknowable';

export type HeroDayStatus = { label: string } | null;

export interface HeroDayStatusInput {
  /** Festival start as a 'YYYY-MM-DD' key on the festival's own calendar. */
  startKey: string | null | undefined;
  /** Festival end key; may be absent, reversed or absurd — clamped below. */
  endKey: string | null | undefined;
  /** Today's key on the festival's calendar (from `useTodayKey(eventTz)`). */
  todayKey: string | null | undefined;
  isCancelled: boolean;
  cancellationState: CancellationState;
  /** Series-termination arc W14: the SERIES has stopped for good
   *  (event_series_p5.lifecycle_status = 'ended'). Optional, and absent means
   *  false -- every caller that does not know about ended behaves as before. */
  isEnded?: boolean;
}

/**
 * The festival hero's timing line: "Tomorrow" / "In N days" / "Today" /
 * "Happening now", or nothing.
 *
 * EXTRACTED AND PURE ON PURPOSE. This predicate was rewritten three times in three
 * consecutive commits — each fixing the last — while living inline in a `useMemo`
 * that no test could reach. The two states that actually broke it (query pending,
 * query errored) are exactly the two a browser pass never exercises. It takes the
 * keys and the cancellation state as arguments and reads no clock, so the whole
 * matrix is assertable in the unit gate.
 *
 * WHY `unknowable` IS NOT THE SAME AS `known`. When the snapshot query fails,
 * `isCancelled` is false purely because no data arrived — a CANCELLED festival is
 * indistinguishable from a healthy one. Treating that as "known" would render
 * "Happening now" over a cancelled festival with no banner anywhere on the page to
 * contradict it, which is the precise failure the guard was added to prevent.
 *
 * WHY IT IS NOT THE SAME AS `pending` EITHER. Holding the line shut forever on a
 * failed query blanked the hero permanently on healthy festivals whose dates had
 * loaded fine. So the two branches are split by how much damage a wrong answer does:
 *
 *  - Pre-start labels ("Tomorrow", "In 3 days", "Today") restate a DATE that the
 *    detail query already supplied and the page already renders. They make no claim
 *    about the event running, so they survive `unknowable`.
 *  - "Happening now" asserts the festival is running RIGHT NOW. That is the claim
 *    that puts someone on a train to a cancelled event, so it requires `known`.
 */
export const computeHeroDayStatus = ({
  startKey,
  endKey,
  todayKey,
  isCancelled,
  cancellationState,
  isEnded = false,
}: HeroDayStatusInput): HeroDayStatus => {
  // A cancelled festival makes no timing claim at all. Without this, a cancelled
  // mid-run festival rendered "Happening now" directly above its own cancellation
  // banner. The countdown this replaced hid itself once the start passed, so it
  // never contradicted the banner; a day-status line runs the whole event and does.
  if (isCancelled) return null;
  // Nor does one that has ENDED, and for the same reason one line up (arc W14).
  //
  // This is not covered by the past-date branches below, and the gap is
  // REACHABLE rather than theoretical. The keys this function reads come from
  // get_public_festival_detail_v2's span, which _p5_festival_span_v1 derives from
  // event_series_program_day_p5 -- the PROGRAMME days. The arc's P5a constraint
  // trigger stops an ended series holding a future scheduled OCCURRENCE; it says
  // nothing about programme days, so an ended festival whose programme still
  // reads forward lands in `daysUntil > 0` and prints "In 20 days" directly above
  // a record card saying it has finished. Observed exactly that way while
  // browser-testing W14.
  //
  // Deliberately ABOVE the key validation: this is a claim we decline to make,
  // not a computation we cannot perform.
  if (isEnded) return null;
  // Still in flight: the detail query can resolve before the snapshot one, and
  // answering in that window is what flashed "Happening now" at a cancelled event.
  if (cancellationState === 'pending') return null;
  // todayKey validated too: on a degraded-Intl runtime it can be malformed, and the
  // lexicographic compares below would sort it arbitrarily.
  if (!startKey || !isRealDateKey(startKey) || !todayKey || !isRealDateKey(todayKey)) return null;

  const daysUntil = londonDaysBetweenKeys(todayKey, startKey);
  // "Tomorrow", not "In 1 day": CalendarListView already special-cases the singular
  // that way, and the site should not say both.
  if (daysUntil === 1) return { label: 'Tomorrow' };
  if (daysUntil > 0) return { label: `In ${daysUntil} days` };
  if (daysUntil === 0) return { label: 'Today' };

  // Past the start: this is the live-window branch, the one that asserts the event
  // is running. Never reachable without a confirmed cancellation fact.
  if (cancellationState !== 'known') return null;
  // Bounded at 30 days past the start: no real festival runs longer, and a corrupt
  // far-future end date must not pin "Happening now" for years. The date line still
  // renders a real forward end date even when absurdly far out, so THAT error class
  // stays visible to whoever can fix it.
  return daysUntil >= -30 && todayKey <= clampRangeEndKey(startKey, endKey)
    ? { label: 'Happening now' }
    : null;
};
