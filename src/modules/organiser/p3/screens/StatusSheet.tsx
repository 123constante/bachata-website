import { useEffect, useRef, useState, type ReactNode } from 'react';
import { commandErrorMessage } from '../../shared/selfServeErrors';
import type { OwnerCommand } from '../../shared/seriesCommands';
import type { EventWorkspace, TodaySession } from '../../events/eventModel';
import { L } from '../model';
import type { P3Status } from '../model';
import {
  ONE_TAP, STATUS_COPY, endCommand, endPlan, keepable, lastNight, removeCommand, statusRows, stopCommand,
  type StatusMove, type StatusRow,
} from '../data/eventPage';

/** What the page does with a finished move: the toast, and the command that undoes it (if any). */
export interface Done {
  text: string;
  undo: OwnerCommand | null;
  /** The version the move left the event at (what Undo is sent against). */
  version?: number | null;
}

/** Sends commands one after another (useRunCommands); resolves to the new version. */
export type Send = (commands: OwnerCommand[], version: number | null) => Promise<number | null>;

type Step = 'list' | 'end' | 'stop' | 'remove';

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose, title]);
  return (
    <div className="p3-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="p3-sheet" role="dialog" aria-modal="true" aria-labelledby="p3-sheet-title" ref={box} data-testid="p3-sheet">
        <div className="p3-sheet-head">
          <h3 id="p3-sheet-title">{title}</h3>
          <button type="button" className="p3-link" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Choice({ row, busy, onPick }: { row: StatusRow; busy: boolean; onPick: (m: StatusMove) => void }) {
  const off = row.reason !== null;
  return (
    <button
      type="button"
      className="p3-choice"
      disabled={off || busy}
      data-testid={`p3-status-row-${row.move}`}
      data-enabled={!off}
      onClick={() => onPick(row.move)}
    >
      <span className="p3-row-t">{row.title}</span>
      <span className="p3-row-s">{row.reason ?? row.sub}</span>
    </button>
  );
}

/**
 * C3 Status sheet: only the moves the server takes now, greyed ones say why. Hide /
 * Show / Put it live send at once (Hide and Show come back with Undo); End it, Stop
 * repeating and Remove ask first. Closing it, at any step, sends nothing.
 */
export function StatusSheet({ ws, today, status, send, onDone, onClose }: {
  ws: EventWorkspace;
  today: string;
  status: P3Status;
  send: Send;
  onDone: (d: Done) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>('list');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<TodaySession | null>(null);
  const keep = keepable(ws, today);
  const [kept, setKept] = useState<Set<string>>(() => new Set(keep.map((k) => k.id)));
  const version = ws.series.version;

  const run = async (command: OwnerCommand, done: Done) => {
    setBusy(true);
    setError(null);
    try {
      const v = await send([command], version);
      onDone({ ...done, version: v });
    } catch (e) {
      setError(commandErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const pick = (m: StatusMove) => {
    const tap = ONE_TAP[m];
    if (tap) return void run(tap.command, { text: tap.done, undo: tap.undo });
    if (m === 'end' || m === 'stop' || m === 'remove') { setError(null); setStep(m); }
  };

  const err = error && <p className="p3-error" role="alert" data-testid="p3-sheet-error">{error}</p>;

  if (step === 'end') {
    const plan = endPlan(ws, today);
    const cmd = endCommand(plan, answer);
    return (
      <Sheet title={`End ${ws.series.name.trim() || L.noName}?`} onClose={onClose}>
        {plan.tonight && (
          <fieldset className="p3-ask" data-testid="p3-end-question">
            <legend>Did tonight happen?</legend>
            <div className="p3-pair">
              <button type="button" className={`p3-btn ${answer === 'ran' ? '' : 'p3-btn-line'}`} aria-pressed={answer === 'ran'} onClick={() => setAnswer('ran')}>Yes, it ran</button>
              <button type="button" className={`p3-btn ${answer === 'not_running' ? '' : 'p3-btn-line'}`} aria-pressed={answer === 'not_running'} onClick={() => setAnswer('not_running')}>No</button>
            </div>
          </fieldset>
        )}
        <div className="p3-card p3-inset">
          <span className="p3-row-s">Last date it ran</span>
          <strong data-testid="p3-end-last">{lastNight(plan, answer)}</strong>
        </div>
        {plan.going.length > 0 && (
          <p className="p3-warn" data-testid="p3-end-going">
            {`These dates coming up will go (${plan.going.length}): ${plan.going.slice(0, 4).join(', ')}${plan.going.length > 4 ? ` and ${plan.going.length - 4} more` : ''}.`}
          </p>
        )}
        {err}
        <div className="p3-stack-s">
          <button type="button" className="p3-btn p3-btn-danger" disabled={!cmd || busy} data-testid="p3-end-confirm"
            onClick={() => cmd && void run(cmd, { text: 'Ended. It shows as finished.', undo: null })}>
            {cmd ? 'Yes, it has finished' : 'Answer the question to carry on'}
          </button>
          <button type="button" className="p3-btn p3-btn-line" onClick={onClose}>Keep it going</button>
        </div>
      </Sheet>
    );
  }

  if (step === 'stop') {
    const gone = keep.length - kept.size;
    return (
      <Sheet title={L.stopRepeat} onClose={onClose}>
        <p className="p3-note">Tick the dates to keep. The rest come off the calendar. After this you add dates one by one.</p>
        {keep.length ? (
          <div role="group" aria-label="Dates to keep" className="p3-checks">
            {keep.map((k) => (
              <label key={k.id} className="p3-check">
                <input type="checkbox" checked={kept.has(k.id)} onChange={() => setKept((old) => {
                  const n = new Set(old);
                  if (n.has(k.id)) n.delete(k.id); else n.add(k.id);
                  return n;
                })} />
                <span>{k.label}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="p3-note">No dates are coming up after today, so none come off.</p>
        )}
        <p className={gone ? 'p3-warn' : 'p3-note'} data-testid="p3-stop-count">
          {gone ? `${gone} ${gone === 1 ? 'date comes' : 'dates come'} off the calendar.` : 'Every date coming up is kept.'}
        </p>
        <p className="p3-note">This can&rsquo;t be undone here.</p>
        {err}
        <div className="p3-stack-s">
          <button type="button" className="p3-btn" disabled={busy} data-testid="p3-stop-confirm"
            onClick={() => void run(stopCommand(keep.filter((k) => kept.has(k.id)).map((k) => k.id)), { text: 'It no longer repeats. Add dates one by one.', undo: null })}>
            Stop repeating
          </button>
          <button type="button" className="p3-btn p3-btn-line" onClick={onClose}>Keep repeating</button>
        </div>
      </Sheet>
    );
  }

  if (step === 'remove') {
    return (
      <Sheet title={`Remove ${ws.series.name.trim() || L.noName}?`} onClose={onClose}>
        <p className="p3-note">{STATUS_COPY.removeSub}</p>
        {err}
        <div className="p3-stack-s">
          <button type="button" className="p3-btn p3-btn-danger" disabled={busy} data-testid="p3-remove-confirm"
            onClick={() => void run(removeCommand(), { text: 'Removed from your events.', undo: null })}>
            Yes, remove it
          </button>
          <button type="button" className="p3-btn p3-btn-line" onClick={onClose}>Keep it</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={`Status: ${status.label}`} onClose={onClose}>
      <p className="p3-note">{L.sheetHint}</p>
      <div className="p3-stack-s" aria-busy={busy}>
        {statusRows(ws, today).map((r) => <Choice key={r.move} row={r} busy={busy} onPick={pick} />)}
      </div>
      {err}
    </Sheet>
  );
}
