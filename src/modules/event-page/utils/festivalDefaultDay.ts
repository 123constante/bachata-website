import { isRealDateKey } from '@/lib/londonDate';

/**
 * Pick which day-tab a festival schedule should open on.
 *
 * During a live festival the schedule should open on TODAY. Before the festival
 * (upcoming), after it (finished), or on a gap day with no sessions, it falls
 * back to the first day — unchanged from the historical default.
 *
 * TAKES THE KEY, DOES NOT READ A CLOCK. This used to compute its own
 * `dateKeyInTz(new Date(), tz)` while FestivalDetail separately held a reactive
 * `todayKey` from `useTodayKey(eventTz)`. Two clocks resolving either side of the
 * festival's midnight could open one day tab while the "today" badges marked a
 * different one. Now there is one clock on the page and this reads its output.
 *
 * SCOPE, precisely: this removes the skew at the INITIAL pick. It does not make
 * the tab track midnight thereafter — FestivalDetail latches the default behind
 * a `defaultedForRef` so a later rollover cannot yank the tab out from under a
 * user who has clicked one. In a tab left open across the festival's midnight
 * the badges still advance while the open tab stays put. That is the intended
 * trade (not overriding a user's click wins), not an oversight.
 *
 * Resolving the key in the festival's OWN timezone — not the visitor's browser
 * zone — is the caller's job, and that is what `useTodayKey(eventTz)` does.
 *
 * @param days     Distinct session days as sorted 'YYYY-MM-DD' strings.
 * @param todayKey Today's 'YYYY-MM-DD' key on the festival's calendar.
 * @returns Index into `days` of today when in range, else 0.
 */
export const pickDefaultDayIndex = (days: string[], todayKey: string | null | undefined): number => {
  // isRealDateKey, not a truthy check: a degraded-Intl runtime yields a
  // MALFORMED key ('2026-13-45'), which is truthy and would sail through a
  // `!todayKey` guard. This is the same validator FestivalDetail applies to the
  // same value before its days-away maths.
  if (!days || days.length === 0 || !todayKey || !isRealDateKey(todayKey)) return 0;
  const idx = days.indexOf(todayKey);
  return idx >= 0 ? idx : 0;
};
