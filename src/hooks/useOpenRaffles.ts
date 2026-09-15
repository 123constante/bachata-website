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
// =============================================================================

import { useQuery } from '@tanstack/react-query';
import { rpcLoose as callRpc } from '@/integrations/supabase/rpcLoose';

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

const OPEN_RAFFLES_QUERY_KEY = ['open-raffles'];

export function useOpenRaffles() {
  return useQuery({
    queryKey: OPEN_RAFFLES_QUERY_KEY,
    queryFn: fetchOpenRaffles,
    // Phase 3 (IO optimization arc, resumed): NO periodic timer. Round 2 of
    // review found that adding refetchInterval here was a genuine IO
    // INCREASE over the true baseline (which never polled at all) for any
    // tab left open and focused -- e.g. 12 requests/hour instead of ~1 for a
    // continuously-visible tab, the opposite of this arc's goal. The
    // app-wide refetchOnWindowFocus:true default (src/App.tsx) already
    // refetches on tab-return, gated by staleTime, with zero background or
    // steady-state foreground cost.
    staleTime: 5 * 60_000,
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

const RAFFLE_STATS_QUERY_KEY = ['raffle-stats'];

export function useRaffleStats() {
  return useQuery({
    queryKey: RAFFLE_STATS_QUERY_KEY,
    queryFn: fetchRaffleStats,
    // Phase 3 (IO optimization arc, resumed): see useOpenRaffles above --
    // no periodic timer, relies on the app-wide refetchOnWindowFocus default.
    staleTime: 10 * 60_000,
  });
}
