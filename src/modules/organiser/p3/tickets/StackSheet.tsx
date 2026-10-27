import { useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';

/*
 * A P3 sheet that can open OVER another sheet (mockup C: the tall Tickets sheet, with
 * the add-ticket and Refund sheets on top). Only the top layer hears Escape and the
 * scrim; the layers under it are inert. Closing a layer gives focus back to the
 * control that opened it, so Back or Escape never closes two layers.
 */

let stack: string[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
const topOf = () => stack[stack.length - 1] ?? null;
/** Each layer's scrim, so a closing layer can lift inert from the layer that is top again. */
const scrims = new Map<string, HTMLElement & { inert: boolean }>();

export function StackSheet({
  title,
  onClose,
  onBack,
  viewKey,
  full,
  footer,
  children,
  testId,
}: {
  title: string;
  onClose: () => void;
  /** An inner view of this same layer (Orders, a step): Back goes there, never closes the layer. */
  onBack?: () => void;
  /** Changes with the layer's view or step: focus moves into the new view. */
  viewKey?: string;
  full?: boolean;
  footer?: ReactNode;
  children: ReactNode;
  testId: string;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  // The control that opened this layer: read on the first render, before anything moves focus.
  const opener = useRef<HTMLElement | null>(typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null));
  const top = useSyncExternalStore(subscribe, topOf, topOf) === id;
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });

  useLayoutEffect(() => {
    if (scrim.current) scrims.set(id, scrim.current as HTMLElement & { inert: boolean });
    stack = [...stack, id];
    emit();
    const back = opener.current;
    return () => {
      stack = stack.filter((s) => s !== id);
      scrims.delete(id);
      // The layer that is top again must not be inert when focus goes back into it
      // (its own effect only runs after the next render; a browser refuses focus on inert).
      const now = topOf();
      const under = now ? scrims.get(now) : undefined;
      if (under) under.inert = false;
      emit();
      if (back && back.isConnected) back.focus();
    };
  }, [id]);

  useLayoutEffect(() => {
    if (scrim.current) (scrim.current as HTMLElement & { inert: boolean }).inert = !top;
  }, [top]);

  useEffect(() => {
    if (!top) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && topOf() === id) {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [top, id]);

  // Focus on open and on each new view or step: the marked control, else the body's first
  // control, else the footer's, never the header's Close first.
  const shownView = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!top) return;
    const el = box.current;
    // A new view or step always takes focus; otherwise only when focus is not already inside.
    const moved = shownView.current !== `${title}|${viewKey ?? ''}`;
    shownView.current = `${title}|${viewKey ?? ''}`;
    if (!el || (!moved && el.contains(document.activeElement))) return;
    const pick = (sel: string) => el.querySelector<HTMLElement>(sel);
    const ctl = 'button:not([disabled]), input:not([disabled])';
    (pick('[data-sheet-autofocus]:not([disabled])') ?? pick(`.p3-sheet-body :is(${ctl})`) ?? pick(`.p3-sheet-foot :is(${ctl})`) ?? pick(ctl))?.focus();
  }, [top, title, viewKey]);

  return (
    <div
      ref={scrim}
      className="p3-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget && top) onClose();
      }}
      data-testid={`${testId}-scrim`}
    >
      <div
        className={full ? 'p3-sheet p3-sheet-full' : 'p3-sheet'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        ref={box}
        data-testid={testId}
        data-top={top}
      >
        <div className="p3-sheet-head">
          {onBack ? (
            <button type="button" className="p3-link" onClick={onBack} data-testid={`${testId}-back`}>
              &larr; Back
            </button>
          ) : null}
          <h3 id={`${id}-t`} className="p3-grow">{title}</h3>
          <button type="button" className="p3-link" onClick={onClose} data-testid={`${testId}-close`}>
            Close
          </button>
        </div>
        <div className="p3-sheet-body">{children}</div>
        {footer && <div className="p3-sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}
