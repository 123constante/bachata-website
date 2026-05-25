import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchPublic } from '@/lib/searchRpc';
import { recordSearchQuery } from '@/lib/searchTelemetry';

// Debounced federated search hook for the search overlay. Fires the RPC once
// the (trimmed) query reaches 2 chars, debounced ~220ms, and logs the query to
// search telemetry (source: 'header') with the result count.
export function usePublicSearch(rawQuery: string) {
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(rawQuery.trim()), 220);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const enabled = debounced.length >= 2;

  const query = useQuery({
    queryKey: ['public-search', debounced],
    queryFn: async () => {
      const results = await searchPublic(debounced);
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
