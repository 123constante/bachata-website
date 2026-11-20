import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { envelope, newIdempotencyKey } from '../../shared/seriesCommands';
import { invalidatePublicEventCaches } from '@/modules/organiser/shared/publicCache';
import { eventWorkspaceQueryKey, useSendOnce } from '../../shared/runCommands';
import { dateDetailQueryKey, occurrenceProgrammeQueryKey, runOccurrenceCommand, saveOccurrenceProgramme } from '../../shared/selfServeApi';
import { commandErrorMessage } from '../../shared/selfServeErrors';
import { Sheet } from '../screens/Sheet';
import { V2 } from './copy';
import { runPlan, summaryOf, type WriteStep } from './editorModel';

/**
 * The v2 save run: the plan in order, one idempotency key per step kept across a retry (a retry after a
 * partial failure starts after the steps that landed and resends their keys, never a second write).
 */
export function useV2Save(seriesId: string, seriesVersion: number) {
  const once = useSendOnce(seriesId);
  const qc = useQueryClient();
  const held = useRef<{ sig: string; keys: string[]; done: number; occ: Record<string, number> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const run = async (steps: WriteStep[]): Promise<boolean> => {
    if (!steps.length || busy) return false;
    const sig = JSON.stringify(steps.map((s) => [s.id, s.command, s.payload ?? null]));
    if (held.current?.sig !== sig) held.current = { sig, keys: steps.map(() => newIdempotencyKey()), done: 0, occ: {} };
    const h = held.current;
    setBusy(true);
    setError(null);
    try {
      const r = await runPlan(steps, h.done, seriesVersion, async (step, v, occV) => {
        const key = h.keys[steps.indexOf(step)];
        if (step.target === 'programme') return saveOccurrenceProgramme(step.id, occV ?? step.version ?? 0, step.payload ?? []);
        if (!step.command) return null;
        if (step.target === 'series') return once(step.command, v, key);
        return runOccurrenceCommand(envelope(step.id, occV, step.command, key));
      }, h.occ);
      h.done = r.done;
      h.occ = r.occ;
      setFailed(r.failed);
      if (r.error) { setError(commandErrorMessage(r.error)); return false; }
      held.current = null;
      return true;
    } finally {
      invalidatePublicEventCaches(qc);
      void qc.invalidateQueries({ queryKey: eventWorkspaceQueryKey(seriesId) });
      for (const s of steps) {
        if (s.target === 'series') continue;
        void qc.invalidateQueries({ queryKey: occurrenceProgrammeQueryKey(s.id) });
        void qc.invalidateQueries({ queryKey: dateDetailQueryKey(s.id) });
      }
      setBusy(false);
    }
  };
  const forget = () => { held.current = null; setFailed([]); setError(null); };
  return { run, busy, failed, error, forget };
}

/** Finding 12: a toast above the save bar, at most 2 lines, shown at least 4 s. */
export function useV2Toast() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!text) return undefined;
    const t = window.setTimeout(() => setText(null), 4500);
    return () => window.clearTimeout(t);
  }, [text]);
  const node = text ? <div className="v2-toast" role="status" data-testid="v2-toast">{text}</div> : null;
  return { show: setText, node };
}

/** The save bar: change summary + Undo + Save; Saving... and disabled while running; names a partial failure. */
export function SaveBar({ changes, busy, failed, why, onUndo, onSave }: {
  changes: readonly string[]; busy: boolean; failed: readonly string[]; why: string | null; onUndo: () => void; onSave: () => void;
}) {
  if (!changes.length && !failed.length) return null;
  return (
    <div className="v2-savebar" data-testid="v2-savebar">
      <div className="v2-savebar-sum">
        {failed.length ? <span className="r4-err" role="alert" data-testid="v2-save-failed">{V2.notSaved(failed.join(', '))}</span>
          : <span data-testid="v2-save-summary">{summaryOf(changes)}</span>}
        {why && <span className="r4-hint" data-testid="v2-save-why"> {why}</span>}
      </div>
      <button type="button" className="r4-btn r4-btn-line" disabled={busy} onClick={onUndo} data-testid="v2-undo">{V2.undo}</button>
      <button type="button" className="r4-btn" disabled={busy || !!why || !changes.length} onClick={onSave} data-testid="v2-save">
        {busy ? V2.saving : V2.save}
      </button>
    </div>
  );
}

/** "You have unsaved changes": Save / Throw away changes / Keep editing. */
export function UnsavedSheet({ busy, onSave, onThrow, onKeep }: { busy: boolean; onSave: () => void; onThrow: () => void; onKeep: () => void }) {
  return (
    <Sheet title={V2.unsavedTitle} onClose={onKeep} locked={busy}>
      <div className="r4-section r4-pick" data-testid="v2-unsaved">
        <button type="button" className="r4-btn v2-tap" disabled={busy} onClick={onSave} data-testid="v2-unsaved-save">{busy ? V2.saving : V2.save}</button>
        <button type="button" className="r4-btn r4-btn-quiet v2-tap" disabled={busy} onClick={onThrow} data-testid="v2-unsaved-throw">{V2.throwAway}</button>
        <button type="button" className="r4-btn r4-btn-line v2-tap" disabled={busy} onClick={onKeep} data-testid="v2-unsaved-keep">{V2.keepEditing}</button>
      </div>
    </Sheet>
  );
}
