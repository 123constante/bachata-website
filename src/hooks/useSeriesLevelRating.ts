import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const LEVEL_OPTIONS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'improver', label: 'Improver' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'open_level', label: 'Open level' },
] as const;

export type SeriesLevel = (typeof LEVEL_OPTIONS)[number]['value'];

export type SeriesLevelSummary = {
  series_id: string;
  vote_count: number;
  threshold: number;
  counts: Partial<Record<SeriesLevel, number>> | null;
  derived_level: SeriesLevel | null;
  my_level: SeriesLevel | null;
};

export const seriesLevelQueryKey = (seriesId: string | null | undefined, userId?: string) =>
  ['series-level-summary', seriesId, userId ?? null] as const;

const fetchSummary = async (seriesId: string): Promise<SeriesLevelSummary | null> => {
  const { data, error } = await supabase.rpc('series_level_summary_p5_v1', {
    p_series_id: seriesId,
  });
  if (error) throw error;
  return (data as SeriesLevelSummary | null) ?? null;
};

/**
 * Dancer-rated series level. Only a signed-in, non-anonymous user can rate;
 * the RPC enforces that (and bars the series' own organisers), so `canRate`
 * only decides whether to offer the control, not whether a write is allowed.
 */
export const useSeriesLevelRating = (seriesId: string | null | undefined) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = seriesLevelQueryKey(seriesId, user?.id);

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchSummary(seriesId as string),
    enabled: Boolean(seriesId),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (level: SeriesLevel) => {
      const { error } = await supabase.rpc('rate_series_level_p5_v1', {
        p_series_id: seriesId as string,
        p_level: level,
      });
      if (error) throw error;
      return level;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['series-level-summary', seriesId] });
    },
  });

  return {
    summary: query.data ?? null,
    isLoading: query.isLoading,
    canRate: Boolean(user?.id) && !user?.is_anonymous,
    rate: mutation.mutateAsync,
    isRating: mutation.isPending,
    rateError: mutation.error,
  };
};
