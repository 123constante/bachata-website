import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  eventGuestListQueryKey,
  mergeEntry,
  removeEntry,
  type GuestListEntry,
} from './useEventGuestList';

export type SubmitGuestListReason =
  | 'duplicate_name'
  | 'cutoff_passed'
  | 'name_required'
  | 'name_too_long'
  | 'guest_list_not_enabled'
  | 'event_not_found';

export type SubmitGuestListResult =
  | { ok: true; entry_id: string }
  | { ok: false; reason: SubmitGuestListReason };

type MutationContext = {
  tempId: string;
  firstName: string;
};

const makeTempId = (): string => {
  // crypto.randomUUID exists in all modern browsers; guard for very old
  // ones just in case.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `pending-${crypto.randomUUID()}`;
  }
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const useSubmitGuestListEntry = (eventId: string | null | undefined) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation<SubmitGuestListResult, Error, string, MutationContext>({
    mutationFn: async (firstName) => {
      if (!eventId) throw new Error('eventId is required');
      const { data, error } = await (supabase.rpc as any)('submit_guest_list_entry', {
        p_event_id: eventId,
        p_first_name: firstName,
      });
      if (error) throw error;
      return data as SubmitGuestListResult;
    },

    onMutate: async (firstName) => {
      if (!eventId) return { tempId: '', firstName };

      // Stop any in-flight refetch so it can't overwrite our optimistic row.
      await queryClient.cancelQueries({ queryKey: eventGuestListQueryKey(eventId) });

      const trimmed = firstName.trim();
      const tempId = makeTempId();
      const optimistic: GuestListEntry = {
        id: tempId,
        first_name: trimmed,
        created_at: new Date().toISOString(),
        pending: true,
      };

      mergeEntry(queryClient, eventId, optimistic);

      return { tempId, firstName: trimmed };
    },

    onSuccess: (result, _firstName, context) => {
      if (!eventId) return;

      if (result.ok) {
        // Upgrade the pending row to the confirmed one. mergeEntry matches
        // by normalized first_name and replaces the pending entry in place,
        // so if the realtime INSERT has already arrived this is a no-op.
        mergeEntry(queryClient, eventId, {
          id: result.entry_id,
          first_name: context?.firstName ?? '',
          created_at: new Date().toISOString(),
        });
        return;
      }

      // Server said no — roll back the optimistic row.
      if (context?.tempId) {
        removeEntry(queryClient, eventId, context.tempId);
      }

      switch (result.reason) {
        case 'duplicate_name':
          // Handled by the calling component (GuestListSection renders the
          // Variant B collision card). No toast here.
          break;
        case 'cutoff_passed':
          toast({ title: 'Guest list is closed', variant: 'destructive' });
          queryClient.invalidateQueries({ queryKey: eventGuestListQueryKey(eventId) });
          break;
        case 'name_required':
          toast({ title: 'Please enter your first name', variant: 'destructive' });
          break;
        case 'name_too_long':
          toast({
            title: 'That name is too long',
            description: 'Keep it under 80 characters.',
            variant: 'destructive',
          });
          break;
        case 'guest_list_not_enabled':
          toast({ title: 'Guest list is not available', variant: 'destructive' });
          queryClient.invalidateQueries({ queryKey: eventGuestListQueryKey(eventId) });
          break;
        case 'event_not_found':
          toast({ title: 'Event not found', variant: 'destructive' });
          break;
      }
    },

    onError: (err, _firstName, context) => {
      if (eventId && context?.tempId) {
        removeEntry(queryClient, eventId, context.tempId);
      }
      toast({
        title: 'Something went wrong',
        description: err.message,
        variant: 'destructive',
      });
    },
  });
};
