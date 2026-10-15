import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfileCompletion } from '@/hooks/useProfileCompletion';
import { profileSides, type SidesFacts, type SidesState } from '@/lib/accountRouting';
import { completenessFact } from '@/lib/profileCompletion';
import { useDancerArea } from '@/modules/dancer-app/gate/useDancerArea';
import { fetchMyDancerEdit } from '@/modules/dancer-app/api/rpc';
import { myDancerEditKey } from '@/modules/dancer-app/api/useMyDancerEdit';
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
  const facts: SidesFacts = {
    organisers: fact(home, (d) => d.organisers.map((o) => ({ id: o.id, name: o.name, avatar_url: o.avatar_url }))),
    dancer: kind,
    areaAllowed: area.status === 'loading' ? undefined : area.allowed,
    dancerFace: face.data ? { firstName: face.data.first_name, avatarUrl: face.data.avatar_url } : null,
  };
  return {
    facts,
    state: profileSides(facts),
    openRequestCount: fact(requests, (d) => d.filter((r) => r.status === 'open').length),
  };
}
