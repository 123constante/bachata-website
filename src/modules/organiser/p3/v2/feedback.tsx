import { useEffect, type ReactNode } from 'react';
import { Sheet } from '../screens/Sheet';

/**
 * Shared helpers of the organiser shell V2 (flag organiserShellV2).
 * Nothing may depend on vibration: every call is a no-op where navigator.vibrate is missing or throws.
 */
export type Buzz = 'tap' | 'error';
export const BUZZ: Record<Buzz, number | number[]> = { tap: 10, error: [30, 60, 30] };

export function vibrate(kind: Buzz = 'tap'): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    return navigator.vibrate(BUZZ[kind]);
  } catch {
    return false;
  }
}

/** A short line at the bottom. No Undo: what it reports has happened. Closes itself after a few seconds. */
export function V2Toast({ text, onClose, ms = 4000 }: { text: string; onClose: () => void; ms?: number }) {
  useEffect(() => {
    const t = window.setTimeout(onClose, ms);
    return () => window.clearTimeout(t);
  }, [onClose, ms]);
  return (
    <div className="v2-toast" role="status" aria-live="polite" data-testid="v2-toast">
      <span className="p3-grow">{text}</span>
      <button type="button" className="v2-toast-x" onClick={onClose} aria-label="Close message">Close</button>
    </div>
  );
}

/**
 * The bottom confirm sheet for a risky action: one plain sentence, ONE action, Cancel.
 * Never window.confirm / alert.
 */
export function ConfirmSheet({ title, sentence, action, danger = false, busy = false, onConfirm, onCancel }: {
  title: string; sentence: ReactNode; action: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Sheet title={title} onClose={onCancel} locked={busy}>
      <div className="p3-stack-s" data-testid="v2-confirm">
        <p className="p3-note">{sentence}</p>
        <button type="button" className={`p3-btn ${danger ? 'p3-btn-danger' : ''}`} style={{ minHeight: 44 }} disabled={busy}
          onClick={() => { vibrate('tap'); onConfirm(); }} data-testid="v2-confirm-go">
          {busy ? <>Working&hellip;</> : action}
        </button>
        <button type="button" className="p3-btn p3-btn-line" style={{ minHeight: 44 }} disabled={busy} onClick={onCancel} data-testid="v2-confirm-cancel">Cancel</button>
      </div>
    </Sheet>
  );
}
