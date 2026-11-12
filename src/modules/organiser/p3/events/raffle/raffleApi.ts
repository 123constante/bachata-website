// The two organiser raffle RPCs (admin PR #1576, not applied to prod: only reachable behind flags.organiserRaffleLive).
// Cast locally: the generated types do not know them yet and are never hand-edited.
//
// HARD STOP: setRaffleNight is called ONLY from the confirmation sheet's button (RaffleSheet). It must never be
// imported by a bulk, agent, effect or script path. raffleHardStop.test.ts pins that.

import { supabase } from '@/integrations/supabase/client';
import { parseRead, parseSet, type ReadResult, type SetResult } from './raffleModel';

type UntypedRpc = { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

export const raffleNightsQueryKey = (seriesId: string) => ['organiser-raffle-nights', seriesId] as const;

export async function fetchRaffleNights(seriesId: string): Promise<ReadResult> {
  const { data, error } = await rpc('organiser_raffle_nights_v1', { p_series_id: seriesId });
  if (error) throw new Error(error.message);
  return parseRead(data);
}

/** Open (true) or close (false) one night. A thrown error means the answer is unknown: the sheet says Nothing changed and offers Try again. */
export async function setRaffleNight(occurrenceId: string, enabled: boolean): Promise<SetResult> {
  const { data, error } = await rpc('organiser_raffle_night_set_v1', { p_occurrence_id: occurrenceId, p_enabled: enabled });
  if (error) throw new Error(error.message);
  return parseSet(data);
}
