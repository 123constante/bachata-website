import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Layout timing in the browser; a plain effect on the server, where layout
// effects do not run and React warns about every one it meets. (Same shim, same
// name, as src/modules/organiser/ui/SheetView.tsx.)
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Every new page opens at the top (history.scrollRestoration is 'manual', so
 * Back/Forward land at the top too; nothing restores).
 *
 * LAYOUT effect, not a passive one. A route change is a transition: React
 * commits the new page's DOM in one task and runs passive effects in a later
 * one, and the browser may paint in between. With a passive effect the new
 * page painted at the OLD page's scrollY until the effect caught up -- a frame
 * on a desktop, long enough on a phone that an organiser page opened with its
 * photo and hero scrolled away under the header (owner report, 2026-10-12;
 * tests/e2e-phone/scroll-reset.phone.spec.ts). A layout effect runs inside the
 * same commit, before any paint, so the first frame of the new page is already
 * at the top. When it fires is unchanged: once per pathname or hash change, and
 * never when the new URL has a #hash. (An IN-APP navigation to a #hash URL is
 * not scrolled to its anchor by the browser either -- a pushState does not
 * scroll -- so that case keeps the old page's scrollY, as it always has.)
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useIsoLayoutEffect(() => {
    // Don't override browser's native hash-anchor scrolling
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
