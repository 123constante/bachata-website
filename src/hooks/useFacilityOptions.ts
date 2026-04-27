import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FacilityOption {
  key: string;
  label: string;
  emoji: string | null;
  dancer_facing: boolean;
  display_order: number;
  aliases: string[];
}

/**
 * Canonical list of venue facility keys, sourced from public.facility_options.
 *
 * Replaces the hardcoded FACILITY_WHITELIST that used to live in
 * VenueEntity.tsx. The DB is now the source of truth — adding a facility =
 * INSERT into facility_options, no code deploy.
 *
 * Cached aggressively: this is config data, ~9 rows, changes rarely.
 */
export const useFacilityOptions = () =>
  useQuery({
    queryKey: ['facility-options'],
    queryFn: async (): Promise<FacilityOption[]> => {
      // Cast: facility_options was added 2026-04-26 PM and isn't yet in the
      // generated Database types. Regenerate types on next migration sweep.
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            order: (col: string) => Promise<{ data: FacilityOption[] | null; error: unknown }>;
          };
        };
      })
        .from('facility_options')
        .select('key, label, emoji, dancer_facing, display_order, aliases')
        .order('display_order');

      if (error || !data) return [];
      return data;
    },
    // Config data. Refresh once an hour at most.
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

/**
 * Build a lookup map from facility key -> { label, emoji } for fast render.
 * Filters to dancer_facing = true by default — the dancer-facing venue page
 * only ever wants those.
 */
export const useFacilityLookup = (
  options: { dancerFacingOnly?: boolean } = { dancerFacingOnly: true },
) => {
  const { data: facilityOptions, isLoading } = useFacilityOptions();
  const lookup = new Map<string, { label: string; emoji: string | null }>();
  if (facilityOptions) {
    for (const f of facilityOptions) {
      if (options.dancerFacingOnly && !f.dancer_facing) continue;
      lookup.set(f.key, { label: f.label, emoji: f.emoji });
    }
  }
  return { lookup, isLoading };
};
