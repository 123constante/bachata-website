import { useQuery, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * The status a guest entry holds. `active` = on the list; `waitlist` = queued behind a full
 * capacity, promoted automatically when a slot frees. The server also stores `ineligible` and
 * `erased`, but neither is ever published: get_event_guest_list filters to these two.
 */
export type GuestListEntryStatus = 'active' | 'waitlist';

export type GuestListEntry = {
  first_name: string;
  created_at: string;
  /**
   * Server-set from P6 (migration 20260827210000). Optional because an optimistic row is
   * created before the server has ruled, and because a cached response from a pre-P6 build
   * may still be in flight; `entryStatus()` resolves the absent case to 'active', which is
   * what the pre-P6 payload effectively meant (it published no waitlist rows).
   */
  status?: GuestListEntryStatus;
  /**
   * Present ONLY for rows this client minted or received over realtime: an optimistic insert
   * (temp id `pending-<uuid>`), the mutation's own `entry_id`, or a realtime row.
   *
   * NOT present on rows hydrated from `get_event_guest_list`. That payload publishes
   * `first_name` / `created_at` / `status` and NOTHING ELSE -- deliberately, since the entry
   * uuids must not reach an anon caller. So a freshly loaded list holds entries with no id at
   * all, and anything that matches on id will silently miss every one of them. Match by
   * normalized `first_name` (see `removeEntryByName`), which is the key the rest of this
   * module uses and is unique per night by the dedup index.
   */
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

/**
 * The public guest-list payload.
 *
 * THE THREE COUNTS ARE NOT THE SAME NUMBER (this mirrors the contract stated in the server
 * migration; keep the two in step):
 *   * `count` / `active_count` -- how many ACTIVE dancers are in `entries`, the list rendered
 *     on the page. From P6 `count` is active-only; before P6 it was active+waitlist. The key
 *     was kept and the semantics corrected.
 *   * `waitlist_count` -- how many of `entries` are queued.
 *   * `spots_left` -- capacity minus the DOOR headcount, which also counts permanent VIPs that
 *     `entries` may not be showing yet. It is the number the server will actually compare
 *     against when this dancer taps, so it -- not `active_count` -- decides whether the next
 *     sign-up lands active or on the waitlist. `null` means uncapped.
 */
export type EventGuestList = {
  enabled: boolean;
  count: number;
  entries: GuestListEntry[];
  config: GuestListConfig;
  cutoff_passed: boolean;
  active_count: number;
  waitlist_count: number;
  capacity_max: number | null;
  /**
   * `null` on an uncapped event, meaning NOT APPLICABLE rather than "no". The server never
   * consults the flag when there is no cap, so publishing `true` there would promise
   * waitlisting from a code path that cannot run. Only ever read alongside `capacity_max`.
   */
  waitlist_enabled: boolean | null;
  spots_left: number | null;
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
  active_count: 0,
  waitlist_count: 0,
  capacity_max: null,
  waitlist_enabled: null,
  spots_left: null,
};

export const eventGuestListQueryKey = (eventId: string | null | undefined) =>
  ['event-guest-list', eventId ?? null] as const;

/** The list's identity key for a dancer. Exported so callers match rows the same way
 *  the cache merges them -- the public payload carries no ids, so this IS the key. */
export const normalize = (name: string) => name.trim().toLowerCase();

/** An entry with no status is treated as active -- see GuestListEntry.status. */
export const entryStatus = (entry: GuestListEntry): GuestListEntryStatus =>
  entry.status === 'waitlist' ? 'waitlist' : 'active';

/**
 * Does the next sign-up have a real slot waiting for it?
 *
 * `spots_left` is authoritative and `null` means uncapped. This is what gates optimistic
 * celebration: confetti is honest only when the server is going to say 'active'.
 */
export const hasSpotAvailable = (list: EventGuestList | undefined): boolean => {
  if (!list) return true;
  if (list.spots_left === null) return true;
  return list.spots_left > 0;
};

/**
 * Rebuild the derived counters from the entries array.
 *
 * The counters are NOT maintained incrementally any more. They used to be (`count: prev.count
 * + 1` on every merge), and that could not survive P6: a waitlist arrival must not bump the
 * active count, and a promotion arrives as an UPDATE that changes a status without changing
 * the array length. Deriving them removes the whole class.
 *
 * `spots_left` is the exception and is adjusted by DELTA, not recomputed: it is a door count
 * that includes permanent VIPs the payload may not be displaying, so the client cannot
 * rebuild it -- but it can track how much this change moved it. A public sign-up lands in the
 * displayed set for the current night and at the door, so the two move together by one.
 *
 * THE DELTA IS NOT CLAMPED, deliberately. It used to be `Math.max(0, ...)`, which made the
 * adjustment non-reversible and could INVENT a spot on a full night: with `spots_left` at 0,
 * someone else's arrival clamps the -1 away, and the later removal of that same row adds a
 * +1 that was never subtracted -- leaving 1 free spot on a night that is still full, which
 * re-arms confetti and an 'active' optimistic pill the server will waitlist. `spots_left` is
 * never RENDERED as a number (every consumer is a `> 0` predicate), so letting it go
 * transiently negative is both harmless and more truthful than a floor.
 */
const withEntries = (prev: EventGuestList, nextEntries: GuestListEntry[]): EventGuestList => {
  let active = 0;
  let waitlist = 0;
  for (const e of nextEntries) {
    if (entryStatus(e) === 'waitlist') waitlist += 1;
    else active += 1;
  }
  const activeDelta = active - prev.active_count;
  return {
    ...prev,
    entries: nextEntries,
    count: active,
    active_count: active,
    waitlist_count: waitlist,
    spots_left: prev.spots_left === null ? null : prev.spots_left - activeDelta,
  };
};

/**
 * Insert or upgrade a guest entry in the React Query cache.
 *
 * - If no entry matches by normalized first_name, append the incoming entry.
 * - If an existing entry matches:
 *     * existing is pending + incoming is confirmed → replace (upgrade id and status)
 *     * the status changed (a waitlist row promoted to active) → replace
 *     * otherwise → no-op (already present; this is the own-echo case)
 *
 * Counters are re-derived by withEntries in every branch that changes the array.
 *
 * Used by:
 *   * useSubmitGuestListEntry.onMutate — inserts a pending row
 *   * useSubmitGuestListEntry.onSuccess — upgrades pending → confirmed
 *   * useGuestListRealtime — upgrades pending when the Supabase realtime
 *     INSERT echoes our own row, appends if it's someone else's row, and
 *     applies UPDATEs (waitlist → active promotions)
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
        const upgradesPending = Boolean(existing.pending) && !entry.pending;
        const changesStatus = entryStatus(existing) !== entryStatus(entry);

        if (upgradesPending || changesStatus) {
          const nextEntries = [...prev.entries];
          // The incoming row REPLACES the existing one; only the id falls back, for a
          // realtime UPDATE that arrives without one. `pending` is taken from the incoming
          // row alone and never inherited: spreading `...existing` first would leave an
          // upgraded row marked pending forever, and the collision check skips pending rows
          // — so the dancer's own name would stop blocking their own duplicate submit.
          nextEntries[matchIdx] = {
            ...entry,
            id: entry.id ?? existing.id,
            pending: entry.pending === true,
          };
          return withEntries(prev, nextEntries);
        }
        // Already present (own-echo or duplicate server push) — skip.
        return prev;
      }

      return withEntries(prev, [...prev.entries, entry]);
    },
  );
};

/**
 * Remove an entry from the cache by id. Used to roll back an optimistic
 * insert when the mutation fails. Silently no-ops if the id is not found.
 *
 * ONLY for rows this client minted -- an optimistic row's tempId. A row hydrated from the
 * RPC has NO id (see `GuestListEntry.id`), so an id-keyed removal cannot touch it. To drop a
 * row the server published, use `removeEntryByName`.
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
      return withEntries(prev, prev.entries.filter((e) => e.id !== id));
    },
  );
};

/**
 * Remove an entry from the cache by normalized first_name. Silently no-ops if no row matches.
 *
 * THIS IS THE ONE THAT WORKS ON SERVER-HYDRATED ROWS. `removeEntry` keys on id, and the
 * public payload carries none, so it can only ever drop rows this client minted itself. The
 * de-publish path in useGuestListRealtime -- a row soft-deleted or moved to a status the
 * payload never publishes -- has to reach rows that came from the RPC, which means matching
 * on the same key `mergeEntry` already merges on. Unique per night by the dedup index.
 */
export const removeEntryByName = (
  queryClient: QueryClient,
  eventId: string,
  firstName: string,
): void => {
  const key = normalize(firstName);
  queryClient.setQueryData<EventGuestList>(
    eventGuestListQueryKey(eventId),
    (prev) => {
      if (!prev) return prev;
      const next = prev.entries.filter((e) => normalize(e.first_name) !== key);
      if (next.length === prev.entries.length) return prev;
      return withEntries(prev, next);
    },
  );
};

/**
 * Narrow the RPC's `Json` return to the payload contract, filling anything the server did not
 * send. A build talking to a pre-P6 database still renders: the new keys fall back to the
 * "uncapped, nothing queued" shape, which is what every event in the fleet actually is.
 */
const coerceGuestList = (data: unknown): EventGuestList => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return EMPTY_GUEST_LIST;
  const raw = data as Partial<EventGuestList> & Record<string, unknown>;
  if (!raw.enabled) return EMPTY_GUEST_LIST;

  const entries = Array.isArray(raw.entries) ? (raw.entries as GuestListEntry[]) : [];
  const activeCount =
    typeof raw.active_count === 'number'
      ? raw.active_count
      : entries.filter((e) => entryStatus(e) === 'active').length;

  return {
    enabled: true,
    entries,
    config: { ...EMPTY_GUEST_LIST.config, ...(raw.config as GuestListConfig | undefined) },
    cutoff_passed: Boolean(raw.cutoff_passed),
    count: typeof raw.count === 'number' ? raw.count : activeCount,
    active_count: activeCount,
    waitlist_count:
      typeof raw.waitlist_count === 'number'
        ? raw.waitlist_count
        : entries.filter((e) => entryStatus(e) === 'waitlist').length,
    capacity_max: typeof raw.capacity_max === 'number' ? raw.capacity_max : null,
    // Absent (pre-P6 server) and JSON null (P6, uncapped event) both mean "not applicable".
    waitlist_enabled: typeof raw.waitlist_enabled === 'boolean' ? raw.waitlist_enabled : null,
    spots_left: typeof raw.spots_left === 'number' ? raw.spots_left : null,
  };
};

export const useEventGuestList = (eventId: string | null | undefined) => {
  return useQuery<EventGuestList>({
    queryKey: eventGuestListQueryKey(eventId),
    queryFn: async () => {
      if (!eventId) return EMPTY_GUEST_LIST;
      const { data, error } = await supabase.rpc('get_event_guest_list', {
        p_event_id: eventId,
      });
      if (error) throw new Error(error.message ?? JSON.stringify(error));
      return coerceGuestList(data);
    },
    enabled: Boolean(eventId),
    staleTime: 10_000,
  });
};
