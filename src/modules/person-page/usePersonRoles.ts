import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadPersonSnapshot, type PersonSnapshot } from './reads';
import type { PersonRole } from './personRoles';

/**
 * Client-only (after mount, so hydration is untouched): person `id`'s snapshot, one cached
 * read per person (5 min). `answered` = the read finished (with a row, null, or an error).
 */
export function usePersonSnapshot(id: string | undefined): { snapshot: PersonSnapshot | null; answered: boolean } {
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { data, isFetched } = useQuery({
    queryKey: ['person-snapshot', id],
    queryFn: () => loadPersonSnapshot(qc, id as string),
    enabled: mounted && !!id,
    staleTime: 5 * 60 * 1000,
  });
  return { snapshot: data ?? null, answered: isFetched };
}

/** Client-only (after mount, so hydration is untouched): the roles of person `id`. */
export function usePersonRoles(id: string | undefined): PersonRole[] {
  return usePersonSnapshot(id).snapshot?.roles ?? [];
}
