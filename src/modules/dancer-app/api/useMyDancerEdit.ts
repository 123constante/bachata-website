import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchMyDancerEdit, saveMyDancerProfile } from './rpc';
import type { DancerDelta, MyDancerEdit } from './types';

/**
 * The ONE copy of the signed-in person's own-profile query (INTERFACE key
 * ['my-dancer-edit', userId]). R1a replaced the four per-screen copies W2a-W2d
 * wrote while W1 had none; every screen reads and writes this cache entry.
 */
export const myDancerEditKey = (userId: string | null | undefined) => ['my-dancer-edit', userId ?? null] as const;

type Options = { refetchOnMount?: boolean | 'always'; staleTime?: number; retry?: boolean };

export function useMyDancerEdit(options: Options = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;
  const query = useQuery({
    queryKey: myDancerEditKey(userId),
    queryFn: fetchMyDancerEdit,
    enabled: Boolean(userId),
    ...options,
  });
  /** Save a delta and write the server-returned profile into the shared cache. */
  const save = useCallback(
    async (delta: DancerDelta, current: MyDancerEdit): Promise<MyDancerEdit> => {
      const next = await saveMyDancerProfile(delta, current);
      qc.setQueryData(myDancerEditKey(userId), next);
      return next;
    },
    [qc, userId],
  );
  return { ...query, save };
}

/** Write a server-returned profile into the shared cache. */
export const usePutMyDancerEdit = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return (next: MyDancerEdit) => qc.setQueryData(myDancerEditKey(user?.id), next);
};
