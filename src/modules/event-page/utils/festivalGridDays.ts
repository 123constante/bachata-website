import {
  asWallClock,
  wallClockDateKey,
  wallClockDateRange,
  type WallClock,
} from '@/lib/time/wallClock';

/** The only shape this needs from a schedule row. */
type HasDay = { day: WallClock | null | undefined };

/**
 * The column sessions land in when their own day is missing or unparseable.
 * The codec stamps `asWallClock('')` for an absent day
 * (useFestivalDetailQuery.parseSchedule), and `null` reaches here too, so both
 * collapse to this ONE bucket rather than to a blank column each.
 */
const UNDATED = asWallClock('');

/** Order by date key, never by the engine's implicit toString of a brand. */
const byDateKey = (a: WallClock, b: WallClock): number => {
  const ka = wallClockDateKey(a) ?? '';
  const kb = wallClockDateKey(b) ?? '';
  if (ka === kb) return 0;
  return ka < kb ? -1 : 1;
};

/**
 * The day COLUMNS a festival grid should render.
 *
 * Built from the festival's span, not from the sessions that happen to exist.
 * The distinction is the whole point: on 2026-08-19 "All Stars Festival" served
 * a three-column grid for a Thursday-to-Sunday festival because two programme
 * days collided on one date, and a `new Set` over session dates cannot tell a
 * collision from a genuinely shorter festival. Friday vanished, the count read
 * "3 DAYS", and nothing anywhere raised an error.
 *
 * Through all of that the span (`dates.local_start`..`local_end`) stayed
 * correct, because it derives from `anchor + max(date_offset_days)` rather than
 * from the day rows themselves. It is the one source that did not lie.
 *
 * One rule, applied three times: **union, never replacement.** Every session
 * keeps a column, because dropping one would hide it -- the same failure this
 * module exists to stop, re-pointed at a different cause. So:
 *
 *  - span days come first, whether or not any session falls on them;
 *  - a session dated OUTSIDE the span is a data fault, but it still gets a
 *    column, sorted into date order among the span days;
 *  - a session with no usable day at all gets the single `UNDATED` column,
 *    appended last. Pre-extraction this happened by accident (a raw `new Set`
 *    over `s.day` kept `''`), and losing it was a silent regression: the
 *    session became unreachable in the UI. The column carries no label, which
 *    is ugly; labelling it is queued debt, hiding it is not an option.
 *
 * LAST, not first, and that placement is forced rather than aesthetic. The
 * mobile single-day CSS in FestivalDetail defines `data-day="0"`..`"3"` only,
 * so a FIFTH column is unselectable on mobile -- where ~95% of users are. Any
 * column past the fourth is therefore lost, and the only choice is WHICH one:
 * appending puts a data-fault bucket in that position, while the pre-extraction
 * order (a raw Set put '' first) put the festival's real last day there. Both
 * lose a column; this one loses the least valuable. The four-column ceiling
 * itself is a PRE-EXISTING limit -- a genuine five-day festival already hits it
 * on main -- and fixing it is queued separately, but this change makes it
 * easier to reach, which is why it is written down here.
 *
 * There is deliberately NO separate "no span" branch. With no span days there
 * are no span keys, so every session is an orphan and the union below already
 * returns exactly the old session-derived list. An earlier draft spelled that
 * case out and could never change an answer -- a rule that by construction
 * cannot fail, which is worse than no rule, because a reader takes it for the
 * safety net the heading promises.
 *
 * That equivalence is the load-bearing claim here, so it is a TEST, not a
 * sentence: "the span-less result IS the deduped sorted session list" in
 * tests/festivalGridDays.test.ts. An earlier draft cited a 20k-input
 * differential fuzz instead; the fuzz was real but lived in a scratch
 * directory, which made the number unfalsifiable the moment it was written.
 */
export const festivalGridDays = (
  schedule: readonly HasDay[],
  localStart: WallClock | null | undefined,
  localEnd: WallClock | null | undefined,
): WallClock[] => {
  const spanDays = wallClockDateRange(localStart, localEnd);
  const spanKeys = new Set(spanDays.map((d) => wallClockDateKey(d)));

  const sessionKeys = schedule.map((s) => wallClockDateKey(s.day));
  const datedKeys = sessionKeys.filter((k): k is string => k !== null);
  const orphanKeys = datedKeys.filter((k) => !spanKeys.has(k));

  const orphanDays = Array.from(new Set(orphanKeys)).map((k) => asWallClock(k));
  const dated = [...spanDays, ...orphanDays].sort(byDateKey);

  return sessionKeys.length === datedKeys.length ? dated : [...dated, UNDATED];
};
