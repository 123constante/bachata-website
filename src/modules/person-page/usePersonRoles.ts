import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadPersonSnapshot } from './reads';
import type { PersonRole } from './personRoles';

/** Client-only (after mount, so hydration is untouched): the roles of person `id`. */
export function usePersonRoles(id: string | undefined): PersonRole[] {
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { data } = useQuery({
    queryKey: ['person-snapshot', id],
    queryFn: () => loadPersonSnapshot(qc, id as string),
    enabled: mounted && !!id,
    staleTime: 5 * 60 * 1000,
  });
  return data?.roles ?? [];
}
