import { useQuery } from '@tanstack/react-query';
import { useCity } from '@/contexts/CityContext';
import { getSupabase } from '@/integrations/supabase/getSupabase';
import { buildCityPath } from '@/lib/cityPath';

/** Where "Browse events" goes when no city is known: the all-cities list. */
export const ALL_CITIES_PATH = '/parties';

/**
 * The site's active city slug, or null when there is no CityProvider (the
 * production app always has one; W1's renderInShell does not mount it).
 * useCity() reads its context BEFORE it throws, so the hook order is the same
 * either way.
 */
export const useActiveCitySlug = (): string | null => {
  try {
    return useCity().citySlug;
  } catch {
    return null;
  }
};

export const dancerCitySlugQueryKey = (cityId: string | null | undefined) => ['dancer-app', 'city-slug', cityId ?? null] as const;

/**
 * The slug of the dancer's OWN city (profile.based_city_id), read the way the
 * site already resolves a city id (cities.id -> slug, as lib/city-canonical.ts
 * does). Audit M20: What's On is about where the dancer dances, not the city the
 * site was last browsed in. City slugs never change, so it is cached for the session.
 */
export const useDancerCitySlug = (cityId: string | null | undefined) =>
  useQuery<string | null>({
    queryKey: dancerCitySlugQueryKey(cityId),
    queryFn: async () => {
      if (!cityId) return null;
      const supabase = await getSupabase();
      const { data, error } = await supabase.from('cities').select('slug').eq('id', cityId).maybeSingle();
      if (error) throw new Error(error.message);
      return data?.slug ?? null;
    },
    enabled: Boolean(cityId),
    staleTime: Infinity,
  });

/**
 * Where "Browse events" goes (one destination on Home and Nights): the dancer's
 * own city calendar, else the site's active city, else the all-cities list.
 */
export const useBrowseHref = (cityId?: string | null): string => {
  const active = useActiveCitySlug();
  const own = useDancerCitySlug(cityId);
  const slug = own.data ?? active;
  return slug ? buildCityPath(slug, 'calendar') : ALL_CITIES_PATH;
};
