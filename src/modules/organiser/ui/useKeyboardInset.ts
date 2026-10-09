import { useEffect, useState } from 'react';

export interface KeyboardInset {
  /** px hidden at the bottom of the layout viewport (on-screen keyboard). */
  inset: number;
  /** Visible viewport height in px, or null where visualViewport is missing. */
  height: number | null;
}

/**
 * Tracks the on-screen keyboard via window.visualViewport. Bottom-fixed UI
 * adds `inset` to its bottom offset and caps its height at `height` so a
 * sticky footer and the focused field stay visible above the keyboard.
 */
export function useKeyboardInset(active = true): KeyboardInset {
  const [state, setState] = useState<KeyboardInset>({ inset: 0, height: null });
  useEffect(() => {
    if (!active || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const read = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setState((s) => (s.inset === inset && s.height === Math.round(vv.height) ? s : { inset, height: Math.round(vv.height) }));
    };
    read();
    vv.addEventListener('resize', read);
    vv.addEventListener('scroll', read);
    return () => {
      vv.removeEventListener('resize', read);
      vv.removeEventListener('scroll', read);
    };
  }, [active]);
  return state;
}
