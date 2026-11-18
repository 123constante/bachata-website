import type { CancelPlan } from '../data/eventPage';
import { Sheet } from '../screens/Sheet';
import { useCancelReasons, useCancelSend, type SendOnce } from '../screens/CancelEventSheet';
import type { Done } from '../screens/StatusSheet';
import { CANCEL_R4_COPY } from './r4NightModel';

/**
 * Board R4Cancel: "Cancel <name>?", the Why? chips (cancellation_reasons), "Cancel this night" off until a
 * reason is picked, and "Keep the night". Sends through useCancelSend (series.cancel_one_off, kept key).
 * The board's "N going will be told, N refunded" sentence is not drawn: cancelling neither tells the going
 * list nor refunds tickets today (no such function on prod, 2026-11-18), so the sentence would not be true.
 */
export function R4CancelSheet({ name, plan, send, onDone, onClose }: {
  name: string; plan: CancelPlan; send: SendOnce; onDone: (d: Done) => void; onClose: () => void;
}) {
  const { pick, busy, error, choose, go } = useCancelSend(plan, send, onDone);
  const reasons = useCancelReasons();
  return (
    <Sheet title={CANCEL_R4_COPY.title(name)} onClose={onClose} locked={busy}>
      <div className="r4-stack r4-sheet" data-testid="r4-cancel">
        <p className="r4-sub" data-testid="r4-cancel-day">{CANCEL_R4_COPY.day(plan.day)}</p>
        <div className="r4-section">
          <div className="r4-label" id="r4-cancel-why">Why?</div>
          {reasons.isPending && <p className="r4-hint">Loading the reasons&hellip;</p>}
          {(reasons.isError || (reasons.data && reasons.data.length === 0)) && (
            <div>
              <p className="r4-err" role="alert">{CANCEL_R4_COPY.noReasons}</p>
              <button type="button" className="r4-chip" onClick={() => void reasons.refetch()}>Try again</button>
            </div>
          )}
          {reasons.data && reasons.data.length > 0 && (
            <div role="group" aria-labelledby="r4-cancel-why" className="r4-chips" data-testid="r4-cancel-reasons">
              {reasons.data.map((r) => (
                <button key={r.key} type="button" className="r4-chip" aria-pressed={pick?.reason === r.label} disabled={busy} onClick={() => choose(r.label)}>{r.label}</button>
              ))}
            </div>
          )}
        </div>
        {error && <p className="r4-err" role="alert" data-testid="r4-cancel-error">{error}</p>}
        <div className="r4-section">
          <button type="button" className="r4-btn r4-btn-42 r4-btn-danger" disabled={!pick || busy} aria-describedby={pick ? undefined : 'r4-cancel-help'}
            onClick={() => void go()} data-testid="r4-cancel-go">{busy ? <>Cancelling&hellip;</> : 'Cancel this night'}</button>
          {!pick && <p id="r4-cancel-help" className="r4-hint r4-center" data-testid="r4-cancel-help">Pick a reason first.</p>}
          <button type="button" className="r4-btn r4-btn-42 r4-btn-quiet" disabled={busy} onClick={onClose} data-testid="r4-cancel-keep">Keep the night</button>
        </div>
      </div>
    </Sheet>
  );
}
