import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { V2 } from './copy';

/** One toast: `seq` changes with every new toast, so a new one replaces the old and restarts the timer. */
export interface V2ToastState { seq: number; text: string; onUndo?: () => void }

export const TOAST_UNDO_MS = 8000;
export const TOAST_PLAIN_MS = 2200;

/**
 * The editor's toast (prototype G-05..G-08): dark, white 15px, 10px radius, 12px in from each side, 76px above the
 * bottom, portalled to the body. With Undo it stays 8 s, without 2.2 s. It never takes focus, so the page does not scroll.
 */
export function V2Toast({ toast, onDone }: { toast: V2ToastState | null; onDone: (seq: number) => void }) {
  const seq = toast?.seq;
  const hasUndo = !!toast?.onUndo;
  useEffect(() => {
    if (seq === undefined) return undefined;
    const t = window.setTimeout(() => onDone(seq), hasUndo ? TOAST_UNDO_MS : TOAST_PLAIN_MS);
    return () => window.clearTimeout(t);
  }, [seq, hasUndo, onDone]);
  if (!toast || typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="status"
      data-testid="v2-toast"
      style={{
        position: 'fixed', left: 12, right: 12, bottom: 76, zIndex: 60, background: '#1C1C1C', color: '#FFFFFF',
        fontSize: 15, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
        boxSizing: 'border-box',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>{toast.text}</span>
      {toast.onUndo && (
        <button
          type="button"
          data-testid="v2-toast-undo"
          onClick={toast.onUndo}
          style={{
            minHeight: 36, padding: '0 14px', border: '1px solid #FFFFFF66', borderRadius: 8, background: 'transparent',
            color: '#FFFFFF', fontSize: 15, fontWeight: 600,
          }}
        >
          {V2.undo}
        </button>
      )}
    </div>,
    document.body,
  );
}
