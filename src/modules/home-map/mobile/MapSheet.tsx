// Festival Map mobile -- persistent bottom sheet over the map. RAW vaul (not
// @/components/ui/drawer, whose overlay would blind the map): non-modal so the
// map stays interactive, non-dismissible (always open), snap points for peek /
// half / full. No Drawer.Overlay. z-40 sits under the header (z-60) and the
// BottomNav (z-50); content is bottom-padded to clear the nav.

import { useEffect, useState } from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';
import { cn } from '@/lib/utils';
import type { UseMapListResult } from '../useMapList';
import {
  TabBar,
  CategoryFilterBar,
  RailHeader,
  RAIL_PANEL_ID,
  railTabId,
} from '../cards/controls';
import { ListSkeleton, RetryNotice } from '../cards/cards';
import { SheetAllTab } from './SheetAllTab';
import { SheetTonightTab } from './SheetTonightTab';
import { SheetNewsTab } from './SheetNewsTab';
import { SheetCalendarTab } from './SheetCalendarTab';

// Lead with events: default to the tall snap (~80% sheet, ~20% map strip). The
// low snap is a true "map mode" (drag down to browse spatially); the top snap is
// the full list. See the post-launch sweep plan (#10) for the rationale.
const SNAP_POINTS = [0.18, 0.8, 0.94];
const DEFAULT_SNAP = SNAP_POINTS[1];

export function MapSheet({
  state,
  cityName,
  loading,
  error,
  onRetry,
  onSnapChange,
}: {
  state: UseMapListResult;
  cityName: string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onSnapChange?: (snap: number | string | null) => void;
}) {
  const [snap, setSnap] = useState<number | string | null>(DEFAULT_SNAP);
  const [nudge, setNudge] = useState(false);

  // One-time first-visit nudge: bounce the grab handle briefly so the
  // pull-up affordance is obvious, then remember we have shown it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem('map-sheet-nudged-v1') === '1') return;
    } catch {
      /* ignore */
    }
    setNudge(true);
    const t = window.setTimeout(() => {
      setNudge(false);
      try {
        window.localStorage.setItem('map-sheet-nudged-v1', '1');
      } catch {
        /* ignore */
      }
    }, 2800);
    return () => window.clearTimeout(t);
  }, []);

  // vaul sets body{pointer-events:none} even with modal={false}; it is inherited
  // into #root and kills the map (can't pan/drag), the header, and the bottom nav
  // -- everything outside this sheet's own portal (which vaul re-enables). The
  // sheet is non-modal, so the background MUST stay interactive: clear the lock and
  // re-clear it whenever vaul re-applies it (it does so on snap-point drags). Scope
  // is the home page only -- MapSheet mounts nowhere else, so other modal drawers
  // keep their background lock.
  useEffect(() => {
    const body = document.body;
    const clear = () => {
      if (body.style.pointerEvents === 'none') body.style.pointerEvents = '';
    };
    clear();
    const mo = new MutationObserver(clear);
    mo.observe(body, { attributes: true, attributeFilter: ['style'] });
    return () => {
      mo.disconnect();
      clear();
    };
  }, []);

  const handleSnap = (s: number | string | null) => {
    setSnap(s);
    onSnapChange?.(s);
  };

  return (
    <DrawerPrimitive.Root
      open
      modal={false}
      dismissible={false}
      onOpenChange={() => {}}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={snap}
      setActiveSnapPoint={handleSnap}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Content
          aria-describedby={undefined}
          className="home-map fixed inset-x-0 bottom-0 z-40 flex h-[94svh] flex-col rounded-t-2xl border-t border-border bg-background outline-none"
        >
          <DrawerPrimitive.Title className="sr-only">Events near you</DrawerPrimitive.Title>
          <div className="mx-auto mt-2.5 flex shrink-0 justify-center pb-0.5" aria-hidden="true">
            <span
              className={cn(
                'h-1.5 w-12 rounded-full bg-muted-foreground/70',
                nudge && 'motion-safe:animate-bounce',
              )}
            />
          </div>
          <div className="shrink-0 space-y-2 px-3 pb-2 pt-1">
            <RailHeader cityName={cityName} count={state.stats.thisWeek} />
            <TabBar tab={state.tab} setTab={state.setTab} />
          </div>
          <div
            ref={state.listRef}
            id={RAIL_PANEL_ID}
            role="tabpanel"
            tabIndex={0}
            aria-labelledby={railTabId(state.tab)}
            className="relative min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(64px+env(safe-area-inset-bottom))] outline-none"
          >
            {loading ? (
              <div className="pt-3">
                <ListSkeleton />
              </div>
            ) : error ? (
              <RetryNotice onRetry={onRetry} />
            ) : (
              <>
                <CategoryFilterBar filter={state.filter} setFilter={state.setFilter} className="pb-3 pt-1" />
                {state.tab === 'all' && <SheetAllTab state={state} />}
                {state.tab === 'tonight' && <SheetTonightTab state={state} />}
                {state.tab === 'news' && <SheetNewsTab state={state} />}
                {state.tab === 'cal' && <SheetCalendarTab state={state} />}
              </>
            )}
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
