import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchMyFeatureInterest, registerFeatureInterest } from './rpc';
import type { FeatureKey } from './types';

const key = (userId: string | null | undefined) => ['my-feature-interest', userId ?? null] as const;

/** "Tell me when it's ready" for one feature: already registered? and the register action. */
export function useFeatureInterest(feature: FeatureKey) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: key(user?.id), queryFn: fetchMyFeatureInterest, enabled: Boolean(user?.id), staleTime: 60_000 });
  const register = useMutation({
    mutationFn: () => registerFeatureInterest(feature),
    onSuccess: () => {
      qc.setQueryData(key(user?.id), (old: { registered: FeatureKey[] } | undefined) => ({
        registered: Array.from(new Set([...(old?.registered ?? []), feature])),
      }));
    },
  });
  return {
    registered: Boolean(query.data?.registered.includes(feature)) || register.isSuccess,
    register,
    loading: query.isLoading,
  };
}
