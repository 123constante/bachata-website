import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { eventGuestListQueryKey } from './useEventGuestList';

export type SubmitGuestListReason =
  | 'duplicate_name'
  | 'cutoff_passed'
  | 'name_required'
  | 'guest_list_not_enabled';

export type SubmitGuestListResult =
  | { ok: true; entry_id: string }
  | { ok: false; reason: SubmitGuestListReason };

export const useSubmitGuestListEntry = (eventId: string | null | undefined) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation<SubmitGuestListResult, Error, string>({
    mutationFn: async (firstName) => {
      if (!eventId) throw new Error('eventId is required');
      const { data, error } = await (supabase.rpc as any)('submit_guest_list_entry', {
        p_event_id: eventId,
        p_first_name: firstName,
      });
      if (error) throw error;
      return data as SubmitGuestListResult;
    },
    onSuccess: (result) => {
      if (result.ok) {
        toast({ title: "You're on the list! 🎉" });
        queryClient.invalidateQueries({ queryKey: eventGuestListQueryKey(eventId) });
        return;
      }
      switch (result.reason) {
        case 'duplicate_name':
          toast({
            title: "Someone beat you to it! That name's already taken 😉",
            variant: 'destructive',
          });
          break;
        case 'cutoff_passed':
          toast({ title: 'Guest list is closed', variant: 'destructive' });
          queryClient.invalidateQueries({ queryKey: eventGuestListQueryKey(eventId) });
          break;
        case 'name_required':
          toast({ title: 'Please enter your first name', variant: 'destructive' });
          break;
        case 'guest_list_not_enabled':
          toast({ title: 'Guest list is not available', variant: 'destructive' });
          break;
      }
    },
    onError: (err) => {
      toast({
        title: 'Something went wrong',
        description: err.message,
        variant: 'destructive',
      });
    },
  });
};
