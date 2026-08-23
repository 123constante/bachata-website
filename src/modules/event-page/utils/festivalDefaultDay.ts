import { isRealDateKey } from '@/lib/londonDate';

/**
 * Index of a key in a day list, or 0. THE LOW-LEVEL HALF -- most callers want
 * `resolveFestivalDefaultDay` below, which adds the gap-day rule.
 *
 * During a live festival the schedule should open on TODAY. Before the
 * festival (upcoming) or after it (finished), it falls
 * back to the first day — unchanged from the historical default.
 *
 * THE GAP-DAY HALF ABOVE IS NOT THIS FUNCTION'S TO KEEP -- it belongs to
 * `resolveFestivalDefaultDay` below. It used to hold for free: `days` was
 * session-derived, so a gap day was never in the array and `indexOf` missed.
 * Since festivalGridDays started building columns from the festival's SPAN, gap
 * days ARE in the array, so something has to withhold `todayKey` when today has
 * no sessions. That was a convention between two files (the default-day effect
 * in FestivalDetail.tsx), unenforceable and untestable from here; it is now the
 * wrapper below, which takes the session-day set as a parameter and IS covered
 * by __tests__/festivalDefaultDay.test.ts. Call the wrapper, not this, unless
 * you genuinely mean "index of this key, no gap-day rule".
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
 * @param days     The day list to search, as sorted 'YYYY-MM-DD' strings. NOT
 *                 "session days": the only production path passes the GRID's
 *                 columns, which come from the festival's span and so include
 *                 days with nothing scheduled on them. That distinction is the
 *                 whole reason the gap-day rule had to move to the wrapper, so
 *                 this line naming the retired model was worse than unhelpful.
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

/**
 * The festival page's default day tab: `pickDefaultDayIndex` plus the gap-day
 * rule the page could not express through it.
 *
 * `dayKeys` are the grid's COLUMNS, built from the festival's span, so a rest
 * day in the middle of a festival is a real column with no sessions in it.
 * Opening the schedule on a blank column is worse than opening on day 1, so a
 * `todayKey` naming a session-less day is withheld and the caller gets the
 * documented first-day fallback.
 *
 * TWO CALLERS, ONE RULE -- and that is the point. FestivalDetail derives the
 * default twice: once during render from the loader's pinned key, so the
 * SERVER-rendered document opens the day it badges, and once from a mount-gated
 * effect against the real client clock. Those two picks disagreeing is the
 * defect this wrapper exists to make impossible -- before it there was no
 * render-time pick at all, and the crawled document badged day 3 while opening
 * day 1.
 *
 * @param dayKeys        The grid's day columns as 'YYYY-MM-DD' keys, in order.
 * @param sessionDayKeys Which of those days actually have sessions.
 * @param todayKey       Today's key on the festival's calendar, or null.
 * @returns Index into `dayKeys` of today when it is in range AND has sessions,
 *          else 0.
 */
export const resolveFestivalDefaultDay = (
  dayKeys: string[],
  sessionDayKeys: ReadonlySet<string>,
  todayKey: string | null | undefined,
): number =>
  pickDefaultDayIndex(dayKeys, todayKey && sessionDayKeys.has(todayKey) ? todayKey : null);
