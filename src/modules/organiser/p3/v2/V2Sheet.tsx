import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './v2.css';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Editor v2 bottom sheet (prototype G-09..G-12): slides up from the bottom, portalled to the body, focus kept
 * inside, Escape / scrim tap / the round close button all close it. Closing never saves anything.
 */
export function V2Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children?: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    if (!open) return undefined;
    const before = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      const els = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (els.length === 0) { e.preventDefault(); return; }
      const a = els[0];
      const z = els[els.length - 1];
      const cur = document.activeElement;
      if (e.shiftKey && (cur === a || !panel.current.contains(cur))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && (cur === z || !panel.current.contains(cur))) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); before?.focus?.(); };
  }, [open]);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="ev2-sheet" data-testid="v2-sheet">
      <div className="ev2-sheet-scrim" data-testid="v2-sheet-scrim" onClick={onClose} />
      <div className="ev2-sheet-panel" role="dialog" aria-modal="true" aria-label={title} ref={panel} tabIndex={-1}>
        <div className="ev2-sheet-grab" aria-hidden="true" />
        <div className="ev2-sheet-head">
          <h2 className="ev2-sheet-title">{title}</h2>
          <button type="button" className="ev2-sheet-x" aria-label="Close" data-testid="v2-sheet-close" onClick={onClose}>&times;</button>
        </div>
        <div className="ev2 ev2-sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
