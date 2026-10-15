import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchMyDancerEdit } from '../../api/rpc';

/**
 * ORCHESTRATOR: W1 did not export `useMyDancerEdit`; this is the same query (key
 * ['my-dancer-edit', userId], as W2-SHARED names it) kept inside this slice. When W1's
 * hook lands, delete this file and import that one: the cache entry is shared.
 */
export const myDancerEditKey = (userId: string | undefined) => ['my-dancer-edit', userId] as const;

export const useMyDancerEdit = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: myDancerEditKey(user?.id),
    queryFn: fetchMyDancerEdit,
    enabled: Boolean(user?.id),
  });
};
