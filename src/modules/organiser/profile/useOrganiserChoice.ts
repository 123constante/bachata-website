import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { fetchOrganiserHome, organiserHomeQueryKey, type HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';

/**
 * The organisers the signed-in person runs (organiser_home_v1, the same cache
 * entry the old /account uses) and which one this screen shows. The choice
 * lives in `?o=<id>` so Team and Profile keep it when the tab bar is used with
 * a shared link; the first organiser is the default, as on the old /account.
 */
export function useOrganiserChoice() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const home = useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome, enabled: !!user });
  const organisers = home.data?.organisers ?? [];
  const wanted = params.get('o');
  const selected: HomeOrganiser | null = organisers.find((o) => o.id === wanted) ?? organisers[0] ?? null;
  const choose = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('o', id);
    setParams(next, { replace: true });
  };
  return { user, home, organisers, selected, choose };
}
