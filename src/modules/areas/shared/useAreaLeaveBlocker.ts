import { useCallback, useContext, useEffect, useState } from 'react';
import { UNSAFE_DataRouterContext, UNSAFE_DataRouterStateContext, type Blocker, type BlockerFunction } from 'react-router-dom';
import { isFormDirty, setRouterGuard } from './leaveGuard';

const IDLE_BLOCKER = { state: 'unblocked', proceed: undefined, reset: undefined, location: undefined } as Blocker;
let blockerSeq = 0;

/**
 * Review RESTYLE-A B4: the area's router blocker, built like the rebuild's useLeaveBlocker
 * (src/modules/organiser/edit-in-place/EditInPlaceLayer.tsx) on getBlocker/deleteBlocker, NOT useBlocker, whose code
 * would land in the shared react-router chunk on every route's first load (perf budget). Blocks any pathname change
 * while a form is dirty. Without a data router (MemoryRouter tests, legacy BrowserRouter) it stays idle and the store's
 * own asking (GuardedLink) is the fallback.
 */
export function useAreaLeaveBlocker(): Blocker {
  const router = useContext(UNSAFE_DataRouterContext)?.router;
  const blockers = useContext(UNSAFE_DataRouterStateContext)?.blockers;
  const [key, setKey] = useState('');
  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) => isFormDirty() && currentLocation.pathname !== nextLocation.pathname,
    [],
  );
  useEffect(() => {
    if (!router) return undefined;
    const k = `area-leave-${++blockerSeq}`;
    setKey(k);
    router.getBlocker(k, shouldBlock);
    setRouterGuard(true);
    return () => {
      setRouterGuard(false);
      router.deleteBlocker(k);
    };
  }, [router, shouldBlock]);
  return (key && blockers?.get(key)) || IDLE_BLOCKER;
}
