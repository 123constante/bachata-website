import { Suspense, useEffect, useRef, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { closeGate, getGate, subscribeGate } from './gate';

// The sheet (and Review's row words) load only when a write is refused.
const GateSheet = lazyWithRetry(() => import('./GateSheet'));

/**
 * Mounted once in the P3 frame: draws the A1 sheet whenever gate.ts is opened by a refused write
 * (gatedCopy). Nothing is drawn, and nothing loads, until then.
 */
export function GateHost({ fetcher }: { fetcher?: () => Promise<unknown> }) {
  const ask = useSyncExternalStore(subscribeGate, getGate, getGate);
  // The sheet belongs to the screen that was refused: leaving that screen (Back, a tab) or the P3 frame closes it,
  // so it never reappears over another screen later.
  const { pathname } = useLocation();
  const at = useRef(pathname);
  useEffect(() => {
    if (at.current !== pathname) closeGate();
    at.current = pathname;
  }, [pathname]);
  useEffect(() => closeGate, []);
  if (!ask) return null;
  return (
    <Suspense fallback={null}>
      <GateSheet key={ask.seq} organiserId={ask.organiserId} onClose={closeGate} fetcher={fetcher} />
    </Suspense>
  );
}
