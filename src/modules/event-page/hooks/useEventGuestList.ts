import { useQuery, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type GuestListEntry = {
  first_name: string;
  created_at: string;
  // Present for server-confirmed rows (real DB id) and for optimistic inserts
  // (temp id of the form `pending-<uuid>`). Optional because existing RPC
  // responses may pre-date this addition.
  id?: string;
  // True while the mutation is in flight. Used by mergeEntry to upgrade
  // a pending row to the confirmed one when the realtime INSERT echo
  // arrives (or when the mutation onSuccess fires).
  pending?: boolean;
};

export type GuestListConfig = {
  cutoff_time: string;
  discount_until: string;
  description: string;
  regular_party_price: number | null;
  guest_list_party_price: number | null;
  regular_class_party_price: number | null;
  guest_list_class_party_price: number | null;
};

export type EventGuestList = {
  enabled: boolean;
  count: number;
  entries: GuestListEntry[];
  config: GuestListConfig;
  cutoff_passed: boolean;
};

const EMPTY_GUEST_LIST: EventGuestList = {
  enabled: false,
  count: 0,
  entries: [],
  config: {
    cutoff_time: '',
    discount_until: '',
    description: '',
    regular_party_price: null,
    guest_list_party_price: null,
    regular_class_party_price: null,
    guest_list_class_party_price: null,
  },
  cutoff_passed: false,
};

export const eventGuestListQueryKey = (eventId: string | null | undefined) =>
  ['event-guest-list', eventId ?? null] as const;

const normalize = (name: string) => name.trim().toLowerCase();

/**
 * Insert or upgrade a guest entry in the React Query cache.
 *
 * - If no entry matches by normalized first_name, append the incoming entry
 *   and bump `count`.
 * - If an existing entry matches:
 *     * existing is pending + incoming is confirmed → replace (upgrade id)
 *     * otherwise → no-op (already present; this is the own-echo case)
 *
 * Used by:
 *   * useSubmitGuestListEntry.onMutate — inserts a pending row
 *   * useSubmitGuestListEntry.onSuccess — upgrades pending → confirmed
 *   * useGuestListRealtime — upgrades pending when the Supabase realtime
 *     INSERT echoes our own row, or appends if it's someone else's row
 */
export const mergeEntry = (
  queryClient: QueryClient,
  eventId: string,
  entry: GuestListEntry,
): void => {
  queryClient.setQueryData<EventGuestList>(
    eventGuestListQueryKey(eventId),
    (prev) => {
      if (!prev) return prev;

      const incomingKey = normalize(entry.first_name);
      const matchIdx = prev.entries.findIndex(
        (e) => normalize(e.first_name) === incomingKey,
      );

      if (matchIdx >= 0) {
        const existing = prev.entries[matchIdx];
        // Upgrade a pending row to the confirmed version.
        if (existing.pending && !entry.pending) {
          const nextEntries = [...prev.entries];
          nextEntries[matchIdx] = { ...entry };
          return { ...prev, entries: nextEntries };
        }
        // Already present (own-echo or duplicate server push) — skip.
        return prev;
      }

      return {
        ...prev,
        entries: [...prev.entries, entry],
        count: prev.count + 1,
      };
    },
  );
};

/**
 * Remove an entry from the cache by id. Used to roll back an optimistic
 * insert when the mutation fails. Silently no-ops if the id is not found.
 */
export const removeEntry = (
  queryClient: QueryClient,
  eventId: string,
  id: string,
): void => {
  queryClient.setQueryData<EventGuestList>(
    eventGuestListQueryKey(eventId),
    (prev) => {
      if (!prev) return prev;
      const idx = prev.entries.findIndex((e) => e.id === id);
      if (idx < 0) return prev;
      return {
        ...prev,
        entries: prev.entries.filter((e) => e.id !== id),
        count: Math.max(0, prev.count - 1),
      };
    },
  );
};

export const useEventGuestList = (eventId: string | null | undefined) => {
  return useQuery<EventGuestList>({
    queryKey: eventGuestListQueryKey(eventId),
    queryFn: async () => {
      if (!eventId) return EMPTY_GUEST_LIST;
      const { data, error } = await (supabase.rpc as any)('get_event_guest_list', {
        p_event_id: eventId,
      });
      if (error) throw error;
      if (!data || typeof data !== 'object') return EMPTY_GUEST_LIST;
      return data as EventGuestList;
    },
    enabled: Boolean(eventId),
    staleTime: 10_000,
  });
};
