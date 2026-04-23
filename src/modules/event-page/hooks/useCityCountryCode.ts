import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Fetches a single city's country_code from the cities table. The RPC
// get_event_page_snapshot_v2 currently only surfaces city { id, name, slug },
// and extending the RPC would require a DB migration mirrored across admin
// + public. A direct read against `cities` is permitted for anon (see
// "Public read cities" policy in the remote_schema baseline) and is cheap:
// one row, keyed by id, cached indefinitely.
export const cityCountryCodeQueryKey = (cityId: string | null | undefined) =>
  ['city-country-code', cityId ?? null] as const;

export const useCityCountryCode = (cityId: string | null | undefined) => {
  return useQuery<string | null>({
    queryKey: cityCountryCodeQueryKey(cityId),
    queryFn: async () => {
      if (!cityId) return null;
      const { data, error } = await supabase
        .from('cities')
        .select('country_code')
        .eq('id', cityId)
        .maybeSingle();
      if (error) throw error;
      return data?.country_code ?? null;
    },
    enabled: Boolean(cityId),
    // Country codes are effectively immutable, so cache for the session.
    staleTime: Infinity,
  });
};
