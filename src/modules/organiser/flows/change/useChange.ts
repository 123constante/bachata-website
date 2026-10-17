import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  dateDetailQueryKey,
  fetchDateDetail,
  fetchOrganiserHome,
  fetchSeriesWorkspace,
  organiserHomeQueryKey,
  seriesWorkspaceQueryKey,
} from '@/modules/organiser/shared/selfServeApi';
import { newIdempotencyKey, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import { commandErrorMessage, isVersionConflict } from '@/modules/organiser/shared/selfServeErrors';
import { useOwnerCommand } from '@/modules/organiser/shared/useOwnerCommand';
import { goDone } from '@/modules/organiser/flows/doneState';
import { dateGate, findSeries, type DateGate } from './changeModel';

/** organiser_home_v1, the same cache entry Home and the shell's prefetch fill. */
export function useChangeHome() {
  const { user } = useAuth();
  return useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome, enabled: !!user?.id });
}

/** admin_event_workspace_p5: every date of the series with its own version. */
export const useSeriesWorkspace = (seriesId: string) =>
  useQuery({ queryKey: seriesWorkspaceQueryKey(seriesId), queryFn: () => fetchSeriesWorkspace(seriesId), enabled: !!seriesId });

/**
 * One date for a C4/C5 step: the series (home), the gate (past, closed,
 * cancelled, not this series) and the date as it stands (event_view_p5:
 * effective time, venue and the version the write is checked against).
 */
export function useChangeDate(seriesId: string, occurrenceId: string) {
  const home = useChangeHome();
  const ws = useSeriesWorkspace(seriesId);
  const today = home.data?.today ?? '';
  const gate: DateGate | null = ws.data && home.data ? dateGate(ws.data, occurrenceId, today) : null;
  const detail = useQuery({
    queryKey: dateDetailQueryKey(occurrenceId),
    queryFn: () => fetchDateDetail(occurrenceId),
    enabled: gate?.kind === 'ok',
  });
  return {
    home,
    ws,
    today,
    series: findSeries(home.data, seriesId),
    gate,
    detail,
    failed: home.isError || ws.isError || detail.isError,
    /** The workspace read's error: a refusal of this login is NoAccess (A-B2). */
    wsError: ws.error,
    retry: () => { void home.refetch(); void ws.refetch(); void detail.refetch(); },
  };
}

/**
 * The ONE write of a change path: an occurrence.* command on the DATE
 * (occurrence_command_p5 refuses a series target, and the series dispatcher
 * refuses an occurrence kind: live pg_proc 2026-10-16), checked against the
 * date's own version, then the Done screen. version_conflict (R3-7) is a state
 * the screen shows; any other refusal is a message and the button comes back.
 * A retry of the same command reuses its idempotency key, so a lost reply is
 * replayed by the server, not applied twice.
 */
export function useChangeSend(seriesId: string, occurrenceId: string) {
  const command = useOwnerCommand(seriesId);
  const navigate = useNavigate();
  const keys = useRef(new Map<string, string>());
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (cmd: OwnerCommand, version: number, message: string) => {
    const sig = JSON.stringify(cmd);
    if (!keys.current.has(sig)) keys.current.set(sig, newIdempotencyKey());
    setError(null);
    try {
      await command.mutateAsync({ targetId: occurrenceId, version, command: cmd, idempotencyKey: keys.current.get(sig) });
      goDone(navigate, { title: 'Changed', message, seriesId });
    } catch (err) {
      if (isVersionConflict(err)) setConflict(true);
      else setError(commandErrorMessage(err));
    }
  };

  /** A failure before the send reaches the server: the same message line. */
  const fail = (err: unknown) => setError(commandErrorMessage(err));

  return { send, fail, busy: command.isPending, conflict, error };
}
