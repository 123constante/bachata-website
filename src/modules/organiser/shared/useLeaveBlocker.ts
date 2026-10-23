import { useContext, useEffect, useState } from 'react';
import { UNSAFE_DataRouterContext, UNSAFE_DataRouterStateContext, type Blocker, type BlockerFunction } from 'react-router-dom';

const IDLE_BLOCKER = { state: 'unblocked', proceed: undefined, reset: undefined, location: undefined } as Blocker;
let blockerSeq = 0;

/**
 * react-router's useBlocker, rebuilt on the router's own getBlocker/deleteBlocker.
 * Importing useBlocker itself puts its code in the SHARED react-router chunk,
 * which is on every route's first load (+0.3 KB gz, measured: /classes went
 * over its perf-budgets.json budget). Here it stays in the lazy organiser chunks.
 * Without a data router (MemoryRouter tests) it stays idle. Callers compare
 * pathnames only, so react-router's basename strip is not needed (the site has none).
 * Moved from edit-in-place/EditInPlaceLayer.tsx (ER-FIX2-S5) so the event page shares it.
 */
export function useLeaveBlocker(shouldBlock: BlockerFunction, prefix = 'org-leave'): Blocker {
  const router = useContext(UNSAFE_DataRouterContext)?.router;
  const blockers = useContext(UNSAFE_DataRouterStateContext)?.blockers;
  const [key, setKey] = useState('');
  useEffect(() => {
    if (!router) return;
    const k = `${prefix}-${++blockerSeq}`;
    setKey(k);
    return () => router.deleteBlocker(k);
  }, [router, prefix]);
  useEffect(() => {
    if (router && key) router.getBlocker(key, shouldBlock);
  }, [router, key, shouldBlock]);
  return (key && blockers?.get(key)) || IDLE_BLOCKER;
}
