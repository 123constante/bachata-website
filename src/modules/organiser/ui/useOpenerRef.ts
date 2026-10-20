import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const PRESSABLE = 'button, a[href], [role="button"], [role="switch"], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The control a sheet was opened from, for SheetView's returnFocusRef (B-S8).
 * On iOS Safari a tap does not focus the button it lands on, so "whatever had
 * focus" is <body>. This remembers the last control pressed while the sheet is
 * closed (a keyboard Enter or Space fires click too); presses inside the open
 * sheet do not count.
 */
export function useOpenerRef(open: boolean): RefObject<HTMLElement> {
  const ref = useRef<HTMLElement | null>(null);
  const openNow = useRef(open);
  // A layout effect: committed before the sheet's own focus moves in (a passive effect).
  useIsoLayoutEffect(() => {
    openNow.current = open;
  }, [open]);
  useEffect(() => {
    const remember = (e: Event) => {
      if (openNow.current) return;
      const hit = e.target instanceof Element ? e.target.closest<HTMLElement>(PRESSABLE) : null;
      if (hit) ref.current = hit;
    };
    const kinds = ['pointerdown', 'click'] as const;
    for (const k of kinds) document.addEventListener(k, remember, true);
    return () => {
      for (const k of kinds) document.removeEventListener(k, remember, true);
    };
  }, []);
  return ref as RefObject<HTMLElement>;
}
