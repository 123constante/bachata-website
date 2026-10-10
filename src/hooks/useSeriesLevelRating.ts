import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { stashPendingLevelRating } from '@/lib/pendingLevelRating';

export const LEVEL_OPTIONS = [
  { value: 'mostly_beginners', label: 'Mostly beginners', emoji: '\u{1F331}' },
  { value: 'mixed', label: 'Mixed', emoji: '\u{1F91D}' },
  { value: 'strong', label: 'Strong', emoji: '\u{1F525}' },
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
 * The message `rate_series_level_p5_v1` RAISEs when the caller's persona is not
 * complete (admin migration, same day as this). Matched as a substring: PostgREST
 * may wrap it. The server is the authority; the UI gate (ProfileGateContext) is
 * the fast path and can be stale.
 */
export const PROFILE_INCOMPLETE_ERROR = 'profile_incomplete';

export const isProfileIncompleteError = (error: unknown): boolean => {
  const message =
    error instanceof Error ? error.message : String((error as { message?: unknown } | null)?.message ?? '');
  return message.includes(PROFILE_INCOMPLETE_ERROR);
};

/** `saved`: the vote is in. `held`: the server refused it for an incomplete profile; it is stashed. */
export type RateOutcome = 'saved' | 'held';

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
    // The key carries the user id: keep the card on screen while auth resolves
    // (signed-out -> signed-in, same series only). Never carry a signed-in
    // summary over to a signed-out or different-series key.
    placeholderData: (prev, prevQuery) =>
      prevQuery && prevQuery.queryKey[1] === seriesId && prevQuery.queryKey[2] === null ? prev : undefined,
  });

  // The server refused a vote for an incomplete profile (see PROFILE_INCOMPLETE_ERROR).
  // The card shows the SAME disabled-with-reason gate the UI gate shows.
  const [heldForProfile, setHeldForProfile] = useState(false);

  const mutation = useMutation({
    mutationFn: async (level: SeriesLevel) => {
      const { error } = await supabase.rpc('rate_series_level_p5_v1', {
        p_series_id: seriesId as string,
        p_level: level,
      });
      if (error) throw error;
      return level;
    },
    onSuccess: () =>
      // Returned so mutateAsync settles after the fresh summary is in, not before.
      queryClient.invalidateQueries({ queryKey: ['series-level-summary', seriesId] }),
  });

  /**
   * Resolves `saved`, or `held` when the server says the profile is incomplete:
   * the vote is then stashed (pendingLevelRating, sent once the profile is
   * finished), the completion cache is dropped so the UI gate catches up, and
   * nothing raw reaches the screen. Any other error rejects exactly as before.
   */
  const rate = async (level: SeriesLevel): Promise<RateOutcome> => {
    try {
      await mutation.mutateAsync(level);
      setHeldForProfile(false);
      return 'saved';
    } catch (error) {
      if (!isProfileIncompleteError(error) || !seriesId) throw error;
      stashPendingLevelRating({ seriesId, level });
      setHeldForProfile(true);
      void queryClient.invalidateQueries({ queryKey: ['profile-completion'] });
      return 'held';
    }
  };

  return {
    summary: query.data ?? null,
    isLoading: query.isLoading,
    canRate: Boolean(user?.id) && !user?.is_anonymous,
    rate,
    isRating: mutation.isPending,
    rateError: heldForProfile ? null : mutation.error,
    /** The server refused the last vote for an incomplete profile. */
    profileIncomplete: heldForProfile,
  };
};
