import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { eventWorkspaceQueryKey } from '@/modules/organiser/shared/runCommands';
import type { OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import { goDone } from '@/modules/organiser/flows/doneState';
import { useFlowSend } from '@/modules/organiser/flows/add/useFlow';

/**
 * Sends ONE series command against the series version, then Done (D29, no
 * Undo: D49). The event's own workspace read is reloaded with the rest.
 */
export function useEventSend(seriesId: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const flow = useFlowSend(seriesId);
  const sendThenDone = (version: number, command: OwnerCommand, done: { title: string; message: string }) =>
    flow.run(async () => {
      const res = await flow.send(seriesId, version, command);
      void queryClient.invalidateQueries({ queryKey: eventWorkspaceQueryKey(seriesId) });
      if (res) goDone(navigate, { ...done, seriesId });
    });
  return { sendThenDone, busy: flow.busy, conflict: flow.conflict, error: flow.error };
}
