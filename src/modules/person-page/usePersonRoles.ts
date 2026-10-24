import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadPersonSnapshot, type PersonSnapshot } from './reads';
import type { PersonRole } from './personRoles';

/** The snapshot's cache key: the hook below and the /dancers/:id loader's seed (S7) share it. */
export const personSnapshotKey = (id: string | undefined) => ['person-snapshot', id] as const;

/**
 * Person `id`'s snapshot, one cached read per person (5 min). It reads only after mount, so an
 * empty cache renders the same on the server and the first client paint. A loader may seed the
 * cache (S7: /dancers/:id with flags.personWorlds): then both renders use that answer, and a stale
 * one is refetched after mount as usual. `answered` = the read finished (row, null, or error).
 */
export function usePersonSnapshot(id: string | undefined): { snapshot: PersonSnapshot | null; answered: boolean } {
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { data, isFetched } = useQuery({
    queryKey: personSnapshotKey(id),
    queryFn: () => loadPersonSnapshot(qc, id as string),
    enabled: mounted && !!id,
    staleTime: 5 * 60 * 1000,
  });
  return { snapshot: data ?? null, answered: isFetched };
}

/** The roles of person `id` (after mount, or from a loader's seed). */
export function usePersonRoles(id: string | undefined): PersonRole[] {
  return usePersonSnapshot(id).snapshot?.roles ?? [];
}
