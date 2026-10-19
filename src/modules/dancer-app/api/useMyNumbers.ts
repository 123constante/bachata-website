import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchMyStats, fetchMyViews } from './rpc';
import { numbersFrom, type Numbers } from './numbersModel';

export const myNumbersKey = (userId: string | null | undefined) => ['my-dancer-numbers', userId ?? null] as const;

/** The signed-in dancer's stats + views as one `Numbers` (api/numbersModel is the only mapping). */
export function useMyNumbers() {
  const { user } = useAuth();
  return useQuery<Numbers>({
    queryKey: myNumbersKey(user?.id),
    queryFn: async () => {
      const [stats, views] = await Promise.all([fetchMyStats(), fetchMyViews()]);
      return numbersFrom(stats, views);
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
}
