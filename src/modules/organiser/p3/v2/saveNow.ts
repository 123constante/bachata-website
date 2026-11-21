import { useCallback, useEffect, useRef, useState } from 'react';
import { inverseOf, type StepBefore, type WriteStep } from './editorModel';
import { useV2Save } from './SaveBar';
import type { V2ToastState } from './V2Toast';

export const SAVED_TEXT = 'Saved';
export const UNDONE_TEXT = 'Undone';
export const NOT_SAVED_TEXT = 'Not saved. Try again.';
export const UNDO_FAILED_TEXT = "Couldn't undo. Reload and try again.";

/** The inverse steps, in the order Undo runs them (reverse), or null when any step has none. */
export function undoPlan(steps: readonly WriteStep[], before: readonly (StepBefore | null | undefined)[]): WriteStep[] | null {
  const inv: WriteStep[] = [];
  for (let i = 0; i < steps.length; i += 1) {
    const s = inverseOf(steps[i], before[i]);
    if (!s) return null;
    // the write bumped this night's version once; the inverse goes against the version it left
    if (s.target !== 'series' && s.version != null) {
      const earlier = steps.slice(0, i).filter((x) => x.target !== 'series' && x.id === s.id).length;
      inv.push({ ...s, version: s.version + earlier + 1 });
    } else inv.push(s);
  }
  return inv.reverse();
}

/**
 * Save at once (editor v2): runs the steps through the existing useV2Save runner, then shows the toast. If every
 * step has an inverse the toast carries Undo, which runs the inverses in reverse order and shows "Undone" (no Undo).
 * A failure shows no toast and returns the error text; the runner keeps its idempotency keys for a retry.
 */
export function useSaveNow(seriesId: string, seriesVersion: number) {
  const save = useV2Save(seriesId, seriesVersion);
  const runRef = useRef(save.run);
  const errorRef = useRef<string | null>(null);
  // Undo must use the latest series version, not the one at the tap
  useEffect(() => { runRef.current = save.run; errorRef.current = save.error; });
  const seq = useRef(0);
  const [toast, setToast] = useState<V2ToastState | null>(null);
  const show = useCallback((text: string, onUndo?: () => void) => { seq.current += 1; setToast({ seq: seq.current, text, onUndo }); }, []);
  const done = useCallback((n: number) => setToast((t) => (t && t.seq === n ? null : t)), []);

  const saveNow = async (
    steps: WriteStep[], before: readonly (StepBefore | null | undefined)[] = [], label: string = SAVED_TEXT, opts: { noUndo?: boolean } = {},
  ): Promise<{ ok: boolean; error: string | null }> => {
    if (!steps.length) return { ok: false, error: null };
    const ok = await runRef.current(steps);
    if (!ok) {
      // run() reports the text through state; let that render land, then read it (a second tap during the run returns false with none)
      await new Promise((r) => { setTimeout(r, 0); });
      return { ok: false, error: errorRef.current ?? NOT_SAVED_TEXT };
    }
    const inverse = opts.noUndo ? null : undoPlan(steps, before);
    const onUndo = inverse
      ? () => {
        void (async () => {
          if (await runRef.current(inverse)) show(UNDONE_TEXT);
          else show(UNDO_FAILED_TEXT);
        })();
      }
      : undefined;
    show(label, onUndo);
    return { ok: true, error: null };
  };
  return { saveNow, toast, onToastDone: done, busy: save.busy, error: save.error, failed: save.failed, forget: save.forget };
}
