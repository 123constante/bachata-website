import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SearchResultEvent {
  id: string;
  name: string;
  poster_url: string | null;
  city_slug: string | null;
  event_type: string | null;
  start_time: string | null;
}

export interface SearchResultOrganiser {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

export interface SearchResultPerson {
  id: string;
  first_name: string | null;
  surname: string | null;
  display_name: string | null;
  photo_url: string | null;
  avatar_url: string | null;
  slug: string | null;
}

export interface SearchResultVenue {
  id: string;
  name: string | null;
  photo_url: string[] | null;
  address: string | null;
}

export interface SearchResultsPayload {
  query: string;
  events: SearchResultEvent[];
  organisers: SearchResultOrganiser[];
  teachers: SearchResultPerson[];
  djs: SearchResultPerson[];
  dancers: SearchResultPerson[];
  venues: SearchResultVenue[];
  total_count: number;
}

export function useSearchResults(
  query: string,
  citySlug: string | null,
  opts: { includePast?: boolean } = {},
) {
  const term = query.trim();
  const includePast = opts.includePast ?? false;
  return useQuery<SearchResultsPayload>({
    queryKey: ['search-results', term, citySlug, includePast],
    enabled: term.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      // Phase 1E #2 cutover (2026-05-27): search_public_v4 reads P5 for events.
      const { data, error } = await (supabase.rpc as never as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: SearchResultsPayload; error: { message: string } | null }>)(
        'search_public_v4',
        {
          p_query: term,
          p_city_slug: citySlug,
          p_section_limit: 12,
          p_include_past: includePast,
        },
      );
      if (error) throw new Error(error.message);
      return data;
    },
  });
}
