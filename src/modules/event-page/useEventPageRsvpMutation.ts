import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { eventPageQueryKey } from '@/modules/event-page/useEventPageQuery';

export type RsvpStatus = 'going' | 'interested' | null;

type UseEventPageRsvpMutationArgs = {
  eventId?: string | null;
  occurrenceId?: string | null;
  userId?: string | null;
};

export const useEventPageRsvpMutation = ({ eventId, occurrenceId, userId }: UseEventPageRsvpMutationArgs) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ status }: { status: RsvpStatus }) => {
      if (!occurrenceId || !userId) {
        throw new Error('Attendance requires an occurrence and an authenticated user');
      }

      if (status === null) {
        const { error } = await supabase
          .from('event_attendance')
          .delete()
          .eq('occurrence_id', occurrenceId)
          .eq('user_id', userId);

        if (error) throw error;
        return null;
      }

      const { error } = await supabase
        .from('event_attendance')
        .upsert(
          { occurrence_id: occurrenceId, user_id: userId, status },
          { onConflict: 'occurrence_id,user_id' },
        );

      if (error) throw error;
      return status;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventPageQueryKey(eventId, occurrenceId) });
    },
  });
};
