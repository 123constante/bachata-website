import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCity } from '@/contexts/CityContext';

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

      const { data, error } = await supabase.rpc('get_calendar_events', {
        range_start: startDate.toISOString(),
        range_end: endDate.toISOString(),
        city_slug_param: citySlug,
      });

      if (error) throw error;
      
      // Map RPC result to the expected format for ComingUpSection
      const events = (data as unknown as any[]).map((event) => ({
        id: event.event_id,
        name: event.name,
        date: event.instance_date, // This ensures we show the correct instance date
        venue_name: event.location || 'TBA',
        attendance_count: 0 // Not available in RPC yet
      }));

      // Sort by date and take first 10
      return events
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 10);
    },
    enabled: !!citySlug,
  });
};

export const useEvents = () => {
  const { citySlug } = useCity();

  return useQuery({
    queryKey: ['events', citySlug],
    queryFn: async () => {
      if (!citySlug) {
        return [];
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 60);

      const { data, error } = await supabase.rpc('get_calendar_events', {
        range_start: startDate.toISOString(),
        range_end: endDate.toISOString(),
        city_slug_param: citySlug,
      });

      if (error) throw error;

      return (data as unknown as any[]).map((event) => ({
        id: event.event_id,
        name: event.name,
        date: event.instance_date,
        location: event.location,
        cover_image_url: event.cover_image_url,
        photo_url: event.photo_url,
        is_published: true,
      }));
    },
    enabled: !!citySlug,
  });
};
