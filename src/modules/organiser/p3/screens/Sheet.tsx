import { useEffect, useId, useRef, type ReactNode } from 'react';

// The open sheets, oldest first. A sheet can open over another (the A1 gate over the Status sheet): only the
// topmost one answers Escape, so one Escape never closes two.
const open: object[] = [];

/** The C3 bottom sheet every P3 step opens in. Escape (topmost sheet only) and the scrim close it. */
export function Sheet({ title, onClose, locked = false, children }: { title: string; onClose: () => void; locked?: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  // Its own title id, so a sheet over another is named by its own title.
  const titleId = `p3-sheet-title-${useId().replace(/:/g, '')}`;
  const close = useRef(onClose);
  useEffect(() => { close.current = locked ? () => {} : onClose; }, [onClose, locked]);
  useEffect(() => {
    const me = {};
    // what had focus when the sheet opened (the Save that was tapped) gets it back on close (review r1 F4)
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    open.push(me);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && open[open.length - 1] === me) close.current(); };
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('keydown', esc);
      open.splice(open.indexOf(me), 1);
      if (back && back !== document.body && back.isConnected) back.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus({ preventScroll: true });
  }, [title]);
  return (
    <div className="p3-scrim" onClick={(e) => { if (e.target === e.currentTarget && !locked) onClose(); }}>
      <div className="p3-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={box} data-testid="p3-sheet">
        <div className="p3-sheet-head">
          <h3 id={titleId}>{title}</h3>
          <button type="button" className="p3-link" disabled={locked} onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
