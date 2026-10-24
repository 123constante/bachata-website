import { useCallback, useMemo } from 'react';
import { GOING_CHECKIN_ENABLED } from '@/lib/goingCheckin';
import { londonTodayKey } from '@/lib/londonDate';
import { useMyGoing } from '@/modules/going';
import { goingUpcomingCount, mapMyGoing, type MappedNights } from './nightsModel';

/**
 * The signed-in person's nights, from the going module's useMyGoing
 * (get_my_going_v1). Behind the going switch: while it is off no RPC runs,
 * `on` is false and the lists are empty.
 */
export const useMyNights = (): {
  /** The going switch is on (the lists can hold anything). */
  on: boolean;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
  todayKey: string;
  nights: MappedNights;
  /** THE upcoming going count (goingUpcomingCount); null until the list has loaded. */
  goingCount: number | null;
} => {
  const q = useMyGoing();
  const todayKey = londonTodayKey();
  const nights = useMemo(() => mapMyGoing(q.data), [q.data]);
  // Stable across renders, so the Home and Nights going feeds can memo their values on it.
  const { refetch } = q;
  const retry = useCallback(() => void refetch(), [refetch]);
  return {
    on: GOING_CHECKIN_ENABLED,
    isLoading: GOING_CHECKIN_ENABLED && q.isLoading,
    isError: GOING_CHECKIN_ENABLED && q.isError,
    retry,
    todayKey,
    nights,
    goingCount: q.data ? goingUpcomingCount(nights.upcoming) : null,
  };
};
