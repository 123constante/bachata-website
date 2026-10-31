import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfileCompletion } from '@/hooks/useProfileCompletion';
import { useAccountGate } from '@/lib/accountGate';
import { hasOrganiserIntent, profileSides, type SidesFacts, type SidesState } from '@/lib/accountRouting';
import { completenessFact } from '@/lib/profileCompletion';
import { flags } from '@/lib/featureFlags';
import { organiserAreaHome } from '@/lib/organiserAreaHome';
import { useDancerArea } from '@/modules/dancer-app/gate/useDancerArea';
import { fetchMyDancerEdit } from '@/modules/dancer-app/api/rpc';
import { myDancerEditKey } from '@/modules/dancer-app/api/useMyDancerEdit';
import { adminCheckQueryKey, fetchIsAdmin } from '@/modules/admin-organisers/adminApi';
import {
  fetchMyAccessRequests,
  fetchOrganiserHome,
  myAccessRequestsQueryKey,
  organiserHomeQueryKey,
} from '@/modules/organiser/shared/selfServeApi';

/** A react-query result -> undefined while loading, null when failed (or paused offline with nothing cached). */
const fact = <T, R>(q: { data: T | undefined; isError: boolean; isPending: boolean; isPaused: boolean }, pick: (d: T) => R) =>
  q.data !== undefined ? pick(q.data) : q.isError || (q.isPending && q.isPaused) ? null : undefined;

export type ProfileSidesResult = {
  facts: SidesFacts;
  state: SidesState;
  /** Open organiser access requests: undefined loading, null failed. Not a side (lib/accountRouting). */
  openRequestCount: number | null | undefined;
};

/**
 * The facts lib/accountRouting's profileSides() reads, gathered once: the
 * organiser reads src/pages/Account.tsx makes (same keys and fetchers, so every
 * screen shares one cache entry), dancer completeness, the dancer-area gate,
 * and the dancer's own name and photo (the dancer app's own cache entry, read
 * only when the gate lets the person in -- the RPC refuses everyone else).
 */
export function useProfileSides(): ProfileSidesResult {
  const { user } = useAuth();
  const enabled = Boolean(user?.id);
  const home = useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome, enabled });
  const requests = useQuery({ queryKey: myAccessRequestsQueryKey(user?.id), queryFn: fetchMyAccessRequests, enabled });
  const completion = useProfileCompletion();
  // A deleted login lands on restore / the deleted card before any side (lib/accountGate: the one composition).
  const gate = useAccountGate();
  const area = useDancerArea();
  const kind = completion.status === 'loading' ? 'loading' : completenessFact(completion).kind;
  const hasDancer = kind === 'complete' || kind === 'incomplete';
  const face = useQuery({
    queryKey: myDancerEditKey(user?.id),
    queryFn: fetchMyDancerEdit,
    enabled: enabled && area.allowed && hasDancer,
    staleTime: 60_000,
    retry: false,
  });
  const organisers = fact(home, (d) => d.organisers.map((o) => ({ id: o.id, name: o.name, avatar_url: o.avatar_url })));
  // M44: only a person with no side at all needs it (an admin keeps the site home, anyone else
  // goes to the dancer setup). Same key and fetcher as hooks/useIsAdmin, so one cache entry.
  const admin = useQuery({
    queryKey: adminCheckQueryKey(user?.id),
    queryFn: fetchIsAdmin,
    enabled: enabled && kind === 'no_profile' && Array.isArray(organisers) && organisers.length === 0,
    staleTime: 5 * 60 * 1000,
  });
  const facts: SidesFacts = {
    organisers,
    dancer: kind,
    areaAllowed: area.status === 'loading' ? undefined : area.allowed,
    dancerFace: face.data ? { firstName: face.data.first_name, avatarUrl: face.data.avatar_url } : null,
    // The sign-up's role (Auth.tsx writes user_type): an organiser-type sign-up keeps its intent past a closed tab.
    organiserIntent: hasOrganiserIntent(user?.user_metadata?.user_type),
    openRequestCount: fact(requests, (d) => d.filter((r) => r.status === 'open').length),
    isAdmin: fact(admin, (d) => d === true),
    deletion: gate.deletion ?? (gate.status === 'loading' ? 'loading' : null),
    organiserHomeTo: organiserAreaHome(flags),
  };
  return { facts, state: profileSides(facts), openRequestCount: facts.openRequestCount };
}
