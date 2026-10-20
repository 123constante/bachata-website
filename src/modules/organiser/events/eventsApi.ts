import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchOccurrenceProgramme,
  fetchOrganiserHome,
  occurrenceProgrammeQueryKey,
  organiserHomeQueryKey,
  type HomeOrganiser,
} from '@/modules/organiser/shared/selfServeApi';
import type { HomeSeriesFull } from '@/modules/organiser/shared/homeModel';

export { eventWorkspaceQueryKey, fetchEventWorkspace, useEventWorkspace, useRunCommands } from '@/modules/organiser/shared/runCommands';

/**
 * event_publish_readiness_v1: what the team's approval would refuse the event for
 * (the `missing` keys), re-read whenever the series' version moves.
 */
export async function fetchPublishReadiness(seriesId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('event_publish_readiness_v1', { p_series_id: seriesId });
  if (error) throw error;
  const missing = (data as { missing?: unknown } | null)?.missing;
  return Array.isArray(missing) ? missing.filter((m): m is string => typeof m === 'string') : [];
}

export function usePublishReadiness(seriesId: string, version: number, enabled: boolean) {
  return useQuery({
    queryKey: ['org-event-readiness', seriesId, version] as const,
    queryFn: () => fetchPublishReadiness(seriesId),
    enabled,
  });
}

export function useOrganiserHome() {
  const { user } = useAuth();
  return useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome });
}

/** A series as the list shows it, with its venue name (organiser_home_v1 carries it). */
export type ListedSeries = HomeSeriesFull & { default_venue_name?: string | null; default_cover_image_url?: string | null };

/** Every series across the caller's organisers, once each, by name. */
export function listedSeries(organisers: HomeOrganiser[] | undefined): ListedSeries[] {
  const seen = new Map<string, ListedSeries>();
  (organisers ?? []).forEach((o) => o.series.forEach((s) => { if (!seen.has(s.id)) seen.set(s.id, s as ListedSeries); }));
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The organisers an event belongs to (the caller's organisers that list it). */
export const organisersOf = (organisers: HomeOrganiser[] | undefined, seriesId: string) =>
  (organisers ?? []).filter((o) => o.series.some((s) => s.id === seriesId));

export function useNextDateProgramme(occurrenceId: string | undefined) {
  return useQuery({
    queryKey: occurrenceProgrammeQueryKey(occurrenceId),
    queryFn: () => fetchOccurrenceProgramme(occurrenceId as string),
    enabled: !!occurrenceId,
  });
}
