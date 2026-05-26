import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchPublicV3 } from '@/lib/searchRpc';
import { recordSearchQuery } from '@/lib/searchTelemetry';

// Debounced federated search hook for the search overlay. Fires v3 RPC once
// the (trimmed) query reaches 2 chars, debounced ~220ms, 3 results per section.
export function usePublicSearch(rawQuery: string, citySlug?: string | null) {
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(rawQuery.trim()), 220);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const enabled = debounced.length >= 2;

  const query = useQuery({
    queryKey: ['public-search', debounced, citySlug ?? null],
    queryFn: async () => {
      const results = await searchPublicV3(debounced, citySlug, 3);
      recordSearchQuery({ query: debounced, resultsCount: results.length, source: 'header' });
      return results;
    },
    enabled,
    staleTime: 60_000,
  });

  return {
    results: query.data ?? [],
    isLoading: enabled && query.isLoading,
    isFetching: query.isFetching,
    term: debounced,
    hasQuery: enabled,
  };
}
