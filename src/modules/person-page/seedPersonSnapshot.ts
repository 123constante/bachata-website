import type { QueryClient } from '@tanstack/react-query';
import { loadPersonSnapshot } from './reads';
import { personSnapshotKey } from './usePersonRoles';

/**
 * People arc S7: the /dancers/:id loader reads the person snapshot (roles, closed-page filter
 * included) on the server and seeds usePersonSnapshot's key, so the served HTML already has the role
 * tabs and the preview reserve (no 1.7s shift). The SAME read as the hook and /people/:id.
 * Never rejects, never blocks past its own deadline (loadPublicPageV2's pattern; the route passes the
 * budget, so this module does not reach into dancer-app): a failed or late
 * read seeds nothing = the old behaviour (the hook reads after mount). A late answer is dropped.
 *
 * Returns true only for a COMPLETE answer (null included: "no public person" is an answer). false =
 * the route bounds the edge TTL: the read failed or was late (nothing written), or (S7c) it answered
 * partial -- a role read it swallows failed -- which IS written (better than nothing), marked stale,
 * and must not be edge-cached for the full hour.
 */
export async function seedPersonSnapshot(qc: QueryClient, id: string, deadlineMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('person snapshot read timed out')), deadlineMs);
  });
  try {
    const snapshot = await Promise.race([loadPersonSnapshot(qc, id), deadline]);
    // A partial answer is seeded as already stale (updatedAt 0, dehydrated with it), so the hook reads
    // again after mount and the missing tab can come back, instead of holding it for its staleTime.
    qc.setQueryData(personSnapshotKey(id), snapshot, snapshot?.partial ? { updatedAt: 0 } : undefined);
    return !snapshot?.partial;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
