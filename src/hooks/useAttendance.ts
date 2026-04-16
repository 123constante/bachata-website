import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AttendanceStatus = 'interested' | 'going';
type AttendanceValue = AttendanceStatus | null;

export const attendanceQueryKeys = {
  status: (eventId: string, userId?: string) => ['event-participation', eventId, userId] as const,
  engagement: (eventId: string) => ['event-engagement', eventId] as const,
};

export const setAttendanceRpc = async (eventId: string, status: AttendanceValue) => {
  const { error } = await supabase.rpc('set_attendance', {
    p_event_id: eventId,
    p_status: status,
  });

  if (error) throw error;
};

const fetchAttendanceStatus = async (eventId: string, userId: string): Promise<AttendanceValue> => {
  const { data: occurrences } = await supabase
    .from('calendar_occurrences')
    .select('id')
    .eq('event_id', eventId)
    .order('instance_start', { ascending: true })
    .limit(10);

  if (!occurrences?.length) return null;

  const occurrenceIds = occurrences.map((o) => o.id);
  const { data: attendanceRow } = await supabase
    .from('event_attendance')
    .select('status')
    .in('occurrence_id', occurrenceIds)
    .eq('user_id', userId)
    .maybeSingle();

  return (attendanceRow?.status as AttendanceStatus) ?? null;
};

export const useAttendance = (eventId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [optimisticStatus, setOptimisticStatus] = useState<AttendanceValue | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const statusQueryKey = attendanceQueryKeys.status(eventId, user?.id);

  const { data: statusFromServer } = useQuery({
    queryKey: statusQueryKey,
    queryFn: () => fetchAttendanceStatus(eventId, user!.id),
    enabled: Boolean(eventId) && Boolean(user?.id),
  });

  const mutation = useMutation({
    mutationFn: async (nextStatus: AttendanceValue) => {
      if (!user?.id) {
        throw new Error('Not authenticated');
      }
      await setAttendanceRpc(eventId, nextStatus);
      return nextStatus;
    },
    onMutate: async (nextStatus) => {
      setError(null);
      const previousStatus = (queryClient.getQueryData(statusQueryKey) as AttendanceValue | undefined) ?? null;
      setOptimisticStatus(nextStatus);
      queryClient.setQueryData(statusQueryKey, nextStatus);

      return { previousStatus };
    },
    onError: (mutationError, _nextStatus, context) => {
      const rollbackStatus = context?.previousStatus ?? null;
      queryClient.setQueryData(statusQueryKey, rollbackStatus);
      setOptimisticStatus(rollbackStatus);
      setError(mutationError instanceof Error ? mutationError.message : 'Failed to update attendance');
    },
    onSuccess: (nextStatus) => {
      queryClient.setQueryData(statusQueryKey, nextStatus);
      setOptimisticStatus(undefined);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.engagement(eventId) });
      void queryClient.invalidateQueries({ queryKey: statusQueryKey });
    },
  });

  const currentStatus = useMemo(() => {
    if (optimisticStatus !== undefined) return optimisticStatus;
    return (statusFromServer ?? null) as AttendanceValue;
  }, [optimisticStatus, statusFromServer]);

  const setStatus = async (nextStatus: AttendanceStatus) => {
    const targetStatus: AttendanceValue = currentStatus === nextStatus ? null : nextStatus;
    await mutation.mutateAsync(targetStatus);
  };

  return {
    currentStatus,
    setStatus,
    isLoading: mutation.isPending,
    error,
  };
};
