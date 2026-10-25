import { useQuery } from '@tanstack/react-query';
import { NEEDS_YOU_KEY, fetchNeedsYou } from './frontDoorApi';

/** The Needs you count for the entry point and the tab. Null while loading or when it failed: no badge, never a wrong number. */
export function useNeedsYouCount(enabled = true): number | null {
  const q = useQuery({ queryKey: NEEDS_YOU_KEY, queryFn: fetchNeedsYou, staleTime: 30_000, enabled, retry: false });
  return q.data ? q.data.length : null;
}
