import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ORGANISER_HOME_KEY,
  dateDetailQueryKey,
  runOccurrenceCommand,
  runSeriesCommand,
  seriesWorkspaceQueryKey,
  type CommandResponse,
} from './selfServeApi';
import { envelope, type OwnerCommand } from './seriesCommands';
import { isVersionConflict } from './selfServeErrors';
import type { DateDetail, SeriesWorkspace } from './seriesModel';

export interface OwnerCommandVars {
  /** series id for a series.* command, occurrence id for an occurrence.* one. */
  targetId: string;
  version: number | null;
  command: OwnerCommand;
  /**
   * Reuse a key across retries of the SAME write (W3's create): the server
   * replays a key that already succeeded and stores nothing for a refusal, so a
   * retry after a lost reply returns the original result instead of failing.
   */
  idempotencyKey?: string;
}

/**
 * One owner command through the P5 command RPCs, then a reload of what it
 * changed. A series command's new version is written into the cached
 * workspace at once, so a second save straight after the first does not trip
 * version_conflict while the reload is in flight. A version_conflict reloads
 * too; the caller keeps what the organiser typed.
 */
export function useOwnerCommand(seriesId: string) {
  const queryClient = useQueryClient();
  const reload = (occurrenceId?: string) => {
    void queryClient.invalidateQueries({ queryKey: seriesWorkspaceQueryKey(seriesId) });
    void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    if (occurrenceId) void queryClient.invalidateQueries({ queryKey: dateDetailQueryKey(occurrenceId) });
  };

  return useMutation<CommandResponse, Error, OwnerCommandVars>({
    mutationFn: ({ targetId, version, command, idempotencyKey }) => {
      const env = envelope(targetId, version, command, idempotencyKey);
      return command.kind.startsWith('series.') ? runSeriesCommand(env) : runOccurrenceCommand(env);
    },
    onSuccess: (res, vars) => {
      if (vars.command.kind.startsWith('series.') && typeof res?.new_version === 'number') {
        queryClient.setQueryData<SeriesWorkspace>(seriesWorkspaceQueryKey(seriesId), (old) =>
          old ? { ...old, series: { ...old.series, version: res.new_version as number } } : old,
        );
      }
      if (vars.command.kind.startsWith('occurrence.') && typeof res?.new_version === 'number') {
        queryClient.setQueryData<DateDetail>(dateDetailQueryKey(vars.targetId), (old) =>
          old ? { ...old, version: res.new_version as number } : old,
        );
      }
      reload(vars.command.kind.startsWith('occurrence.') ? vars.targetId : undefined);
    },
    onError: (error, vars) => {
      if (isVersionConflict(error)) reload(vars.command.kind.startsWith('occurrence.') ? vars.targetId : undefined);
    },
  });
}
