import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ORGANISER_HOME_KEY, runOccurrenceCommand, runSeriesCommand, seriesWorkspaceQueryKey, type CommandResponse } from '@/modules/organiser/shared/selfServeApi';
import { envelope, type DateStep, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import { parseEventWorkspace, type EventWorkspace } from '@/modules/organiser/events/eventModel';
import { invalidatePublicEventCaches } from '@/modules/organiser/shared/publicCache';

// Moved from events/eventsApi.ts with the same signatures (plan 4.3 #11, the
// 4.11 COLLISION line): every R1 flow sends and reads through here, and
// events/eventsApi.ts re-exports these, so S5's rewrite of that file cannot
// break S2/S3.

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

/**
 * Sends owner commands one after another through series_command_p5, each against
 * the version the previous one returned, then reloads everything they touch.
 * Returns the last version. A DateStep goes through occurrence_command_p5 against
 * its date's own version; it bumps the series version too (a move rewrites
 * removed_dates), so the next series command re-reads the version first.
 */
function useReload(seriesId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: eventWorkspaceQueryKey(seriesId) });
    void queryClient.invalidateQueries({ queryKey: seriesWorkspaceQueryKey(seriesId) });
    void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    invalidatePublicEventCaches(queryClient);
  };
}

/**
 * ONE series command under a key the caller keeps: a retry after a dropped
 * connection sends the same key, so it is the same write, never a second one.
 * Resolves to the server's answer (its `data` too), then reloads what it touched.
 */
export function useSendOnce(seriesId: string) {
  const reload = useReload(seriesId);
  return async (command: OwnerCommand, version: number | null, key: string): Promise<CommandResponse> => {
    try {
      return await runSeriesCommand(envelope(seriesId, version, command, key));
    } finally {
      reload();
    }
  };
}

export function useRunCommands(seriesId: string) {
  const reload = useReload(seriesId);
  return async (commands: Array<OwnerCommand | DateStep>, version: number | null) => {
    let v = version;
    let stale = false;
    try {
      for (const command of commands) {
        if ('occurrence' in command) {
          const { occurrence, ...dateCommand } = command;
          await runOccurrenceCommand(envelope(occurrence.id, occurrence.version, dateCommand));
          stale = true;
          continue;
        }
        if (stale) v = (await fetchEventWorkspace(seriesId)).series.version;
        stale = false;
        const res = await runSeriesCommand(envelope(seriesId, v, command));
        if (typeof res?.new_version === 'number') v = res.new_version;
      }
      if (stale) v = (await fetchEventWorkspace(seriesId)).series.version;
    } finally {
      if (commands.length) reload();
    }
    return v;
  };
}
