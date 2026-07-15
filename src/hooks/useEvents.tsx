import { useQuery } from '@tanstack/react-query';
import { useCity } from '@/contexts/CityContext';
import { getCalendarEvents } from '@/integrations/supabase/eventRpcs';

/**
 * Upcoming events for the current city (next 30 days), shaped for the
 * TonightSavingsAlert / LiveDiscounts strips. Routes through the typed+branded
 * getCalendarEvents boundary (NOT a raw `rpc(... as never)` call) so the wire
 * shape is compiler-checked. `date` is the date-only instance_date, so the sort
 * is a lexical compare -- no `new Date()` on a stored wall clock.
 */
export const useUpcomingEvents = () => {
  const { citySlug } = useCity();

  return useQuery({
    queryKey: ['upcoming-events', citySlug],
    queryFn: async () => {
      if (!citySlug) {
        return [];
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30); // Look ahead 30 days

      const rows = await getCalendarEvents({
        range_start: startDate.toISOString(),
        range_end: endDate.toISOString(),
        city_slug_param: citySlug,
      });

      return rows
        .map((event) => ({
          id: event.event_id,
          slug: event.slug ?? null,
          // occurrenceId surfaces for ADR-007 Phase 4.2c — cards link to the
          // specific date so the public event page shows that date's program.
          occurrenceId: event.occurrence_id ?? null,
          name: event.name,
          date: event.instance_date, // date-only 'YYYY-MM-DD' in the event tz
          venue_name: event.location || 'TBA',
          attendance_count: 0, // Not available in RPC yet
        }))
        // instance_date is a date-only key -> lexical sort is calendar-correct.
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
        .slice(0, 10);
    },
    enabled: !!citySlug,
    // Events move on the scale of days; the 60s default made this refire on
    // every homepage tab focus now that refetchOnWindowFocus is on.
    staleTime: 5 * 60 * 1000,
  });
};
