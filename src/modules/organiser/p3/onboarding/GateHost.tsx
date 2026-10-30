import { Suspense, useEffect, useRef, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { closeGate, getGate, subscribeGate } from './gate';

// The sheet (and Review's row words) load only when a write is refused.
const GateSheet = lazyWithRetry(() => import('./GateSheet'));

/**
 * Mounted once in the P3 frame: draws the A1 sheet whenever gate.ts is opened by a refused write
 * (useGatedCopy). Nothing is drawn, and nothing loads, until then.
 */
export function GateHost({ fetcher }: { fetcher?: () => Promise<unknown> }) {
  const ask = useSyncExternalStore(subscribeGate, getGate, getGate);
  // The sheet belongs to the screen that was refused: an ask for another screen (the write was in flight while
  // the person moved on) is dropped, and leaving the screen (Back, a tab) or the P3 frame closes it.
  const { pathname } = useLocation();
  const elsewhere = !!ask && ask.at !== null && ask.at !== pathname;
  const at = useRef(pathname);
  useEffect(() => {
    if (at.current !== pathname || elsewhere) closeGate();
    at.current = pathname;
  }, [pathname, elsewhere]);
  useEffect(() => closeGate, []);
  if (!ask || elsewhere) return null;
  return (
    <Suspense fallback={null}>
      <GateSheet key={ask.seq} organiserId={ask.organiserId} refused={ask.missing} onClose={closeGate} fetcher={fetcher} />
    </Suspense>
  );
}
