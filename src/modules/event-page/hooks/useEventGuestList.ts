import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type GuestListEntry = {
  first_name: string;
  created_at: string;
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
