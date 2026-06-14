import { dateKeyInTz } from '@/lib/londonDate';

/**
 * Pick which day-tab a festival schedule should open on.
 *
 * During a live festival the schedule should open on TODAY (computed in the
 * festival's own timezone, not the visitor's browser zone). Before the festival
 * (upcoming), after it (finished), or on a gap day with no sessions, it falls
 * back to the first day — unchanged from the historical default.
 *
 * Pure + `now` is injectable so it unit-tests without mocking the clock.
 *
 * @param days     Distinct session days as sorted 'YYYY-MM-DD' strings.
 * @param timezone The festival's IANA timezone; falls back to Europe/London.
 * @param now      The current instant (defaults to new Date()).
 * @returns Index into `days` of today when in range, else 0.
 */
export const pickDefaultDayIndex = (
  days: string[],
  timezone: string | null,
  now: Date = new Date(),
): number => {
  if (!days || days.length === 0) return 0;
  const todayKey = dateKeyInTz(now, timezone ?? 'Europe/London');
  const idx = days.indexOf(todayKey);
  return idx >= 0 ? idx : 0;
};
