import { supabase } from '@/integrations/supabase/client';
import { PAGE_SIZE, parseQueueRows, softRefusal, type QueueItem, type TargetType } from './ambassadorModel';

export interface CityScope { id: string; name: string; slug: string }

export const scopesKey = (userId: string) => ['ambassador', 'scopes', userId] as const;
export const queueKey = (cityIds: readonly string[]) => ['ambassador', 'queue', ...cityIds] as const;

/**
 * The cities the signed-in user is ambassador for. Empty = not an ambassador.
 * Ambassadors are `entity_members` rows (entity_type 'city', member_role 'ambassador'), the same
 * test every queue RPC makes; policy `entity_members_select` lets a user read their own rows.
 * Two reads: the generated types carry no entity_members -> cities relationship to join on.
 */
export async function fetchCityScopes(userId: string): Promise<CityScope[]> {
  const { data: members, error } = await supabase
    .from('entity_members')
    .select('entity_id')
    .eq('entity_type', 'city')
    .eq('member_role', 'ambassador')
    .eq('user_id', userId);
  if (error) throw error;
  const ids = [...new Set((members ?? []).map((m) => m.entity_id))];
  if (ids.length === 0) return [];
  const { data: cities, error: citiesError } = await supabase.from('cities').select('id, name, slug').in('id', ids);
  if (citiesError) throw citiesError;
  return (cities ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug })).sort((a, b) => a.name.localeCompare(b.name));
}

/** One page (offset) of the pending queue across every scope city. `fullCityIds` = the cities that filled the page, so may have more. */
export interface QueuePage { items: QueueItem[]; offset: number; full: boolean; fullCityIds: string[] }

export async function fetchQueuePage(cityIds: readonly string[], offset: number): Promise<QueuePage> {
  const results = await Promise.all(
    cityIds.map(async (cityId) => {
      const { data, error } = await supabase.rpc('admin_list_pending_review_v1', {
        p_city_id: cityId,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      });
      if (error) throw error;
      return { cityId, rows: parseQueueRows(data) };
    }),
  );
  const fullCityIds = results.filter((r) => r.rows.length >= PAGE_SIZE).map((r) => r.cityId);
  return { items: results.flatMap((r) => r.rows), offset, full: fullCityIds.length > 0, fullCityIds };
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
