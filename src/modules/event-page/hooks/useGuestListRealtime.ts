import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  mergeEntry,
  removeEntry,
  type GuestListEntry,
  type GuestListEntryStatus,
} from './useEventGuestList';

type RealtimeRow = {
  id: string;
  event_id: string;
  first_name: string;
  created_at: string;
  status?: string | null;
  deleted_at?: string | null;
};

/** Only these two are ever published; anything else means the row has left the list. */
const PUBLISHED: GuestListEntryStatus[] = ['active', 'waitlist'];

const publishedStatus = (row: RealtimeRow): GuestListEntryStatus | null => {
  if (row.deleted_at) return null;
  // A pre-P6 row (or a payload without the column) is active by the same rule the read hook
  // uses. Only an explicitly non-published status removes a row.
  if (row.status == null) return 'active';
  return (PUBLISHED as string[]).includes(row.status) ? (row.status as GuestListEntryStatus) : null;
};

/**
 * Subscribes to INSERT and UPDATE events on public.event_guest_list_entries filtered
 * by event_id. Merges incoming rows into the React Query cache via mergeEntry, which
 * dedupes own-echoes against a pending optimistic row and re-derives the counters.
 *
 * WHY UPDATE IS SUBSCRIBED (P6). Waitlist promotions are UPDATEs, not INSERTs: when a slot
 * frees, _promote_waitlist_v1 flips an existing row from 'waitlist' to 'active' in place. An
 * INSERT-only subscription would never see it, so the public count would sit stale until the
 * next refetch — the page would keep showing the promoted dancer as queued. Merging by name
 * (the same key the rest of this module uses, and unique per night by the dedup index) lets
 * mergeEntry replace the row in place and re-derive both counters from it.
 *
 * A row that leaves the published set (soft-deleted, or moved to a status the payload never
 * publishes) is REMOVED rather than merged. Realtime applies RLS to the new record, so such
 * an update usually does not reach us at all; handling it here means that when it does, the
 * list drops the row instead of holding it until the next refetch.
 *
 * No-ops when eventId is null/undefined (e.g. still loading).
 */
export const useGuestListRealtime = (eventId: string | null | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!eventId) return;

    const apply = (row: RealtimeRow | null | undefined) => {
      if (!row || row.event_id !== eventId) return;

      const status = publishedStatus(row);
      if (status === null) {
        removeEntry(queryClient, eventId, row.id);
        return;
      }

      const entry: GuestListEntry = {
        id: row.id,
        first_name: row.first_name,
        created_at: row.created_at,
        status,
      };
      mergeEntry(queryClient, eventId, entry);
    };

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
        (payload) => apply(payload.new),
      )
      .on<RealtimeRow>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'event_guest_list_entries',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => apply(payload.new),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, queryClient]);
};
