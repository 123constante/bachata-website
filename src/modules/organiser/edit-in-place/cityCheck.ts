// Edit in place: the City sheet's lookups and the confirm-by-id check, kept out
// of CitySheetBody.tsx so that file exports only its component.
import { useQuery } from '@tanstack/react-query';
import type { CityResult } from '@/modules/organiser/home/onboarding/citySearch';
import type { CanonicalCity } from '@/lib/city-canonical';
import { CITY_COPY } from './fieldRules';

export interface CityLookups {
  searchCities: (query: string) => Promise<CityResult[]>;
  resolveCity: (id: string) => Promise<CanonicalCity | null>;
}

export type CityCheck =
  | { state: 'none' }
  | { state: 'checking' }
  | { state: 'ok'; city: CanonicalCity }
  /** `retry`: only when the check itself failed (the network), never for a city that is not on the list. */
  | { state: 'refused'; message: string; retry?: () => void };

/** The picked city, confirmed against the cities table (cached per id). */
export function useCityCheck(id: string, resolveCity: CityLookups['resolveCity']): CityCheck {
  const q = useQuery({
    queryKey: ['city-canonical', id],
    queryFn: () => resolveCity(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  if (!id) return { state: 'none' };
  if (q.isPending) return { state: 'checking' };
  if (q.isError) return { state: 'refused', message: CITY_COPY.checkFailed, retry: () => void q.refetch() };
  return q.data ? { state: 'ok', city: q.data } : { state: 'refused', message: CITY_COPY.notFound };
}
