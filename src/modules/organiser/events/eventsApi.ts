import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  ORGANISER_HOME_KEY,
  fetchOccurrenceProgramme,
  fetchOrganiserHome,
  occurrenceProgrammeQueryKey,
  organiserHomeQueryKey,
  runSeriesCommand,
  seriesWorkspaceQueryKey,
  type HomeOrganiser,
} from '@/modules/organiser/shared/selfServeApi';
import { envelope, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import type { HomeSeriesFull } from '@/modules/organiser/shared/homeModel';
import { parseEventWorkspace, type EventWorkspace } from './eventModel';

/** The editor's own cache entry: the old parser's shape plus styles, gallery and videos. */
export const eventWorkspaceQueryKey = (seriesId: string | undefined) => ['org-event-workspace', seriesId] as const;

/** admin_event_workspace_p5 (an organiser member of the series may call it). */
export async function fetchEventWorkspace(seriesId: string): Promise<EventWorkspace> {
  const { data, error } = await supabase.rpc('admin_event_workspace_p5', { p_series_id: seriesId });
  if (error) throw error;
  return parseEventWorkspace(data);
}

export function useEventWorkspace(seriesId: string | undefined) {
  return useQuery({
    queryKey: eventWorkspaceQueryKey(seriesId),
    queryFn: () => fetchEventWorkspace(seriesId as string),
    enabled: !!seriesId,
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

/**
 * Sends owner commands one after another through series_command_p5, each against
 * the version the previous one returned, then reloads everything they touch.
 * Returns the last version.
 */
export function useRunCommands(seriesId: string) {
  const queryClient = useQueryClient();
  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: eventWorkspaceQueryKey(seriesId) });
    void queryClient.invalidateQueries({ queryKey: seriesWorkspaceQueryKey(seriesId) });
    void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
  };
  return async (commands: OwnerCommand[], version: number | null) => {
    let v = version;
    try {
      for (const command of commands) {
        const res = await runSeriesCommand(envelope(seriesId, v, command));
        if (typeof res?.new_version === 'number') v = res.new_version;
      }
    } finally {
      if (commands.length) reload();
    }
    return v;
  };
}
