import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { rpcLoose } from '@/integrations/supabase/rpcLoose';
import { useAuth } from '@/hooks/useAuth';
import { londonTodayKey } from '@/lib/londonDate';
import { mapNights, type AttendanceRow, type MappedNights } from './nightsModel';

export const ATTENDANCE_RPC = 'get_my_event_attendance_v2';
export const myNightsQueryKey = (userId: string | undefined) => ['dancer-app', 'my-nights', userId ?? null] as const;

/** Thin wrapper over the EXISTING attendance read (no new RPC). */
export const fetchMyNights = async (): Promise<AttendanceRow[]> => {
  const { data, error } = await rpcLoose(ATTENDANCE_RPC);
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? (data as AttendanceRow[]) : [];
};

export const useMyNights = (): {
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
  todayKey: string;
  nights: MappedNights;
} => {
  const { user } = useAuth();
  const todayKey = londonTodayKey();
  const q = useQuery({
    queryKey: myNightsQueryKey(user?.id),
    queryFn: fetchMyNights,
    enabled: Boolean(user?.id),
    staleTime: 2 * 60_000,
  });
  const nights = useMemo(() => mapNights(q.data ?? [], todayKey), [q.data, todayKey]);
  return { isLoading: q.isLoading, isError: q.isError, retry: () => void q.refetch(), todayKey, nights };
};
