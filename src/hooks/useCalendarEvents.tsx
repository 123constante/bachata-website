import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CalendarEvent {
  event_id: string;
  name: string;
  photo_url: string[];
  cover_image_url: string | null;
  location: string;
  instance_date: string;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  meta_data: any;
  key_times?: any;
  type: string;
  has_party: boolean;
  has_class: boolean;
  class_start?: string | null;
  class_end?: string | null;
  party_start?: string | null;
  party_end?: string | null;
  city_slug?: string | null;
  occurrence_id: string;
  occurrence_starts_at?: string;
  occurrence_ends_at?: string | null;
}

interface UseCalendarEventsProps {
  rangeStart: Date;
  rangeEnd: Date;
  citySlug: string | null;
}

export const useCalendarEvents = ({ rangeStart, rangeEnd, citySlug }: UseCalendarEventsProps) => {
  return useQuery({
    queryKey: ['calendar-events', rangeStart.toISOString(), rangeEnd.toISOString(), citySlug],
    queryFn: async () => {
      if (!citySlug) {
        return [] as CalendarEvent[];
      }

      const { data, error } = await supabase.rpc('get_calendar_events', {
        range_start: rangeStart.toISOString(),
        range_end: rangeEnd.toISOString(),
        city_slug_param: citySlug,
      });

      if (error) {
        console.error("Calendar RPC Error:", error);
        throw error;
      }

      return (data as CalendarEvent[]) || [];
    },
    enabled: !!rangeStart && !!rangeEnd && !!citySlug,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};
