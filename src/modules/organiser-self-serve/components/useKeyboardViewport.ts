import { useEffect, useState } from 'react';

export interface KeyboardViewport {
  /** Pixels of the layout viewport the on-screen keyboard covers at the bottom. */
  inset: number;
  /** The height that is actually visible above the keyboard. */
  height: number;
}

/**
 * The on-screen keyboard, measured from window.visualViewport while `active`.
 * iOS Safari and Android Chrome shrink only the VISUAL viewport when the
 * keyboard opens, so a sheet fixed to bottom: 0 would sit behind it; the
 * search view lifts itself by `inset` and fits in `height`. Null when no
 * keyboard is up (or the browser has no visualViewport), so the CSS (85dvh,
 * safe-area padding) does the work alone.
 */
export function useKeyboardViewport(active: boolean): KeyboardViewport | null {
  const [vp, setVp] = useState<KeyboardViewport | null>(null);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!active || !vv) return;
    const update = () => {
      const inset = Math.round(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
      setVp(inset > 0 ? { inset, height: Math.round(vv.height) } : null);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);
  // A stale reading from the last time the search was open never applies.
  return active ? vp : null;
}
