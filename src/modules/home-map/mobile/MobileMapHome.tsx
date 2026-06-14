// Festival Map mobile home (Approach C3) -- the map lives in a rounded inset
// "bento" card; everything that used to live in the bottom sheet is now static
// page content and the feed is the only scroller. No vaul sheet, no snap-driven
// re-measures. Layout: [page head][map card][dock: tabs + chips][feed]. The
// `.home-map` class on the root scopes the cover-scene CSS for the feed + preview
// cards; the `.home-map-fill` class supplies the shell height + the column/landscape
// layout (index.css). The map is compact + popup-less: a pin tap shows an inline
// MapPreviewCard, a cluster tap lists its events, a background tap clears it.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, Plus, Minus, Focus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import type { UseMapListResult } from '../useMapList';
import type { MapEvent, MapFilter } from '../mapTypes';
import { CATEGORY_COLORS } from '../mapTypes';
import { TabBar, CategoryChips, RAIL_PANEL_ID, railTabId, focusRing } from '../cards/controls';
import { ListSkeleton, RetryNotice } from '../cards/cards';
import { SheetAllTab } from './SheetAllTab';
import { SheetTonightTab } from './SheetTonightTab';
import { SheetNewsTab } from './SheetNewsTab';
import { SheetCalendarTab } from './SheetCalendarTab';
import { MapPreviewCard } from './MapPreviewCard';
import { MapHintPill } from './MapHintPill';

const EventMap = lazyWithRetry(() => import('../EventMap'));

// Constrain the mobile map to Greater London so a fling rubber-bands back rather
// than drifting to empty ocean (EventMap applies maxBoundsViscosity).
const GREATER_LONDON: [[number, number], [number, number]] = [
  [51.25, -0.55],
  [51.72, 0.34],
];

// Partial map: 'all' has no noun (the empty-filter caption only renders when the
// filter is NOT 'all'), so the lookup is genuinely `string | undefined`.
const FILTER_NOUN: Partial<Record<MapFilter, string>> = {
  parties: 'parties',
  classes: 'classes',
  festivals: 'festivals',
};

// Tagline keyword colours == the map category colours, so the head doubles as a
// pin/chip legend (pattern shared with NewsBrandCard).
const KW = { class: CATEGORY_COLORS.class, party: CATEGORY_COLORS.party, fest: CATEGORY_COLORS.fest } as const;

const ctrlBtn = cn(
  'grid h-9 w-9 place-items-center rounded-full bg-background/80 text-foreground shadow-md backdrop-blur transition-colors hover:bg-muted',
  focusRing,
);

type Preview = { kind: 'single' | 'cluster'; ids: string[]; dock: 'top' | 'bottom' };

export default function MobileMapHome({
  state,
  cityName,
  loading,
  error,
  onRetry,
}: {
  state: UseMapListResult;
  cityName: string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  const { apiRef } = state;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  // Preview is local (set only by map interactions) so a FEED card tap -- which
  // also sets state.selected before navigating -- can't flash a preview open.
  const [preview, setPreview] = useState<Preview | null>(null);

  // iOS Safari resolves svh / safe-area after first paint and on every URL-bar
  // show/hide; without a re-measure the map can stay mis-sized or blank (audit
  // #4). Watch the container + visualViewport + orientation.
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

  // Expand/collapse changes the map cell size -- re-measure once it settles.
  useEffect(() => {
    const t = window.setTimeout(() => apiRef.current?.invalidate(), 80);
    return () => window.clearTimeout(t);
  }, [fullscreen, apiRef]);

  // A tab, filter OR day change dismisses any open preview (the event it
  // described may no longer be on the map -- on the Calendar tab the visible pin
  // set is day-driven). Selection itself is cleared inside useMapList.
  useEffect(() => {
    setPreview(null);
  }, [state.tab, state.filter, state.day]);

  const pinsByOcc = useMemo(() => {
    const m = new Map<string, MapEvent>();
    for (const e of state.pins) m.set(e.occurrence_id, e);
    return m;
  }, [state.pins]);

  const previewEvents = useMemo(() => {
    if (!preview) return [] as MapEvent[];
    return preview.ids
      .map((id) => pinsByOcc.get(id))
      .filter((e): e is MapEvent => Boolean(e));
  }, [preview, pinsByOcc]);

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
  // single selection and lists its children; null clears everything.
  const handlePinSelect = useCallback(
    (occId: string | null) => {
      fromPin(occId);
      setPreview(occId ? { kind: 'single', ids: [occId], dock: dockFor(occId) } : null);
    },
    [fromPin, dockFor],
  );
  const handleClusterSelect = useCallback(
    (ids: string[]) => {
      fromPin(null);
      setPreview(ids.length ? { kind: 'cluster', ids, dock: dockFor(ids[0]) } : null);
    },
    [fromPin, dockFor],
  );
  const closePreview = useCallback(() => {
    fromPin(null);
    setPreview(null);
  }, [fromPin]);

  const filterNoun = FILTER_NOUN[state.filter];
  const showEmptyFilter =
    !loading && !error && !previewOpen && state.filter !== 'all' && state.mapVisible.length === 0;

  return (
    <div
      ref={wrapRef}
      className={cn(
        'home-map-fill home-map relative isolate flex w-full flex-col overflow-hidden',
        fullscreen && 'is-fullscreen',
      )}
    >
      {!fullscreen && (
        <a
          href={`#${RAIL_PANEL_ID}`}
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[700] focus:rounded focus:bg-primary focus:px-3 focus:py-1.5 focus:text-sm focus:font-bold focus:text-primary-foreground"
        >
          Skip map, go to events
        </a>
      )}

      {!fullscreen && (
        <div className="hm-pagehead shrink-0 px-3 pb-1 pt-2">
          <h1 className="truncate text-base font-extrabold tracking-tight">
            What&rsquo;s on in {cityName}
          </h1>
          <p className="text-xs font-semibold text-muted-foreground">
            Every <b style={{ color: KW.class }}>class</b>, <b style={{ color: KW.party }}>party</b> &amp;{' '}
            <b style={{ color: KW.fest }}>festival</b> in one place.
          </p>
        </div>
      )}

      {/* Map card (inset bento). Height + landscape behaviour come from the
          .hm-mapcard / .is-fullscreen rules in index.css. */}
      <div className="hm-mapcard relative mx-3 overflow-hidden rounded-2xl border border-border" role="region" aria-label="Event map">
        <Suspense
          fallback={
            <div className="absolute inset-0 animate-pulse" style={{ background: '#11121a' }}>
              <span className="sr-only">Loading map</span>
            </div>
          }
        >
          <EventMap
            events={state.pins}
            visible={state.mapVisible}
            glow={state.glow}
            selected={state.mapSelected}
            hovered={state.mapHovered}
            onSelect={handlePinSelect}
            onHover={state.setHovered}
            onReady={state.onMapReady}
            onOpenEvent={state.openEvent}
            onClusterSelect={handleClusterSelect}
            popupMode="none"
            compact
            maxBounds={GREATER_LONDON}
            minZoom={10}
          />
        </Suspense>

        {/* Control stack -- hidden while a preview is open (it would collide with
            a top-docked card and is redundant mid-preview). */}
        {!previewOpen && (
          <div className="absolute right-2 top-2 z-[500] flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setFullscreen((v) => !v)}
              aria-label={fullscreen ? 'Exit full screen map' : 'Expand map to full screen'}
              aria-pressed={fullscreen}
              className={ctrlBtn}
            >
              {fullscreen ? <Minimize2 className="h-[18px] w-[18px]" /> : <Maximize2 className="h-[18px] w-[18px]" />}
            </button>
            <button type="button" onClick={() => apiRef.current?.zoom(1)} aria-label="Zoom in" className={ctrlBtn}>
              <Plus className="h-[18px] w-[18px]" />
            </button>
            <button type="button" onClick={() => apiRef.current?.zoom(-1)} aria-label="Zoom out" className={ctrlBtn}>
              <Minus className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => apiRef.current?.reset()}
              aria-label="Re-frame the map on the visible events"
              className={cn(ctrlBtn, '!text-primary')}
            >
              <Focus className="h-[18px] w-[18px]" />
            </button>
          </div>
        )}

        {/* Bottom-centre overlay: the empty-filter caption takes priority over the
            one-time interaction hint. Both hide while a preview is open. */}
        {!previewOpen && (
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
                No {filterNoun ?? 'events'} this week &middot; <span className="font-bold text-primary">Show all</span>
              </button>
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
      </div>

      {!fullscreen && (
        <div className="hm-side flex min-h-0 flex-1 flex-col">
          <div className="hm-dock shrink-0 px-3 pt-3">
            <TabBar tab={state.tab} setTab={state.setTab} variant="pill" />
            <CategoryChips filter={state.filter} setFilter={state.setFilter} size="sm" className="mt-2 pb-0.5" />
          </div>

          <div
            ref={state.listRef}
            id={RAIL_PANEL_ID}
            role="tabpanel"
            tabIndex={0}
            aria-labelledby={railTabId(state.tab)}
            className="hm-feed relative min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2 outline-none"
          >
            <h2 className="sr-only">Events near you</h2>
            {loading ? (
              <div className="pt-1">
                <ListSkeleton />
              </div>
            ) : error ? (
              <RetryNotice onRetry={onRetry} />
            ) : (
              <>
                {state.tab === 'all' && <SheetAllTab state={state} />}
                {state.tab === 'tonight' && <SheetTonightTab state={state} />}
                {state.tab === 'news' && <SheetNewsTab state={state} />}
                {state.tab === 'cal' && <SheetCalendarTab state={state} />}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
