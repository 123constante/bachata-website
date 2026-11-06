import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ORGANISER_HOME_KEY, fetchSeriesWorkspace, runSeriesCommand, seriesWorkspaceQueryKey,
} from '@/modules/organiser/shared/selfServeApi';
import { envelope, newIdempotencyKey, withSeriesName, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import { commandErrorMessage, isVersionConflict } from '@/modules/organiser/shared/selfServeErrors';
import { invalidatePublicEventCaches } from '@/modules/organiser/shared/publicCache';

/**
 * One step of New event sends its command(s) here, one after another, each
 * against the version the previous one returned (the first against a fresh read,
 * so a reload or a second device never sends a stale version). Every command
 * keeps ONE idempotency key for the life of the screen: a retry after a lost
 * reply replays instead of writing twice.
 */
export function useNewSend(seriesId: string) {
  const queryClient = useQueryClient();
  const keys = useRef(new Map<string, string>());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** R3-7: another device changed the draft first; the step shows EventConflict instead. */
  const [conflict, setConflict] = useState(false);

  const send = async (commands: OwnerCommand[]): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      const { series } = await fetchSeriesWorkspace(seriesId);
      let version = series.version;
      for (const bare of commands) {
        // The upsert handler requires `name` on every call (F1): add it from the fresh read.
        const command = withSeriesName(bare, series.name);
        const sig = JSON.stringify(command);
        let key = keys.current.get(sig);
        if (!key) {
          key = newIdempotencyKey();
          keys.current.set(sig, key);
        }
        const res = await runSeriesCommand(envelope(seriesId, version, command, key));
        if (typeof res?.new_version === 'number') version = res.new_version;
      }
      return true;
    } catch (err) {
      if (isVersionConflict(err)) {
        setConflict(true);
        return false;
      }
      setError(commandErrorMessage(err));
      return false;
    } finally {
      void queryClient.invalidateQueries({ queryKey: seriesWorkspaceQueryKey(seriesId) });
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      invalidatePublicEventCaches(queryClient);
      setBusy(false);
    }
  };

  return { send, busy, error, setError, conflict };
}
