import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { fetchOrganiserHome, organiserHomeQueryKey, type HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';

/** Scoped to the login, so a second login on a shared phone never reads it. */
const storageKey = (userId: string) => `org-r1-chosen-page:${userId}`;

/** The page picked on Switch, remembered on this device (a convenience: absent is fine). */
function remembered(userId: string | undefined): string | null {
  if (!userId) return null;
  try {
    return window.localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

export function rememberChoice(userId: string | undefined, id: string) {
  if (!userId) return;
  try {
    window.localStorage.setItem(storageKey(userId), id);
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
  const linked = params.get('o');
  const fromLink = linked ? organisers.find((o) => o.id === linked) : undefined;
  const wanted = linked ?? remembered(user?.id);
  const selected: HomeOrganiser | null = fromLink ?? organisers.find((o) => o.id === wanted) ?? organisers[0] ?? null;
  // A ?o= link to a member page becomes the remembered choice, so the screens
  // Home opens (bare paths) show the same page. A non-member id never is.
  useEffect(() => {
    if (fromLink) rememberChoice(user?.id, fromLink.id);
  }, [fromLink, user?.id]);
  const choose = (id: string) => {
    rememberChoice(user?.id, id);
    const next = new URLSearchParams(params);
    next.set('o', id);
    setParams(next, { replace: true });
  };
  return { user, home, organisers, selected, choose };
}
