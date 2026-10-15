import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
// The raw read (api/gateRpc), not api/rpc: this hook rides in the catchall's
// every-route chunk via RedirectIfAllowed, and every failure here means closed anyway.
import { fetchGateRaw } from '../api/gateRpc';

/**
 * The client half of the dancer-area gate (INTERFACE section 5). The server
 * (dancer_area_gate_v1 + _dancer_area_require_v1 in every member RPC) is the
 * authority; this hook only decides what to RENDER.
 *
 * - Signed out: NO request at all (the query is disabled), and the answer is
 *   {ready, open: false, allowed: false}. A signed-out visitor never pays for
 *   the gate.
 * - Signed in: one react-query read per person, cached 60s.
 * - Error (network, RPC missing, odd shape): fails CLOSED, allowed false.
 */
export type DancerAreaState = { status: 'loading' | 'ready' | 'error'; open: boolean; allowed: boolean };

export const DANCER_AREA_STALE_MS = 60_000;

export const dancerAreaGateKey = (userId: string | null | undefined) => ['dancer-area-gate', userId ?? 'anon'] as const;

const CLOSED_READY: DancerAreaState = { status: 'ready', open: false, allowed: false };

export function useDancerArea(): DancerAreaState {
  const { user } = useAuth();
  const signedIn = Boolean(user && !user.is_anonymous);
  const q = useQuery({
    queryKey: dancerAreaGateKey(signedIn ? user?.id : null),
    queryFn: fetchGateRaw,
    enabled: signedIn,
    staleTime: DANCER_AREA_STALE_MS,
    retry: 1,
  });

  if (!signedIn) return CLOSED_READY;
  if (q.data) return { status: 'ready', open: q.data.open, allowed: q.data.allowed };
  // Failed, or paused offline with nothing cached: closed.
  if (q.isError || (q.isPending && q.isPaused)) return { status: 'error', open: false, allowed: false };
  return { status: 'loading', open: false, allowed: false };
}
