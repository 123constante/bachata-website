import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type FestivalPreview = {
  id: string;
  name: string;
  city: string | null;
  date: string | null;
  start_time: string | null;
  poster_url: string | null;
};

export function useUpcomingFestivalsGlobal() {
  return useQuery({
    queryKey: ['upcoming-festivals-global'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('events')
        .select('id, name, city, date, start_time, poster_url')
        .eq('type', 'festival')
        .eq('is_active', true)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as FestivalPreview[];
    },
    staleTime: 60_000,
  });
}
