// Reads for the series programme, cast and organisers screens (parity wave 1, SW1).
// organiser_series_cast_v1 (admin AW1) is called only when AW1_APPLIED: its
// recent_people feed the line-up picker's RECENT list. Each row is pinned with AW1 as
// {profile_id, profile_type, display_name, photo_url, roles[]} (parseRecentPeople). Organiser names come from
// the public organiser pages; Link a page offers only the viewer's own live pages (organiser_home_v1), since
// series.set_organisers refuses an added page the caller does not own or manage (AW1 B-2).

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { useAuth } from '@/hooks/useAuth';
import { fetchOrganiserHome, organiserHomeQueryKey, type HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import { AW1_APPLIED } from '@/modules/organiser/shared/parityGate';
import type { LinkedOrganiser } from './organisersModel';
import { parseRecentPeople, type RecentPerson } from './programmeSeriesModel';

type UntypedRpc = { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };

export type { RecentPerson };

export const seriesCastQueryKey = (seriesId: string) => ['org-series-cast', seriesId] as const;

/** organiser_series_cast_v1 -> the people this organiser put on their last programmes. */
export async function fetchRecentPeople(seriesId: string): Promise<RecentPerson[]> {
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc('organiser_series_cast_v1', { p_series_id: seriesId });
  if (error) throw error;
  return parseRecentPeople(data);
}

export function useRecentPeople(seriesId: string) {
  return useQuery({ queryKey: seriesCastQueryKey(seriesId), queryFn: () => fetchRecentPeople(seriesId), enabled: AW1_APPLIED && !!seriesId, staleTime: 60_000 });
}

/** The organiser pages by id, in the order asked. A page the viewer cannot read is simply missing. */
export async function fetchOrganiserPages(ids: string[]): Promise<LinkedOrganiser[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('organiser_profiles').select('id, name, avatar_url').in('id', ids);
  if (error) throw error;
  const byId = new Map((data ?? []).map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const r = byId.get(id);
    return r ? [{ id, name: r.name ?? 'Organiser', avatarUrl: r.avatar_url ?? null }] : [];
  });
}



/** The viewer's role on a series: owner when any organiser they own runs it, else manager, else null; plus every page they own or manage. */
export function useSeriesRole(seriesId: string): { role: 'owner' | 'manager' | null; loading: boolean; myPages: HomeOrganiser[] } {
  const { user } = useAuth();
  const home = useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome, enabled: !!user?.id });
  const mine = (home.data?.organisers ?? []).filter((o) => o.series.some((s) => s.id === seriesId));
  const role = mine.some((o) => o.role === 'owner') ? 'owner' : mine.length ? 'manager' : null;
  return { role, loading: home.isLoading, myPages: home.data?.organisers ?? [] };
}
