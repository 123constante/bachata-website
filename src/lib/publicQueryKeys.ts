/**
 * Roots of the public site's React Query keys that an organiser write makes stale
 * (FIXLIST F-33). The public hooks build their keys from these, and the organiser
 * side invalidates by them (organiser/shared/publicCache.ts), so the two cannot drift.
 */
export const EVENT_PAGE_QUERY_ROOT = 'event-page-snapshot';
export const CALENDAR_EVENTS_QUERY_ROOT = 'calendar-events';
