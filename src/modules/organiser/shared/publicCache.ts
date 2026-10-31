import type { QueryClient } from '@tanstack/react-query';

/**
 * Roots of the public site's React Query keys an organiser write makes stale. Kept as
 * strings here, not imported from the public hooks: a shared module became one more
 * first-load chunk on /event, /city, /parties and /classes (perf-budget ratchet).
 * publicCache.test.tsx pins both to eventPageQueryKey, useCalendarEvents and
 * seoLandingEventsKey, so a renamed key fails there.
 */
export const EVENT_PAGE_QUERY_ROOT = 'event-page-snapshot';
export const CALENDAR_EVENTS_QUERY_ROOT = 'calendar-events';

/**
 * FIXLIST F-33: the public event page and the calendar keep their data for an hour
 * (staleTime matches the ISR edge window), so an organiser who changes an event and
 * then opens its public page in the same tab saw the old one. Every organiser write
 * calls this after it settles: the event page of that series (every date of it; the
 * key's second part is the series id, see eventPageQueryKey) and every calendar range.
 */
export function invalidatePublicEventCaches(qc: QueryClient, seriesId: string): void {
  void qc.invalidateQueries({
    predicate: (q) => q.queryKey[0] === EVENT_PAGE_QUERY_ROOT && q.queryKey[1] === seriesId,
  });
  void qc.invalidateQueries({ queryKey: [CALENDAR_EVENTS_QUERY_ROOT] });
}
