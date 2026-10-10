import { TIME_TBC_HINT, TIME_TBC_LABEL } from '@/lib/time/wallClock';

export type EmptyScheduleView =
  | { kind: 'loading' }
  | { kind: 'time'; text: string }
  | { kind: 'tbc'; text: string; hint: string }
  | { kind: 'text'; text: string };

/**
 * What the schedule tile says when it has nothing to draw. A series with no
 * programme still has a time (the series time, or a date's own override), so
 * show that instead of "Schedule coming soon" (S2). A cancelled date keeps the
 * old text: a time would imply it is on. Pages WITH sessions never get here.
 * A date with no timed session (timeToBeConfirmed) never shows the series time: it says the time
 * is to be confirmed and what the person can do (owner decision 2026-10-09).
 */
export const emptyScheduleView = ({
  isLoading,
  sessionCount,
  fallbackTimeLabel,
  cancelled,
  timeToBeConfirmed,
}: {
  isLoading: boolean;
  sessionCount: number;
  fallbackTimeLabel?: string | null;
  cancelled?: boolean;
  timeToBeConfirmed?: boolean;
}): EmptyScheduleView => {
  if (isLoading) return { kind: 'loading' };
  if (sessionCount !== 0) return { kind: 'text', text: 'No sessions on this day' };
  if (timeToBeConfirmed && !cancelled) return { kind: 'tbc', text: TIME_TBC_LABEL, hint: TIME_TBC_HINT };
  const time = fallbackTimeLabel?.trim();
  if (time && !cancelled) return { kind: 'time', text: time };
  return { kind: 'text', text: 'Schedule coming soon' };
};

