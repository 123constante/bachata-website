import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchMyDancerEdit, saveMyDancerProfile } from '../../api/rpc';
import type { DancerDelta, MyDancerEdit } from '../../api/types';

/**
 * ORCHESTRATOR: W1 did not export useMyDancerEdit (W2-SHARED says to write it
 * here under exactly this name and flag the duplicate). Same key as the
 * contract: ['my-dancer-edit', userId]. Delete this file when W1's lands.
 */
export const myDancerEditKey = (userId: string | null | undefined) => ['my-dancer-edit', userId ?? 'anon'] as const;

export function useMyDancerEdit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = myDancerEditKey(user?.id);
  // Always re-read on mount: the photo screen saves elsewhere and sends the person back here.
  const query = useQuery({ queryKey: key, queryFn: fetchMyDancerEdit, enabled: Boolean(user), refetchOnMount: 'always', retry: false });
  const save = useCallback(
    async (delta: DancerDelta, current: MyDancerEdit): Promise<MyDancerEdit> => {
      const next = await saveMyDancerProfile(delta, current);
      qc.setQueryData(key, next);
      return next;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, user?.id],
  );
  return { ...query, save };
}
