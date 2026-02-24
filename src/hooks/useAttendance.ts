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

  if (!error) return;

  const isSchemaCacheError =
    error.code === 'PGRST202' ||
    (typeof error.message === 'string' && error.message.toLowerCase().includes('schema cache'));

  if (!isSchemaCacheError) {
    throw error;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user?.id) {
    throw error;
  }

  if (status === null) {
    const { error: deleteError } = await supabase
      .from('event_participants')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userData.user.id);

    if (deleteError) throw deleteError;
    return;
  }

  const { error: upsertError } = await supabase
    .from('event_participants')
    .upsert(
      {
        event_id: eventId,
        user_id: userData.user.id,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,event_id' }
    );

  if (upsertError) throw upsertError;
};

export const useAttendance = (eventId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [optimisticStatus, setOptimisticStatus] = useState<AttendanceValue | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const statusQueryKey = attendanceQueryKeys.status(eventId, user?.id);

  const { data: statusFromServer } = useQuery({
    queryKey: statusQueryKey,
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error: fetchError } = await supabase
        .from('event_participants')
        .select('status')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      return (data?.status as AttendanceStatus | undefined) ?? null;
    },
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
