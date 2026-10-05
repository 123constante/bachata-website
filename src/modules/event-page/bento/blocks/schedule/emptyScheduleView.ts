export type EmptyScheduleView =
  | { kind: 'loading' }
  | { kind: 'time'; text: string }
  | { kind: 'text'; text: string };

/**
 * What the schedule tile says when it has nothing to draw. A series with no
 * programme still has a time (the series time, or a date's own override), so
 * show that instead of "Schedule coming soon" (S2). A cancelled date keeps the
 * old text: a time would imply it is on. Pages WITH sessions never get here.
 */
export const emptyScheduleView = ({
  isLoading,
  sessionCount,
  fallbackTimeLabel,
  cancelled,
}: {
  isLoading: boolean;
  sessionCount: number;
  fallbackTimeLabel?: string | null;
  cancelled?: boolean;
}): EmptyScheduleView => {
  if (isLoading) return { kind: 'loading' };
  if (sessionCount !== 0) return { kind: 'text', text: 'No sessions on this day' };
  const time = fallbackTimeLabel?.trim();
  if (time && !cancelled) return { kind: 'time', text: time };
  return { kind: 'text', text: 'Schedule coming soon' };
};

