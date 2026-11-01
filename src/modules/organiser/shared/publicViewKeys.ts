import type { QueryClient } from '@tanstack/react-query';

/**
 * F-33: the public views an organiser write changes, by their EXACT query keys, so the
 * event page and the calendar in the same tab show the new state at once (their 1h
 * staleTime stays; only these entries are marked stale). The keys are literals here
 * (the public modules are not imported into the organiser chunk); publicViewKeys.test.ts
 * pins them to useEventPageQuery's eventPageQueryKey and useCalendarEventsRpc's key.
 */

/** Every cached event page of this series: ['event-page-snapshot', seriesId, occurrenceId | null]. */
export const publicEventPageKey = (seriesId: string) => ['event-page-snapshot', seriesId] as const;

/** Every cached calendar range: ['calendar-events', start, end, city] (a date move can cross ranges). */
export const PUBLIC_CALENDAR_KEY = ['calendar-events'] as const;

export function invalidatePublicViews(qc: QueryClient, seriesId: string): void {
  void qc.invalidateQueries({ queryKey: publicEventPageKey(seriesId) });
  void qc.invalidateQueries({ queryKey: PUBLIC_CALENDAR_KEY });
}
