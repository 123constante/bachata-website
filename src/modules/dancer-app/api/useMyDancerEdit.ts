import { useCallback } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { trackDancerEvent } from '../analytics/events';
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

/** Profiles that already sent profile_strength_70 in this page session (exactly once per person). */
const crossed70 = new Set<string>();

/**
 * The ONE place a server-returned profile enters the shared cache (review S5).
 * Onboarding, Photo, Edit and the hide-surname switch all write through here, so
 * `profile_strength_70` fires on whichever path takes the person across 70.
 */
export const writeMyDancerEdit = (qc: QueryClient, userId: string | null | undefined, next: MyDancerEdit): void => {
  const before = qc.getQueryData<MyDancerEdit>(myDancerEditKey(userId));
  qc.setQueryData(myDancerEditKey(userId), next);
  if (before && before.strength.pct < 70 && next.strength.pct >= 70 && !crossed70.has(next.profile_id)) {
    if (trackDancerEvent('profile_strength_70', { pct: next.strength.pct })) crossed70.add(next.profile_id);
  }
};

/** Test-only: forget who already crossed 70. */
export const resetStrength70ForTests = (): void => crossed70.clear();

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
      writeMyDancerEdit(qc, userId, next);
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
  return (next: MyDancerEdit) => writeMyDancerEdit(qc, user?.id, next);
};
