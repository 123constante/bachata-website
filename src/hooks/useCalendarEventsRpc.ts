import { useQuery } from '@tanstack/react-query';
import {
  getCalendarEvents,
  CalendarEventRow,
} from '@/integrations/supabase/eventRpcs';

export interface UseCalendarEventsParams {
  rangeStart: Date;
  rangeEnd: Date;
  citySlug?: string | null;
  enabled?: boolean;
}

/**
 * Fetch calendar events for a date range
 * For festivals: returns ONE ROW PER DAY (treat each as separate card)
 * Can optionally filter by city slug
 */
export const useCalendarEvents = ({
  rangeStart,
  rangeEnd,
  citySlug,
  enabled = true,
}: UseCalendarEventsParams) => {
  return useQuery({
    queryKey: [
      'calendar-events',
      rangeStart.toISOString(),
      rangeEnd.toISOString(),
      citySlug,
    ],
    queryFn: () =>
      getCalendarEvents({
        range_start: rangeStart.toISOString(),
        range_end: rangeEnd.toISOString(),
        city_slug_param: citySlug,
      }),
    enabled: enabled && !!rangeStart && !!rangeEnd,
    // Matches the ISR edge window (s-maxage=3600) — the /city/:slug loader
    // dehydrates this key; see useEventPageQuery for the full rationale.
    // Window-focus refetch (global default) still refreshes long-lived tabs.
    staleTime: 1000 * 60 * 60,
  });
};
