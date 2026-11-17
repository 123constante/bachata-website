import { useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { parseDoorList, SignedOutError, type DoorList } from '../door/data';
import { fetchRaffleNights, raffleNightsQueryKey } from '../events/raffle/raffleApi';
import type { RaffleNight, ReadResult } from '../events/raffle/raffleModel';
import { dayWord } from '../model';
import type { PastNight } from './dashModel';

/**
 * Slice 2 reads for nights that have happened (read only, no new RPC):
 * - organiser_raffle_nights_v1 lists EVERY night of a series with its occurrence id and raffle result;
 * - ticket_door_list_v3(series, occurrence) answers in_count (checked in = Who came) and total_count
 *   (tickets for that night) for a past occurrence too. A seat it refuses gives null, never 0.
 */
export const COMPARE_CAP = 8;

export interface NightCount { cameIn: number | null; ticketsSold: number | null }

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };

/**
 * Slice 3: the whole v3 door answer for one night (rows with first_name and checked_in_at, plus the
 * counts). `occurrenceId` null = the server picks the earliest night that has not ended (tonight).
 * The ONE read behind the counts here and the Who is in / Who came sheets.
 */
export async function fetchDoorNight(seriesId: string, occurrenceId: string | null): Promise<DoorList> {
  const { data, error } = await (supabase as unknown as Rpc).rpc('ticket_door_list_v3', { p_event_series_id: seriesId, p_occurrence_id: occurrenceId });
  if (error) throw (error as { code?: string }).code === '42501' ? new SignedOutError() : new Error(error.message);
  return parseDoorList(data);
}

export async function fetchNightCount(seriesId: string, occurrenceId: string): Promise<NightCount> {
  const d = await fetchDoorNight(seriesId, occurrenceId);
  return d.result === 'ok' ? { cameIn: d.inCount, ticketsSold: d.totalCount } : { cameIn: null, ticketsSold: null };
}

export function raffleWordsOf(n: RaffleNight): string | null {
  if (n.winner) return n.winner.firstName ? `Raffle winner: ${n.winner.firstName}` : 'Raffle winner drawn';
  if (n.raffleOn && n.entries > 0) return `Raffle: ${n.entries.toLocaleString('en-GB')} ${n.entries === 1 ? 'entry' : 'entries'}`;
  return null;
}

export interface SeriesNights { seriesId: string; name: string; read: ReadResult | undefined }

/** The page's nights before `today` (or on it when `withToday`), most recent first, capped. */
export function pastOf(series: readonly SeriesNights[], today: string, cap: number, withToday = false): { night: RaffleNight; seriesId: string; name: string }[] {
  const out: { night: RaffleNight; seriesId: string; name: string }[] = [];
  for (const s of series) {
    if (s.read?.kind !== 'ok') continue;
    for (const n of s.read.read.nights) {
      if (n.date < today || (withToday && n.date === today)) out.push({ night: n, seriesId: s.seriesId, name: s.name });
    }
  }
  return out.sort((a, b) => (a.night.date < b.night.date ? 1 : a.night.date > b.night.date ? -1 : 0)).slice(0, cap);
}

export function pastNightOf(p: { night: RaffleNight; seriesId: string; name: string }, today: string, count: NightCount | undefined): PastNight {
  return {
    key: `${p.seriesId}:${p.night.date}`, seriesId: p.seriesId, occurrenceId: p.night.occurrenceId, date: p.night.date, name: p.name,
    when: dayWord(p.night.date, today, null), cancelled: p.night.chip === 'cancelled',
    cameIn: count?.cameIn ?? null, ticketsSold: count?.ticketsSold ?? null, raffle: raffleWordsOf(p.night), going: null,
  };
}

/** Past nights with their counts. `enabled` false runs nothing (flag off / not needed). */
export function usePastNights(series: readonly { id: string; name: string }[], today: string, cap: number, enabled: boolean, withToday = false) {
  const { user } = useAuth();
  const on = enabled && !!user?.id && !!today;
  const reads = useQueries({
    queries: series.map((s) => ({ queryKey: raffleNightsQueryKey(s.id), queryFn: () => fetchRaffleNights(s.id), enabled: on, staleTime: 60_000 })),
  });
  const picked = pastOf(series.map((s, i) => ({ seriesId: s.id, name: s.name, read: reads[i]?.data })), today, cap, withToday);
  const counts = useQueries({
    queries: picked.map((p) => ({
      queryKey: ['p3-dash-night-count', user?.id ?? null, p.seriesId, p.night.occurrenceId] as const,
      queryFn: () => fetchNightCount(p.seriesId, p.night.occurrenceId), enabled: on && !p.night.chip.includes('cancelled'), staleTime: 60_000, retry: 1,
    })),
  });
  const loading = on && (reads.some((r) => r.isPending) || counts.some((c, i) => c.isPending && picked[i].night.chip !== 'cancelled'));
  return { loading, nights: picked.map((p, i) => pastNightOf(p, today, counts[i]?.data)) };
}
