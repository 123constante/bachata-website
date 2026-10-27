import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCancellationReasons, type CommandResponse } from '../../shared/selfServeApi';
import { commandErrorMessage } from '../../shared/selfServeErrors';
import { newIdempotencyKey, type OwnerCommand } from '../../shared/seriesCommands';
import { L } from '../model';
import { bringBackStep, cancelEventCommand, type CancelPlan } from '../data/eventPage';
import { Sheet } from './Sheet';
import type { Done } from './StatusSheet';

/** One series command under a key the sheet keeps (shared/runCommands useSendOnce). */
export type SendOnce = (command: OwnerCommand, key: string) => Promise<CommandResponse>;

export const CANCEL_COPY = {
  title: (name: string, day: string) => `Cancel ${name} on ${day}?`,
  body: (day: string) => `Dancers will see \u2018Cancelled\u2019 on ${day}. You can bring it back any time.`,
  pick: 'Pick a reason to carry on',
  go: 'Yes, cancel the event',
  keep: 'Don\u2019t cancel',
  done: 'Cancelled.',
  already: (reason: string | null) => (reason ? `It was already cancelled. Dancers see: ${reason}.` : 'It was already cancelled.'),
  loading: 'Loading the reasons\u2026',
  noReasons: 'The reasons didn\u2019t load. Check your connection, then try again.',
} as const;

/**
 * C3 `cancelnext`, one-off wording: "Cancel the event" (series.cancel_one_off, ER AD4).
 * Nothing is sent until a reason is picked and the organiser says yes. The key is kept
 * per reason, so a retry after a dropped connection is the same write, never a second
 * one; picking another reason is a new request. A date already cancelled comes back as
 * success with the reason it has (data.already_cancelled), never a second "Cancelled".
 */
export function CancelEventSheet({ name, plan, send, onDone, onClose }: {
  name: string;
  plan: CancelPlan;
  send: SendOnce;
  onDone: (d: Done) => void;
  onClose: () => void;
}) {
  const reasons = useQuery({ queryKey: ['cancellation-reasons'], queryFn: fetchCancellationReasons, staleTime: Infinity });
  const [pick, setPick] = useState<{ reason: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (reason: string) => {
    if (pick?.reason === reason) return;
    setError(null);
    setPick({ reason, key: newIdempotencyKey() });
  };

  const go = async () => {
    if (!pick) return;
    setBusy(true);
    setError(null);
    try {
      const res = await send(cancelEventCommand(pick.reason), pick.key);
      const data = res?.data ?? {};
      const already = data.already_cancelled === true;
      const stored = typeof data.reason === 'string' && data.reason.trim() ? data.reason.trim() : null;
      onDone({
        text: already ? CANCEL_COPY.already(stored) : CANCEL_COPY.done,
        undo: bringBackStep(plan.dateId),
        undoLabel: L.bringItBack,
        version: typeof res?.new_version === 'number' ? res.new_version : null,
      });
    } catch (e) {
      setError(commandErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={CANCEL_COPY.title(name, plan.day)} onClose={onClose}>
      <p className="p3-note" data-testid="p3-cancel-body">{CANCEL_COPY.body(plan.day)}</p>
      <fieldset className="p3-ask" data-testid="p3-cancel-reasons">
        <legend>{L.cancelWhy}</legend>
        {reasons.isPending && <p className="p3-note">{CANCEL_COPY.loading}</p>}
        {reasons.isError && (
          <div className="p3-stack-s">
            <p className="p3-error" role="alert">{CANCEL_COPY.noReasons}</p>
            <button type="button" className="p3-btn p3-btn-line" onClick={() => void reasons.refetch()}>Try again</button>
          </div>
        )}
        {reasons.data && (
          <div className="p3-pair" role="group" aria-label={L.cancelWhy}>
            {reasons.data.map((r) => (
              <button key={r.key} type="button" className={`p3-btn ${pick?.reason === r.label ? '' : 'p3-btn-line'}`}
                aria-pressed={pick?.reason === r.label} disabled={busy} onClick={() => choose(r.label)}>
                {r.label}
              </button>
            ))}
          </div>
        )}
      </fieldset>
      {error && <p className="p3-error" role="alert" data-testid="p3-sheet-error">{error}</p>}
      <div className="p3-stack-s">
        <button type="button" className="p3-btn p3-btn-danger" disabled={!pick || busy} data-testid="p3-cancel-confirm" onClick={() => void go()}>
          {pick ? CANCEL_COPY.go : CANCEL_COPY.pick}
        </button>
        <button type="button" className="p3-btn p3-btn-line" onClick={onClose}>{CANCEL_COPY.keep}</button>
      </div>
    </Sheet>
  );
}
