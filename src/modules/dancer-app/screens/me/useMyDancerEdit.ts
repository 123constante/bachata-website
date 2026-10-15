import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchMyDancerEdit } from '../../api/rpc';
import type { MyDancerEdit } from '../../api/types';

// ORCHESTRATOR: W1 did not export useMyDancerEdit, so W2c wrote it here (INTERFACE: key
// ['my-dancer-edit', userId]). Other wave-2 slices may have written the same hook; unify into api/.
export const myDancerEditKey = (userId: string | null | undefined) => ['my-dancer-edit', userId ?? null] as const;

/** The signed-in person's own profile. Me and Edit read it; a save writes the returned shape back with setQueryData. */
export const useMyDancerEdit = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: myDancerEditKey(user?.id),
    queryFn: fetchMyDancerEdit,
    enabled: Boolean(user?.id),
  });
};

/** Write a server-returned profile into the shared cache. */
export const usePutMyDancerEdit = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return (next: MyDancerEdit) => qc.setQueryData(myDancerEditKey(user?.id), next);
};
