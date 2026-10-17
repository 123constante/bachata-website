import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { fetchOrganiserHome, organiserHomeQueryKey, type HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';

const STORAGE_KEY = 'org-r1-chosen-page';

/** The page picked on Switch, remembered on this device (a convenience: absent is fine). */
function remembered(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function rememberChoice(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* private mode: the ?o= link still carries the choice */
  }
}

/**
 * The organisers the signed-in person runs (organiser_home_v1, the same cache
 * entry the old /account uses) and which one this screen shows. The choice
 * lives in `?o=<id>` so Team and Profile keep it with a shared link; without
 * one, the page last picked on Switch (R1: every path returns to a bare Home),
 * else the first organiser, as on the old /account.
 */
export function useOrganiserChoice() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const home = useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome, enabled: !!user });
  const organisers = home.data?.organisers ?? [];
  const wanted = params.get('o') ?? remembered();
  const selected: HomeOrganiser | null = organisers.find((o) => o.id === wanted) ?? organisers[0] ?? null;
  const choose = (id: string) => {
    rememberChoice(id);
    const next = new URLSearchParams(params);
    next.set('o', id);
    setParams(next, { replace: true });
  };
  return { user, home, organisers, selected, choose };
}
