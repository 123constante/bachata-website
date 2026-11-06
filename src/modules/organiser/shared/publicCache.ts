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
 * calls this after it settles: every event page and every calendar range, by root.
 * Not narrowed to the series: the public page keys by resolve_public_event_ref_v1's id,
 * COALESCE(legacy_event_id, id), which is not the P5 series id for most series (81 of 92
 * on prod, 2026-10-31), and the workspace carries no legacy id. An organiser's tab holds
 * few event pages, so the cost is one refetch per open page.
 */
export function invalidatePublicEventCaches(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: [EVENT_PAGE_QUERY_ROOT] });
  void qc.invalidateQueries({ queryKey: [CALENDAR_EVENTS_QUERY_ROOT] });
}
