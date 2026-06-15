import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PopularSearch {
  query: string;
  search_count: number;
}

// Top searches over the trailing 14 days for the discovery empty state.
// Degrades to [] (no error surfaced) if get_popular_searches_v1 is absent, so
// the overlay still works against a DB that predates search v5.
export function usePopularSearches(citySlug?: string | null) {
  return useQuery<PopularSearch[]>({
    queryKey: ['popular-searches', citySlug ?? null],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('get_popular_searches_v1' as never, {
          p_city_slug: citySlug ?? null,
          p_limit: 8,
        });
        if (error) return [];
        return (data ?? []) as PopularSearch[];
      } catch {
        return [];
      }
    },
  });
}
