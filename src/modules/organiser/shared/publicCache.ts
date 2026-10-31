import type { QueryClient } from '@tanstack/react-query';
import { CALENDAR_EVENTS_QUERY_ROOT, EVENT_PAGE_QUERY_ROOT } from '@/lib/publicQueryKeys';

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
