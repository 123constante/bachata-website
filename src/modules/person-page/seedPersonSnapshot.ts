import type { QueryClient } from '@tanstack/react-query';
import { PUBLIC_PAGE_DEADLINE_MS } from '@/modules/dancer-app/public-page/loadPublicPage';
import { loadPersonSnapshot } from './reads';
import { personSnapshotKey } from './usePersonRoles';

/**
 * People arc S7: the /dancers/:id loader reads the person snapshot (roles, closed-page filter
 * included) on the server and seeds usePersonSnapshot's key, so the served HTML already has the role
 * tabs and the preview reserve (no 1.7s shift). The SAME read as the hook and /people/:id.
 * Never rejects, never blocks past its own deadline (loadPublicPageV2's pattern): a failed or late
 * read seeds nothing = the old behaviour (the hook reads after mount). A late answer is dropped.
 */
export async function seedPersonSnapshot(qc: QueryClient, id: string, deadlineMs = PUBLIC_PAGE_DEADLINE_MS): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('person snapshot read timed out')), deadlineMs);
  });
  try {
    const snapshot = await Promise.race([loadPersonSnapshot(qc, id), deadline]);
    qc.setQueryData(personSnapshotKey(id), snapshot);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
