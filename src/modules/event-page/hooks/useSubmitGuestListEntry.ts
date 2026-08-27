import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  entryStatus,
  eventGuestListQueryKey,
  hasSpotAvailable,
  mergeEntry,
  removeEntry,
  type EventGuestList,
  type GuestListEntry,
  type GuestListEntryStatus,
} from './useEventGuestList';
import {
  guestListReasonMessage,
  type SubmitGuestListReason,
} from '@/modules/event-page/utils/guestListReasons';

export type { SubmitGuestListReason };

export type SubmitGuestListResult =
  | {
      ok: true;
      entry_id: string;
      /** P6: 'waitlist' when the night was full and a waitlist is offered. */
      status?: GuestListEntryStatus;
      occurrence_id?: string | null;
      occurrence_p5_id?: string | null;
    }
  | { ok: false; reason: SubmitGuestListReason | string };

type MutationContext = {
  tempId: string;
  firstName: string;
  optimisticStatus: GuestListEntryStatus;
};

/** Amber, not red: landing on the waitlist is a SUCCESS, just not the one with confetti. */
const WAITLIST_TOAST_CLASS =
  'border-amber-500/40 bg-amber-500/10 text-amber-100 [&_*]:text-amber-100';

const makeTempId = (): string => {
  // crypto.randomUUID exists in all modern browsers; guard for very old
  // ones just in case.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `pending-${crypto.randomUUID()}`;
  }
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Narrow the RPC's `Json` return. An unrecognisable body is turned into an ok:false with an
 * empty reason rather than being trusted as a success -- guestListReasonMessage's fallback
 * then produces a visible message, which is the behaviour this hook exists to guarantee.
 */
const coerceResult = (data: unknown): SubmitGuestListResult => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, reason: '' };
  }
  const raw = data as Record<string, unknown>;
  if (raw.ok === true && typeof raw.entry_id === 'string') {
    return {
      ok: true,
      entry_id: raw.entry_id,
      status: raw.status === 'waitlist' ? 'waitlist' : 'active',
      occurrence_id: typeof raw.occurrence_id === 'string' ? raw.occurrence_id : null,
      occurrence_p5_id: typeof raw.occurrence_p5_id === 'string' ? raw.occurrence_p5_id : null,
    };
  }
  return { ok: false, reason: typeof raw.reason === 'string' ? raw.reason : '' };
};

export const useSubmitGuestListEntry = (eventId: string | null | undefined) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation<SubmitGuestListResult, Error, string, MutationContext>({
    mutationFn: async (firstName) => {
      if (!eventId) throw new Error('eventId is required');
      const { data, error } = await supabase.rpc('submit_guest_list_entry', {
        p_event_id: eventId,
        p_first_name: firstName,
      });
      if (error) throw error;
      return coerceResult(data);
    },

    onMutate: async (firstName) => {
      if (!eventId) return { tempId: '', firstName, optimisticStatus: 'active' as const };

      // Stop any in-flight refetch so it can't overwrite our optimistic row.
      await queryClient.cancelQueries({ queryKey: eventGuestListQueryKey(eventId) });

      const trimmed = firstName.trim();
      const tempId = makeTempId();

      // HONEST OPTIMISM. The optimistic row takes the status the server is going to give it,
      // as far as the client can tell: `spots_left` is the door number the server compares
      // against, so when it has run out the pill goes up amber rather than flashing green and
      // being corrected a moment later.
      const current = queryClient.getQueryData<EventGuestList>(eventGuestListQueryKey(eventId));
      const optimisticStatus: GuestListEntryStatus = hasSpotAvailable(current)
        ? 'active'
        : 'waitlist';

      const optimistic: GuestListEntry = {
        id: tempId,
        first_name: trimmed,
        created_at: new Date().toISOString(),
        status: optimisticStatus,
        pending: true,
      };

      mergeEntry(queryClient, eventId, optimistic);

      return { tempId, firstName: trimmed, optimisticStatus };
    },

    onSuccess: (result, _firstName, context) => {
      if (!eventId) return;

      if (result.ok) {
        const status: GuestListEntryStatus = result.status === 'waitlist' ? 'waitlist' : 'active';

        // Upgrade the pending row to the confirmed one. mergeEntry matches
        // by normalized first_name and replaces the pending entry in place,
        // so if the realtime INSERT has already arrived this is a no-op —
        // unless the status differs, in which case the server's ruling wins.
        mergeEntry(queryClient, eventId, {
          id: result.entry_id,
          first_name: context?.firstName ?? '',
          created_at: new Date().toISOString(),
          status,
        });

        if (status === 'waitlist') {
          // Position is derived from the cache we just updated: how many queued rows sit at
          // or before this one. It is a display nicety, so a miss degrades to no number
          // rather than to a wrong one.
          const list = queryClient.getQueryData<EventGuestList>(eventGuestListQueryKey(eventId));
          const position = list
            ? list.entries.filter((e) => entryStatus(e) === 'waitlist').length
            : 0;
          toast({
            title: position > 0 ? `You're on the waitlist — #${position}` : "You're on the waitlist",
            description: 'We’ll move you onto the list automatically if a spot frees up.',
            className: WAITLIST_TOAST_CLASS,
          });
        }
        return;
      }

      // Server said no — roll back the optimistic row.
      if (context?.tempId) {
        removeEntry(queryClient, eventId, context.tempId);
      }

      // ONE lookup, TOTAL by construction. Before P6 this was a `switch` with no `default:`,
      // so a reason it did not name removed the dancer's pill and said nothing at all.
      const message = guestListReasonMessage(result.reason);

      if (message.invalidates) {
        queryClient.invalidateQueries({ queryKey: eventGuestListQueryKey(eventId) });
      }

      // duplicate_name is rendered by the calling component as the collision card, which lets
      // the dancer disambiguate in place. A toast on top of it would be noise.
      if (message.handledByCaller) return;

      toast({
        title: message.title,
        description: message.description,
        variant: message.destructive ? 'destructive' : 'default',
      });
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
