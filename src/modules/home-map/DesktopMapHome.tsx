// Festival Map desktop home -- Direction A: a dominant Leaflet map (left ~55%)
// beside a dense, tabbed discovery rail (right ~45%). Reuses the shared cards/
// primitives + the frozen useMapList state, so the map<->list linking is
// identical to the mobile surface. The list rail IS the single `listRef`
// scroller; the rail header (city + live count) + TabBar are sticky inside it.
// The default tab is All Events (lead with events); What's New is one tab away.

import { Suspense, useEffect, useRef } from 'react';
import { Plus, Minus, Focus } from 'lucide-react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import type { UseMapListResult } from './useMapList';
import {
  TonightCard,
  NewsRow,
  EmptyState,
  ListSkeleton,
  RetryNotice,
} from './cards/cards';
import { AllEventsList } from './cards/AllEventsList';
import { LocateControl, MapLocateButton } from './cards/LocateControl';
import {
  TabBar,
  SearchField,
  CategoryFilterBar,
  RailHeader,
  RAIL_PANEL_ID,
  railTabId,
} from './cards/controls';
import { MapHint } from './MapHint';
import { CalendarPanel } from './cards/CalendarPanel';
import { HomeExploreLinks } from '@/components/home/HomeExploreLinks';

const EventMap = lazyWithRetry(() => import('./EventMap'));

const zoomBtn =
  'grid h-11 w-11 place-items-center bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary';

/** All-tab body: search field then the shared AllEventsList (today's local
 *  group highlighted, festivals abroad collapsed into a "further afield"
 *  section). */
function AllBody({ state }: { state: UseMapListResult }) {
  return (
    <div className="space-y-3">
      <SearchField value={state.q} onChange={state.setQ} filter placeholder="Filter by name or venue" ariaLabel="Filter events" matchCount={state.q ? state.listEvents.length : null} />
      <AllEventsList state={state} showSearchEmpty />
    </div>
  );
}

/** Today-tab body: optional locate prompt then nearest-first distance cards. */
function TonightBody({ state }: { state: UseMapListResult }) {
  const events = state.listEvents;
  return (
    <div className="space-y-3">
      <LocateControl geo={state.geo} />
      {events.length === 0 ? (
        <EmptyState>Nothing listed for today yet.</EmptyState>
      ) : (
        events.map((e) => (
          <TonightCard
            key={e.occurrence_id}
            event={e}
            user={state.geo.coords}
            selected={state.selected === e.occurrence_id}
            onSelect={state.fromCard}
            onHover={state.setHovered}
          />
        ))
      )}
    </div>
  );
}

/** News-tab body: brand hero + recently added/updated events, freshest first. */
function NewsBody({ state }: { state: UseMapListResult }) {
  const events = state.listEvents;
  return (
    <div className="space-y-1">
      <h3 className="px-1 pb-1 pt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Latest news</h3>
      {events.length === 0 ? (
        <EmptyState>No recent additions or updates.</EmptyState>
      ) : (
        events.map((e) => (
          <NewsRow
            key={e.occurrence_id}
            event={e}
            selected={state.selected === e.occurrence_id}
            onSelect={state.fromCard}
            onHover={state.setHovered}
          />
        ))
      )}
    </div>
  );
}

export default function DesktopMapHome({
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
  const mapPaneRef = useRef<HTMLDivElement>(null);
  const { apiRef } = state;

  // Keep Leaflet sized to its pane. The split is a fixed %, so the map cell only
  // changes size on window/container resize -- a ResizeObserver re-measures then.
  useEffect(() => {
    const el = mapPaneRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => apiRef.current?.invalidate());
    ro.observe(el);
    return () => ro.disconnect();
  }, [apiRef]);

  return (
    <div className="home-map flex w-full overflow-hidden" style={{ height: 'calc(100svh - 60px)' }}>
      {/* Map pane (left, dominant). `isolate` traps Leaflet's z-index panes so
          the zoom controls -- same stacking context -- stay clickable above them. */}
      <div ref={mapPaneRef} className="relative isolate w-[55%] shrink-0 overflow-hidden">
        <Suspense fallback={<div className="absolute inset-0" style={{ background: '#11121a' }} />}>
          <EventMap
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
        </Suspense>
        {/* First-visit hint that the pins are interactive. Self-dismisses. */}
        <div className="pointer-events-none absolute left-3 top-3 z-[500]">
          <MapHint />
        </div>
        {/* Map controls (top-right): zoom, compass, reframe. */}
        <div className="absolute right-3 top-3 z-50 flex flex-row gap-1.5">
          <button type="button" onClick={() => apiRef.current?.zoom(1)} aria-label="Zoom in" className={zoomBtn}>
            <Plus className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => apiRef.current?.zoom(-1)}
            aria-label="Zoom out"
            className={zoomBtn}
          >
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
      </div>

      {/* List rail (right) = the single listRef scroller. `relative` so card
          offsetTop is measured from here (the pin->list scroll contract). */}
      <div
        ref={state.listRef}
        tabIndex={0}
        className="relative min-h-0 min-w-0 flex-1 overflow-y-auto border-l border-border bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <div className="sticky top-0 z-10 space-y-2 bg-background px-4 py-3">
          <RailHeader cityName={cityName} count={state.stats.thisWeek} />
          <TabBar tab={state.tab} setTab={state.setTab} />
        </div>

        <div
          id={RAIL_PANEL_ID}
          role="tabpanel"
          aria-labelledby={railTabId(state.tab)}
          className="px-4 pb-8 pt-3"
        >
          {loading ? (
            <ListSkeleton />
          ) : error ? (
            <RetryNotice onRetry={onRetry} />
          ) : (
            <>
              <CategoryFilterBar filter={state.filter} setFilter={state.setFilter} className="mb-3" />
              {state.tab === 'news' && <NewsBody state={state} />}
              {state.tab === 'all' && <AllBody state={state} />}
              {state.tab === 'tonight' && <TonightBody state={state} />}
              {state.tab === 'cal' && <CalendarPanel state={state} seedDefault />}
            </>
          )}
          {!loading && !error && <HomeExploreLinks />}
        </div>
      </div>
    </div>
  );
}
