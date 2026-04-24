import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { mergeEntry, type GuestListEntry } from './useEventGuestList';

type RealtimeRow = {
  id: string;
  event_id: string;
  first_name: string;
  created_at: string;
};

/**
 * Subscribes to INSERT events on public.event_guest_list_entries filtered
 * by event_id. Merges incoming rows into the React Query cache via
 * mergeEntry, which dedupes own-echoes against a pending optimistic row.
 *
 * No-ops when eventId is null/undefined (e.g. still loading).
 */
export const useGuestListRealtime = (eventId: string | null | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`guest_list:${eventId}`)
      .on<RealtimeRow>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_guest_list_entries',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const row = payload.new;
          if (!row || row.event_id !== eventId) return;
          const entry: GuestListEntry = {
            id: row.id,
            first_name: row.first_name,
            created_at: row.created_at,
          };
          mergeEntry(queryClient, eventId, entry);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, queryClient]);
};
