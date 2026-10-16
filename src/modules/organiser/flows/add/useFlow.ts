import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  dateDetailQueryKey,
  fetchDateDetail,
  fetchOrganiserHome,
  fetchSeriesWorkspace,
  organiserHomeQueryKey,
  seriesWorkspaceQueryKey,
  type CommandResponse,
} from '@/modules/organiser/shared/selfServeApi';
import { newIdempotencyKey, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import { commandErrorMessage, isVersionConflict } from '@/modules/organiser/shared/selfServeErrors';
import { useOwnerCommand } from '@/modules/organiser/shared/useOwnerCommand';

/** organiser_home_v1, the same cache entry Home and the shell's prefetch fill. */
export function useFlowHome() {
  const { user } = useAuth();
  return useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome, enabled: !!user?.id });
}

/** admin_event_workspace_p5: every date of the series with its own version, and the series version. */
export const useSeriesWorkspace = (seriesId: string, enabled = true) =>
  useQuery({ queryKey: seriesWorkspaceQueryKey(seriesId), queryFn: () => fetchSeriesWorkspace(seriesId), enabled: !!seriesId && enabled });

/** event_view_p5: one date as it stands, with the version an occurrence.* write is checked against. */
export const useDateDetail = (occurrenceId: string, enabled: boolean) =>
  useQuery({ queryKey: dateDetailQueryKey(occurrenceId), queryFn: () => fetchDateDetail(occurrenceId), enabled: !!occurrenceId && enabled });

/**
 * The write of a step, through useOwnerCommand (the S2 amendment): a series.*
 * kind goes to series_command_p5 on the series, an occurrence.* kind to
 * occurrence_command_p5 on the DATE with the date's own version.
 * version_conflict (R3-7) is a state the screen shows; any other refusal is a
 * message and the button comes back. A retry of the same command reuses its
 * idempotency key, so a lost reply is replayed by the server, not applied twice.
 */
export function useFlowSend(seriesId: string) {
  const command = useOwnerCommand(seriesId);
  const keys = useRef(new Map<string, string>());
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Resolves with the server's reply, or null when the send failed (the screen shows why). */
  const send = async (targetId: string, version: number, cmd: OwnerCommand): Promise<CommandResponse | null> => {
    const sig = `${targetId}:${JSON.stringify(cmd)}`;
    if (!keys.current.has(sig)) keys.current.set(sig, newIdempotencyKey());
    setError(null);
    try {
      return await command.mutateAsync({ targetId, version, command: cmd, idempotencyKey: keys.current.get(sig) });
    } catch (err) {
      if (isVersionConflict(err)) setConflict(true);
      else setError(commandErrorMessage(err));
      return null;
    }
  };

  /** Runs a whole step write (one or two sends) with the button busy throughout. */
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } catch (err) {
      setError(commandErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return { send, run, busy, conflict, error };
}
