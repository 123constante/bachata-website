import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type FestivalEvent = {
  id: string;
  name: string;
  city: string | null;
  start_time: string | null;
};

export const useFestivalEvents = () => {
  const query = useQuery({
    queryKey: ['festival-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, city, start_time')
        .eq('type', 'festival')
        .order('start_time', { ascending: false });

      if (error) throw error;
      return (data as FestivalEvent[]) || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const festivals = query.data || [];

  const festivalMap = useMemo(() => {
    const map: Record<string, FestivalEvent> = {};
    festivals.forEach((festival) => {
      map[festival.id] = festival;
    });
    return map;
  }, [festivals]);

  return {
    ...query,
    festivals,
    festivalMap,
  };
};
