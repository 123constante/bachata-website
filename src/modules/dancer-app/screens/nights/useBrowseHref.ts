import { useCity } from '@/contexts/CityContext';
import { buildCityPath } from '@/lib/cityPath';

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

/** The city calendar (or the all-cities list when no city is set): where "Browse what's on" goes. */
export const useBrowseHref = (): string => {
  const slug = useActiveCitySlug();
  return slug ? buildCityPath(slug, 'calendar') : '/parties';
};
