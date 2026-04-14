import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { eventPageQueryKey } from '@/modules/event-page/useEventPageQuery';

type UseEventPageRsvpMutationArgs = {
  eventId?: string | null;
  occurrenceId?: string | null;
  userId?: string | null;
};

export const useEventPageRsvpMutation = ({ eventId, occurrenceId, userId }: UseEventPageRsvpMutationArgs) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nextGoing }: { nextGoing: boolean }) => {
      if (!occurrenceId || !userId) {
        throw new Error('Attendance requires an occurrence and an authenticated user');
      }

      if (nextGoing) {
        const { error } = await supabase
          .from('event_attendance')
          .insert({ occurrence_id: occurrenceId, user_id: userId });

        if (error) throw error;
        return true;
      }

      const { error } = await supabase
        .from('event_attendance')
        .delete()
        .eq('occurrence_id', occurrenceId)
        .eq('user_id', userId);

      if (error) throw error;
      return false;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventPageQueryKey(eventId, occurrenceId) });
    },
  });
};
