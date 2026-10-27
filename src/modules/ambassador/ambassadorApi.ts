import { supabase } from '@/integrations/supabase/client';
import { PAGE_SIZE, parseQueueRows, softRefusal, type QueueItem, type TargetType } from './ambassadorModel';

export interface CityScope { id: string; name: string; slug: string }

export const SCOPES_KEY = ['ambassador', 'scopes'] as const;
export const queueKey = (cityIds: readonly string[]) => ['ambassador', 'queue', ...cityIds] as const;

/** The signed-in ambassador's cities. Empty = not an ambassador (or an admin who is not one). */
export async function fetchCityScopes(): Promise<CityScope[]> {
  const { data, error } = await supabase.rpc('admin_get_my_city_scopes');
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.city_id, name: r.city_name, slug: r.city_slug }));
}

export interface QueuePage { items: QueueItem[]; offset: number; full: boolean }

/** One page (offset) of the pending queue across every scope city. `full` = some city filled the page, so there may be more. */
export async function fetchQueuePage(cityIds: readonly string[], offset: number): Promise<QueuePage> {
  const results = await Promise.all(
    cityIds.map(async (cityId) => {
      const { data, error } = await supabase.rpc('admin_list_pending_review_v1', {
        p_city_id: cityId,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      });
      if (error) throw error;
      return parseQueueRows(data);
    }),
  );
  return { items: results.flat(), offset, full: results.some((r) => r.length >= PAGE_SIZE) };
}

/** Throws the RPC's error (or a soft refusal as an Error) so `decisionError` can read it. */
export async function approveEntity(type: TargetType, id: string): Promise<void> {
  const { data, error } = await supabase.rpc('admin_approve_entity_v1', { p_target_type: type, p_target_id: id });
  if (error) throw error;
  const refused = softRefusal(data);
  if (refused) throw new Error(refused);
}

export async function rejectEntity(type: TargetType, id: string, reason: string): Promise<void> {
  const { data, error } = await supabase.rpc('admin_reject_entity_v1', { p_target_type: type, p_target_id: id, p_reason: reason.trim() });
  if (error) throw error;
  const refused = softRefusal(data);
  if (refused) throw new Error(refused);
}
