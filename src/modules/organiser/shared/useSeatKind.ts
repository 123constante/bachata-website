import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchOrganiserOwnership, organiserOwnershipQueryKey } from './ownershipApi';
import type { SeatKind } from './ownership';

/** The caller's seat on one organiser (null while unknown: never a guess, so nothing is hidden early). */
export function useSeatKind(organiserId: string | undefined): SeatKind | null {
  return useSeatState(organiserId).seat;
}

/** Same read, plus whether it has landed (known = the ownership read succeeded; failed = it errored, so a screen can say so and offer a retry). */
export function useSeatState(organiserId: string | undefined): { seat: SeatKind | null; known: boolean; failed: boolean; retry: () => void } {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: organiserOwnershipQueryKey(organiserId, user?.id),
    queryFn: () => fetchOrganiserOwnership(organiserId!),
    enabled: !!organiserId && !!user?.id,
    staleTime: 60_000,
  });
  return { seat: q.data?.seat_kind ?? null, known: q.isSuccess, failed: q.isError, retry: () => { void q.refetch(); } };
}
