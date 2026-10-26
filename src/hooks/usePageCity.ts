import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useCity } from '@/contexts/CityContext';
import { resolvePageCity, type PageCity } from '@/lib/pageCity';

/**
 * @param urlOnly  true on prerendered bare routes (/parties, /classes): only a
 *                 /city/:slug URL names the city, so the static HTML stays
 *                 London and hydration never meets a localStorage city.
 */
export function usePageCity({ urlOnly = false }: { urlOnly?: boolean } = {}): PageCity {
  const { slug } = useParams<{ slug?: string }>();
  const { citySlug } = useCity();
  const wanted = slug ?? (urlOnly ? null : citySlug);
  return useMemo(() => resolvePageCity(wanted), [wanted]);
}
