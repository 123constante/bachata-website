import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchMyDancerEdit } from '../../api/rpc';

// ORCHESTRATOR: W1 did not export useMyDancerEdit; this is the shared-spec fallback
// (same name, key ['my-dancer-edit', userId]). Swap for W1's if one lands.
export const myDancerEditKey = (userId: string | undefined) => ['my-dancer-edit', userId ?? null] as const;

export const useMyDancerEdit = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: myDancerEditKey(user?.id),
    queryFn: fetchMyDancerEdit,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
};
