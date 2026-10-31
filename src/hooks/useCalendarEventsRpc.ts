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
  /**
   * Cache lifetime. Default 1h matches the ISR edge window (s-maxage=3600) for
   * the prerendered SEO surfaces. Interactive calendar UIs (EventCalendar,
   * CalendarPanel) pass a shorter value so a cancelled/re-timed event surfaces
   * sooner -- the deleted duplicate hook used 5 min.
   */
  staleTime?: number;
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
  staleTime = 1000 * 60 * 60,
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
    // Window-focus refetch (global default) still refreshes long-lived tabs.
    staleTime,
  });
};
