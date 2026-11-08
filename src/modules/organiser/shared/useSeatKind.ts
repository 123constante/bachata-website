import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchOrganiserOwnership, organiserOwnershipQueryKey } from './ownershipApi';
import type { SeatKind } from './ownership';

/** The caller's seat on one organiser (null while unknown: never a guess, so nothing is hidden early). */
export function useSeatKind(organiserId: string | undefined): SeatKind | null {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: organiserOwnershipQueryKey(organiserId, user?.id),
    queryFn: () => fetchOrganiserOwnership(organiserId!),
    enabled: !!organiserId && !!user?.id,
    staleTime: 60_000,
  });
  return q.data?.seat_kind ?? null;
}
