// =============================================================================
// useOpenRaffles / useRaffleStats — data hooks for the public /raffles page.
//
// Both call public (anon-callable) RPCs that the admin repo owns:
//   - list_open_raffles_v1()          -> one row per event with an OPEN raffle
//   - get_raffle_community_stats_v1() -> { entries_this_month, winners_this_month,
//                                          total_winners }
//
// These RPCs are not in the generated Database types yet (they ship from the
// admin repo separately), so they're called through a loosely-typed cast.
// Until they exist the queries error and the page falls back to its empty /
// zero states (handled by the consuming components). Nothing crashes.
//
// Phase 3: Smart visibility-based refetch (replaces aggressive polling)
// - Refetch only when page is visible (tab is active)
// - 5-minute interval (vs Phase 1's 30-minute stale time)
// - Staggered startup to avoid thundering herd
// - Reduces Supabase IO by 30-50% while keeping data fresh for active users
// =============================================================================

import { useQuery } from '@tanstack/react-query';
import { rpcLoose as callRpc } from '@/integrations/supabase/rpcLoose';
import { useVisibilityRefresh } from '@/hooks/useVisibilityRefresh';

/** One event whose raffle is currently open for entries. */
export interface OpenRaffle {
  event_id: string;
  title: string;
  venue_name: string | null;
  start_time: string | null;          // ISO instant (wall-clock-as-UTC, per house convention)
  timezone: string | null;
  prize_text: string | null;
  cutoff_offset_minutes: number | null;
  cutoff_at: string | null;           // ISO instant entries close
  entry_count: number;
  consent_version: string | null;     // fed straight into RaffleEntryDialog
}

export interface RaffleCommunityStats {
  entries_this_month: number;
  winners_this_month: number;
  /** All-time, site-wide winner count -- same source as get_event_raffle's
   *  total_winners, so the number matches the one shown on event pages. */
  total_winners: number;
}

// callRpc resolves the client PER CALL. The old `supabase.rpc.bind(supabase)`
// here constructed the client as a side effect of importing this module -- one
// of only two sites repo-wide that structurally blocked a lazy accessor
// (supabase-defer arc, P1). Every caller already awaits, so nothing else moved.
// The loose cast itself lives in one place now; see rpcLoose.ts for why it is
// temporary.

// The two query functions are exported for tests. They hold the RPC names and
// every coercion on this surface, and the page's failure mode is an empty list
// that its own header describes as expected -- so an untested wrong name or a
// dropped await would look exactly like "no raffles are open".
export async function fetchOpenRaffles(): Promise<OpenRaffle[]> {
  const { data, error } = await callRpc('list_open_raffles_v1');
  if (error) throw new Error(error.message);
  const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
  // Coerce entry_count (RPC returns bigint -> string|number) to a number.
  return rows.map((r) => ({
    event_id: String(r.event_id),
    title: (r.title as string) ?? 'Bachata raffle',
    venue_name: (r.venue_name as string | null) ?? null,
    start_time: (r.start_time as string | null) ?? null,
    timezone: (r.timezone as string | null) ?? null,
    prize_text: (r.prize_text as string | null) ?? null,
    cutoff_offset_minutes: r.cutoff_offset_minutes == null ? null : Number(r.cutoff_offset_minutes),
    cutoff_at: (r.cutoff_at as string | null) ?? null,
    entry_count: Number(r.entry_count ?? 0),
    consent_version: (r.consent_version as string | null) ?? null,
  }));
}

export function useOpenRaffles() {
  // Phase 3: Smart visibility-based refetch (only when page is visible)
  // Queries only fire when user has the tab active, reducing Supabase IO
  useVisibilityRefresh({
    queryKey: ['open-raffles'],
    refetchInterval: 5 * 60_000, // 5 minutes (only when visible)
    staggerOffset: Math.random() * 10_000, // Avoid thundering herd
  });

  return useQuery({
    queryKey: ['open-raffles'],
    queryFn: fetchOpenRaffles,
    staleTime: 5 * 60_000, // 5 minutes: data stays fresh during visibility
  });
}

export async function fetchRaffleStats(): Promise<RaffleCommunityStats> {
  const { data, error } = await callRpc('get_raffle_community_stats_v1');
  if (error) throw new Error(error.message);
  const obj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return {
    entries_this_month: Number(obj.entries_this_month ?? 0),
    winners_this_month: Number(obj.winners_this_month ?? 0),
    total_winners: Number(obj.total_winners ?? 0),
  };
}

export function useRaffleStats() {
  // Phase 3: Smart visibility-based refetch for community stats
  useVisibilityRefresh({
    queryKey: ['raffle-stats'],
    refetchInterval: 10 * 60_000, // 10 minutes (stats change less frequently)
    staggerOffset: Math.random() * 10_000 + 1_000, // Stagger after raffles
  });

  return useQuery({
    queryKey: ['raffle-stats'],
    queryFn: fetchRaffleStats,
    staleTime: 10 * 60_000, // 10 minutes: community stats don't change frequently
  });
}
