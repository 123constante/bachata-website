// =============================================================================
// useOpenRaffles / useRaffleStats — data hooks for the public /raffles page.
//
// Both call public (anon-callable) RPCs that the admin repo owns:
//   - list_open_raffles_v1()          -> one row per event with an OPEN raffle
//   - get_raffle_community_stats_v1() -> { entries_this_month, winners_this_month }
//
// These RPCs are not in the generated Database types yet (they ship from the
// admin repo separately), so they're called through a loosely-typed cast.
// Until they exist the queries error and the page falls back to its empty /
// zero states (handled by the consuming components). Nothing crashes.
// =============================================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

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
}

// Generated Database types don't know about these RPCs yet — cast through
// unknown so TS lets us call them by name without an `any`.
type RpcResult = { data: unknown; error: { message: string } | null };
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<RpcResult>;

async function fetchOpenRaffles(): Promise<OpenRaffle[]> {
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
  return useQuery({
    queryKey: ['open-raffles'],
    queryFn: fetchOpenRaffles,
    staleTime: 60_000,
    refetchInterval: 60_000, // keep countdowns / entry counts fresh on a long-lived tab
  });
}

async function fetchRaffleStats(): Promise<RaffleCommunityStats> {
  const { data, error } = await callRpc('get_raffle_community_stats_v1');
  if (error) throw new Error(error.message);
  const obj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return {
    entries_this_month: Number(obj.entries_this_month ?? 0),
    winners_this_month: Number(obj.winners_this_month ?? 0),
  };
}

export function useRaffleStats() {
  return useQuery({
    queryKey: ['raffle-stats'],
    queryFn: fetchRaffleStats,
    staleTime: 5 * 60_000,
  });
}
