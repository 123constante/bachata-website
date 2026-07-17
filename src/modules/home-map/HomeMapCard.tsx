// Festival Map home -- the Leaflet card and ALL of its chrome. The one place on
// the homepage where a JS viewport branch is legal.
//
// It is legal here for a structural reason, not by luck: this module is lazy AND
// gated behind HomeMapShell's `mapMounted` flag (Leaflet touches `window` at
// module load), so it is never imported on the server and never rendered on the
// first client render. There is therefore no server markup for a viewport branch
// to disagree with, and useIsDesktopMapChrome can seed itself synchronously from
// matchMedia. Everything the SERVER renders -- head, dock, feed -- is in
// HomeMapShell and is CSS-responsive with no JS branch at all. Keep it that way:
// see ./viewport for why (React #421, and why UA sniffing is not an option).
//
// Mobile chrome: a compact popup-less map in an inset bento card. A pin tap opens
// an inline MapPreviewCard, a cluster tap lists its events, a background tap
// clears. "Explore the map" promotes the card to a true edge-to-edge overlay
// (.is-fullscreen in index.css makes .hm-mapcard position:fixed; body.hm-immersive
// hides the global header + bottom nav), with a top bar carrying a "List" exit
// pill, a map filter field and the category chips. Back/swipe-back and Escape also
// exit; focus moves to the exit pill on open and back to the expand button on
// close; a one-time hint teaches it.
//
// Desktop chrome: the dominant map beside the rail -- native popups, a top-right
// zoom/locate/reframe stack and the self-dismissing MapHint. No fullscreen (the
// map is already half the screen) and no inline preview (a pin tap scrolls the
// feed to the card instead -- see useMapList.fromPin).

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Plus, Minus, Focus, ChevronLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import type { UseMapListResult } from './useMapList';
import type { MapEvent, MapFilter } from './mapTypes';
import { useIsDesktopMapChrome } from './viewport';
import { CategoryChips, SearchField, focusRing } from './cards/controls';
import { MapLocateButton } from './cards/LocateControl';
import { MapPreviewCard } from './mobile/MapPreviewCard';
import { MapHintPill } from './mobile/MapHintPill';
import { MapHint } from './MapHint';

const EventMap = lazyWithRetry(() => import('./EventMap'));

// Constrain the mobile map to Greater London so a fling rubber-bands back rather
// than drifting to empty ocean (EventMap applies maxBoundsViscosity).
const GREATER_LONDON: [[number, number], [number, number]] = [
  [51.25, -0.55],
  [51.72, 0.34],
];

const COACH_KEY = 'hm-fs-coach';

// Partial map: 'all' has no noun (the empty-filter caption only renders when the
// filter is NOT 'all'), so the lookup is genuinely `string | undefined`.
const FILTER_NOUN: Partial<Record<MapFilter, string>> = {
  parties: 'parties',
  classes: 'classes',
  festivals: 'festivals',
};

const ctrlBtn = cn(
  // 36px visual circle; a transparent pseudo extends the tap target to 44px
  // (WCAG 2.5.5) without growing the layout box, so the vertical stack still
  // fits the clamped map card. gap-2 keeps adjacent 44px hit areas from overlapping.
  "relative grid h-9 w-9 place-items-center rounded-full bg-background/80 text-foreground shadow-md backdrop-blur transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-muted",
  focusRing,
);

const zoomBtn =
  'grid h-11 w-11 place-items-center bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary';

type Preview = { kind: 'single' | 'cluster'; ids: string[]; dock: 'top' | 'bottom' };

function readCoachSeen(): boolean {
  try {
    return localStorage.getItem(COACH_KEY) === '1';
  } catch {
    return false;
  }
}

export default function HomeMapCard({
  state,
  loading,
  error,
  fullscreen,
  setFullscreen,
}: {
  state: UseMapListResult;
  /** Feed-load state, so the "no parties this week" caption can't fire while the
   *  map simply has no data yet. */
  loading?: boolean;
  error?: boolean;
  fullscreen: boolean;
  setFullscreen: (v: boolean) => void;
}) {
  const { apiRef } = state;
  const desktop = useIsDesktopMapChrome();
  const wrapRef = useRef<HTMLDivElement>(null);
  const expandBtnRef = useRef<HTMLButtonElement>(null);
  const exitPillRef = useRef<HTMLButtonElement>(null);
  const prevFs = useRef(false);
  const latestFsRef = useRef(false);
  const [coachSeen, setCoachSeen] = useState(readCoachSeen);
  // Preview is local (set only by map interactions) so a FEED card tap -- which
  // also sets state.selected before navigating -- can't flash a preview open.
  const [preview, setPreview] = useState<Preview | null>(null);

  const dismissCoach = useCallback(() => {
    setCoachSeen(true);
    try {
      localStorage.setItem(COACH_KEY, '1');
    } catch {
      /* private mode / blocked storage -- the hint just reappears next session */
    }
  }, []);

  // Fullscreen AND the inline preview are mobile-only chrome (the expand button is
  // the only way into one, and the desktop branch never renders the other). If the
  // viewport crosses the breakpoint, shed both: an orphaned fullscreen would strand a
  // user under a fixed overlay with no visible way back, and an orphaned preview --
  // which desktop simply stops rendering rather than clearing -- would spring back
  // open, for a pin that may no longer be selected, the moment the viewport narrowed
  // again.
  useEffect(() => {
    if (!desktop) return;
    setPreview(null);
    if (fullscreen) setFullscreen(false);
  }, [desktop, fullscreen, setFullscreen]);

  // iOS Safari resolves svh / safe-area after first paint and on every URL-bar
  // show/hide; without a re-measure the map can stay mis-sized or blank (audit
  // #4). Watch the container + visualViewport + orientation. The ResizeObserver
  // also covers the desktop case (the split is a fixed %, so the map cell only
  // changes size when the window does).
  useEffect(() => {
    const invalidate = () => apiRef.current?.invalidate();
    let ro: ResizeObserver | undefined;
    if (wrapRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(invalidate);
      ro.observe(wrapRef.current);
    }
    const vv = window.visualViewport;
    vv?.addEventListener('resize', invalidate);
    window.addEventListener('orientationchange', invalidate);
    return () => {
      ro?.disconnect();
      vv?.removeEventListener('resize', invalidate);
      window.removeEventListener('orientationchange', invalidate);
    };
  }, [apiRef]);

  // Enter/exit fullscreen changes the map cell size (inset card <-> fixed
  // overlay) -- re-measure once it settles so Leaflet repaints at the new size.
  useEffect(() => {
    const t = window.setTimeout(() => apiRef.current?.invalidate(), 80);
    const t2 = window.setTimeout(() => apiRef.current?.invalidate(), 320);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [fullscreen, apiRef]);

  // Fullscreen hides the global header + bottom nav (a body class drives the
  // global CSS in index.css) so the map overlay is truly edge-to-edge. Removed
  // on exit and on unmount (e.g. navigating away) so the chrome never sticks hidden.
  useEffect(() => {
    document.body.classList.toggle('hm-immersive', fullscreen);
    return () => document.body.classList.remove('hm-immersive');
  }, [fullscreen]);

  // Back-to-exit + Escape-to-exit. Entering pushes a history entry so Android
  // back / browser back / swipe-back closes the map first instead of leaving the
  // page; Escape and the List pill mirror it for keyboards/taps.
  //
  // The cleanup must pop the entry we pushed on a UI exit (pill/Escape) but NOT
  // when the browser already popped it (back button) nor when the component
  // unmounts mid-fullscreen during a forward navigation (tap a pin -> event
  // page), where the entry must stay so Back returns here. The effect closure's
  // `fullscreen` is always true (the body early-returns otherwise), so it can't
  // discriminate -- instead:
  //   popped (per-run flag): the back button set it via onPop -> skip back().
  //   latestFsRef (latest value, set in the layout effect below, which runs
  //     before this useEffect cleanup): false => a real UI exit -> pop the entry;
  //     true => unmounting while still fullscreen (forward nav) -> leave it.
  useEffect(() => {
    if (!fullscreen) return;
    let popped = false;
    window.history.pushState({ hmFs: true }, '');
    const onPop = () => {
      popped = true;
      setFullscreen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
      if (!popped && !latestFsRef.current) window.history.back();
    };
  }, [fullscreen, setFullscreen]);

  // Mirror the latest fullscreen value for the back-button cleanup above. A
  // layout effect, so it is already up to date when that cleanup runs. (The
  // feed's `inert` is the shell's job -- it owns that element.)
  useLayoutEffect(() => {
    latestFsRef.current = fullscreen;
  }, [fullscreen]);

  // Focus management (useEffect, post-paint so focus moves after the enter
  // animation has started). On open: move focus to the exit pill. On close:
  // return focus to the expand button and auto-dismiss the one-time coach hint.
  useEffect(() => {
    if (fullscreen) {
      prevFs.current = true;
      const id = window.requestAnimationFrame(() => exitPillRef.current?.focus());
      return () => window.cancelAnimationFrame(id);
    }
    if (prevFs.current) {
      prevFs.current = false;
      expandBtnRef.current?.focus();
      if (!coachSeen) dismissCoach();
    }
  }, [fullscreen, coachSeen, dismissCoach]);

  // A tab, filter OR day change dismisses any open preview (the event it
  // described may no longer be on the map -- on the Calendar tab the visible pin
  // set is day-driven). Selection itself is cleared inside useMapList.
  useEffect(() => {
    setPreview(null);
  }, [state.tab, state.filter, state.day]);

  const previewEvents = useMemo(() => {
    if (!preview) return [] as MapEvent[];
    return preview.ids
      .map((id) => state.eventsByOcc.get(id))
      .filter((e): e is MapEvent => Boolean(e));
  }, [preview, state.eventsByOcc]);

  const previewOpen = previewEvents.length > 0;
  // dock is captured at tap time (below) and read from state -- a pure render,
  // no live ref read. Defaults to the bottom edge.
  const dock: 'top' | 'bottom' = preview?.dock ?? 'bottom';
  const previewKey = preview ? `${preview.kind}:${preview.ids.join(',')}` : '';

  // Flip the card to the top edge when the tapped pin sits in the lower half so
  // the card never covers it. Captured imperatively at the moment of the tap
  // (geometry is current), then stored in state.
  const { fromPin } = state;
  const dockFor = useCallback(
    (occId: string): 'top' | 'bottom' => (apiRef.current?.pinHalf(occId) === 'bottom' ? 'top' : 'bottom'),
    [apiRef],
  );

  // Map interaction handlers (pin / cluster / background). A single pin both
  // highlights (state.fromPin) and opens the local preview; a cluster clears the
  // single selection and lists its children; null clears everything. A pin tap is
  // also taken as "hint understood" -> persist the coach dismissal.
  const handlePinSelect = useCallback(
    (occId: string | null) => {
      fromPin(occId);
      setPreview(occId ? { kind: 'single', ids: [occId], dock: dockFor(occId) } : null);
      if (occId && !coachSeen) dismissCoach();
    },
    [fromPin, dockFor, coachSeen, dismissCoach],
  );
  const handleClusterSelect = useCallback(
    (occIds: string[]) => {
      fromPin(null);
      setPreview(occIds.length ? { kind: 'cluster', ids: occIds, dock: 'bottom' } : null);
      if (occIds.length && !coachSeen) dismissCoach();
    },
    [fromPin, coachSeen, dismissCoach],
  );
  const closePreview = useCallback(() => {
    fromPin(null);
    setPreview(null);
  }, [fromPin]);

  const filterNoun = FILTER_NOUN[state.filter];
  const showEmptyFilter =
    !loading && !error && !previewOpen && state.filter !== 'all' && state.mapVisible.length === 0;
  const showCoach = fullscreen && !coachSeen && !previewOpen && !showEmptyFilter;

  return (
    // Full-bleed layer inside .hm-mapcard. It is positioned (so EventMap's
    // absolutely-positioned canvas fills it) but creates no stacking context, so
    // the overlay z-indexes below still resolve against Leaflet's panes exactly
    // as they did when these controls were direct children of the card.
    <div ref={wrapRef} className="absolute inset-0">
      {/* The two branches are the SAME component in the SAME slot, so React would
          reconcile in place rather than remount -- and EventMap builds its Leaflet
          instance in a mount-only effect, freezing minZoom / maxBounds / popupMode at
          whatever the FIRST viewport asked for. The old two-component split (MobileMapHome
          vs DesktopMapHome) gave us that remount for free; the explicit key restores it,
          so a window resize or a tablet rotating across the breakpoint re-inits the map
          with the right options instead of stranding it with the other viewport's. */}
      <Suspense
        fallback={
          <div className="absolute inset-0 animate-pulse" style={{ background: '#11121a' }}>
            <span className="sr-only">Loading map</span>
          </div>
        }
      >
        {desktop ? (
          <EventMap
            key="desktop"
            events={state.pins}
            visible={state.mapVisible}
            glow={state.glow}
            selected={state.mapSelected}
            hovered={state.mapHovered}
            onSelect={state.fromPin}
            onHover={state.setHovered}
            onReady={state.onMapReady}
            onOpenEvent={state.openEvent}
            userCoords={state.geo.coords}
          />
        ) : (
          <EventMap
            key="mobile"
            events={state.pins}
            visible={state.mapVisible}
            glow={state.glow}
            selected={state.mapSelected}
            hovered={state.mapHovered}
            onSelect={handlePinSelect}
            onClusterSelect={handleClusterSelect}
            onHover={state.setHovered}
            onReady={state.onMapReady}
            onOpenEvent={state.openEvent}
            userCoords={state.geo.coords}
            popupMode="none"
            compact
            maxBounds={GREATER_LONDON}
            minZoom={10}
          />
        )}
      </Suspense>

      {desktop ? (
        <>
          {/* First-visit hint that the pins are interactive. Self-dismisses. */}
          <div className="pointer-events-none absolute left-3 top-3 z-[500]">
            <MapHint />
          </div>
          {/* Map controls (top-right): zoom, locate, reframe. */}
          <div className="absolute right-3 top-3 z-50 flex flex-row gap-1.5">
            <button type="button" onClick={() => apiRef.current?.zoom(1)} aria-label="Zoom in" className={zoomBtn}>
              <Plus className="h-[18px] w-[18px]" />
            </button>
            <button type="button" onClick={() => apiRef.current?.zoom(-1)} aria-label="Zoom out" className={zoomBtn}>
              <Minus className="h-[18px] w-[18px]" />
            </button>
            <MapLocateButton
              geo={state.geo}
              baseClassName={zoomBtn}
              onRecenter={() => apiRef.current?.panToUser(state.geo.coords)}
            />
            <button
              type="button"
              onClick={() => apiRef.current?.reset?.()}
              aria-label="Fit map to all events"
              className={`${zoomBtn} !text-primary`}
            >
              <Focus className="h-[18px] w-[18px]" />
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Fullscreen top bar: "List" exit pill + "search this map" + category
              chips, so the expanded map stays findable, filterable and obviously
              exitable. Hidden while a preview is open (the preview owns the surface). */}
          {fullscreen && !previewOpen && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] flex flex-col gap-2 bg-gradient-to-b from-background/95 via-background/70 to-transparent px-2 pb-6 pt-[max(env(safe-area-inset-top),0.5rem)]">
              <div className="flex items-center gap-2">
                <button
                  ref={exitPillRef}
                  type="button"
                  onClick={() => setFullscreen(false)}
                  aria-label="Back to the list"
                  className={cn(
                    'pointer-events-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background/90 py-2 pl-2 pr-3.5 text-sm font-bold text-foreground shadow-lg backdrop-blur hover:bg-muted',
                    focusRing,
                  )}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  List
                </button>
                <SearchField
                  value={state.q}
                  onChange={state.setQ}
                  filter
                  placeholder="Filter by name or venue"
                  ariaLabel="Filter events on the map"
                  matchCount={state.q ? state.mapVisible.length : null}
                  className="pointer-events-auto min-w-0 flex-1 bg-background/90 shadow-lg backdrop-blur"
                />
              </div>
              <div className="pointer-events-auto overflow-x-auto">
                <CategoryChips filter={state.filter} setFilter={state.setFilter} />
              </div>
            </div>
          )}

          {/* Control stack -- hidden while a preview is open (it would collide with
              a top-docked card and is redundant mid-preview). In fullscreen the
              expand toggle is replaced by the top-bar "List" pill, and the stack
              drops below the (taller) top bar. */}
          {!previewOpen && (
            <div
              className={cn(
                'absolute left-2 z-[500] flex flex-col gap-2',
                fullscreen ? 'top-[calc(env(safe-area-inset-top)_+_6rem)]' : 'top-2',
              )}
            >
              {!fullscreen && (
                <button
                  ref={expandBtnRef}
                  type="button"
                  onClick={() => setFullscreen(true)}
                  aria-label="Explore the full map"
                  className={ctrlBtn}
                >
                  <Maximize2 className="h-[18px] w-[18px]" />
                </button>
              )}
              <button type="button" onClick={() => apiRef.current?.zoom(1)} aria-label="Zoom in" className={ctrlBtn}>
                <Plus className="h-[18px] w-[18px]" />
              </button>
              <button type="button" onClick={() => apiRef.current?.zoom(-1)} aria-label="Zoom out" className={ctrlBtn}>
                <Minus className="h-[18px] w-[18px]" />
              </button>
              <MapLocateButton
                geo={state.geo}
                baseClassName={ctrlBtn}
                onRecenter={() => apiRef.current?.panToUser(state.geo.coords)}
              />
              {fullscreen && (
                <button
                  type="button"
                  onClick={() => apiRef.current?.reset?.()}
                  aria-label="Fit map to all events"
                  className={cn(ctrlBtn, '!text-primary')}
                >
                  <Focus className="h-[18px] w-[18px]" />
                </button>
              )}
            </div>
          )}

          {/* Bottom-centre overlay: empty-filter caption > first-run coach hint
              (fullscreen only) > the one-time "tap a pin" hint. All hide mid-preview. */}
          {!previewOpen && (showEmptyFilter || showCoach || !fullscreen) && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 z-[400] flex justify-center px-3">
              {showEmptyFilter ? (
                <button
                  type="button"
                  onClick={() => state.setFilter('all')}
                  className={cn(
                    'pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-lg backdrop-blur',
                    focusRing,
                  )}
                >
                  No {filterNoun ?? 'events'} this week &middot;{' '}
                  <span className="font-bold text-primary">Show all</span>
                </button>
              ) : showCoach ? (
                <div className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background/90 py-1.5 pl-3 pr-1.5 text-xs font-semibold text-foreground shadow-lg backdrop-blur">
                  <span className="truncate">
                    Tap a pin for the event &middot; tap <b className="text-primary">List</b> to exit
                  </span>
                  <button
                    type="button"
                    onClick={dismissCoach}
                    aria-label="Dismiss hint"
                    className={cn(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground',
                      focusRing,
                    )}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <MapHintPill />
              )}
            </div>
          )}

          {previewOpen && (
            <MapPreviewCard
              key={previewKey}
              events={previewEvents}
              dock={dock}
              onClose={closePreview}
              onOpen={state.fromCard}
            />
          )}
        </>
      )}
    </div>
  );
}
