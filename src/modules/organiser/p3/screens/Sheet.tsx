import { useEffect, useRef, type ReactNode } from 'react';

/** The C3 bottom sheet every P3 step opens in. Escape and the scrim close it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus({ preventScroll: true });
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
