import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ORGANISER_HOME_KEY, fetchSeriesWorkspace, runSeriesCommand, seriesWorkspaceQueryKey,
} from '@/modules/organiser/shared/selfServeApi';
import { envelope, newIdempotencyKey, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import { commandErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { goDone } from '../doneState';

/** R3-7: another device changed the draft while this screen was open. */
export const CONFLICT_MESSAGE = 'This event changed on another device. Open it from Home to see the latest.';
const isConflict = (err: unknown) => /version_conflict/i.test(String((err as { message?: unknown } | null)?.message ?? ''));

/**
 * One step of New event sends its command(s) here, one after another, each
 * against the version the previous one returned (the first against a fresh read,
 * so a reload or a second device never sends a stale version). Every command
 * keeps ONE idempotency key for the life of the screen: a retry after a lost
 * reply replays instead of writing twice.
 */
export function useNewSend(seriesId: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const keys = useRef(new Map<string, string>());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (commands: OwnerCommand[]): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      let version = (await fetchSeriesWorkspace(seriesId)).series.version;
      for (const command of commands) {
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
      if (isConflict(err)) {
        goDone(navigate, { title: 'New event', message: CONFLICT_MESSAGE, seriesId });
        return false;
      }
      setError(commandErrorMessage(err));
      return false;
    } finally {
      void queryClient.invalidateQueries({ queryKey: seriesWorkspaceQueryKey(seriesId) });
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      setBusy(false);
    }
  };

  return { send, busy, error, setError };
}
