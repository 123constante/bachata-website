import { supabase } from '@/integrations/supabase/client';
import { parseNightMoney, type R4MoneyRead } from './r4MoneyModel';

/** The money-per-night read (ticket_sales_by_night_v1). Untyped call: the RPC is not in types.ts yet. */
type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };

/** Every night of one event (one read shared by One night, Home and Compare). */
export async function fetchNightMoney(seriesId: string): Promise<R4MoneyRead> {
  const { data, error } = await (supabase as unknown as Rpc).rpc('ticket_sales_by_night_v1', { p_event_series_id: seriesId, p_occurrence_id: null });
  if (error) throw new Error(error.message);
  return parseNightMoney(data);
}
export const nightMoneyQueryKey = (userId: string | null, seriesId: string) => ['r4-night-money', userId, seriesId] as const;
