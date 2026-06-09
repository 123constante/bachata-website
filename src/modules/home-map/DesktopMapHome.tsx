// Festival Map desktop home -- Direction A: a dominant Leaflet map (left ~55%)
// beside a dense, tabbed discovery rail (right ~45%). Reuses the shared cards/
// primitives + the frozen useMapList state, so the map<->list linking is
// identical to the mobile surface. The list rail IS the single `listRef`
// scroller; the rail header (city + live count) + TabBar are sticky inside it.
// The default tab is All Events (lead with events); What's New is one tab away.

import { Suspense, lazy, useEffect, useRef } from 'react';
import { Plus, Minus, LocateFixed, MapPin } from 'lucide-react';
import type { UseMapListResult } from './useMapList';
import { groupByDate } from './mapListDerivations';
import {
  EventRow,
  TonightCard,
  NewsRow,
  EmptyState,
  ListSkeleton,
  RetryNotice,
} from './cards/cards';
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
import { NewsBrandCard } from './cards/NewsBrandCard';

const EventMap = lazy(() => import('./EventMap'));

const zoomBtn =
  'grid h-11 w-11 place-items-center bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary';

/** All-tab body: search + chips (scroll with the list) then date-grouped rows.
 *  Rows carry the freshness stamp so just-added events stand out on the default
 *  view. */
function AllBody({ state }: { state: UseMapListResult }) {
  const groups = groupByDate(state.listEvents);
  return (
    <div className="space-y-3">
      <SearchField value={state.q} onChange={state.setQ} />
      {groups.length === 0 ? (
        <EmptyState>No events match your search.</EmptyState>
      ) : (
        groups.map((g) => (
          <section key={g.key}>
            <header className="flex items-center gap-2 px-1 pb-1.5 pt-1">
              <span className="text-xs font-bold text-primary">{g.label}</span>
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-bold text-muted-foreground">{g.items.length}</span>
            </header>
            <div className="space-y-1">
              {g.items.map((e) => (
                <EventRow
                  key={e.occurrence_id}
                  event={e}
                  selected={state.selected === e.occurrence_id}
                  onSelect={state.fromCard}
                  onHover={state.setHovered}
                  showFreshness
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

/** Today-tab body: optional locate prompt then nearest-first distance cards. */
function TonightBody({ state }: { state: UseMapListResult }) {
  const events = state.listEvents;
  const showLocate = state.geo.status === 'idle' || state.geo.status === 'denied';
  return (
    <div className="space-y-3">
      {showLocate && (
        <button
          type="button"
          onClick={() => state.geo.request()}
          className={cnLocate}
        >
          <MapPin className="h-4 w-4" aria-hidden="true" />
          {state.geo.status === 'denied'
            ? 'Location blocked. Enable it to sort by distance'
            : 'Use my location for distances'}
        </button>
      )}
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

const cnLocate =
  'flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 py-2 text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

/** News-tab body: brand hero + recently added/updated events, freshest first. */
function NewsBody({ state }: { state: UseMapListResult }) {
  const events = state.listEvents;
  return (
    <div className="space-y-1">
      <NewsBrandCard state={state} />
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
          />
        </Suspense>
        {/* First-visit hint that the pins are interactive. Self-dismisses. */}
        <div className="pointer-events-none absolute left-3 top-3 z-[500]">
          <MapHint />
        </div>
        {/* Zoom + recenter, lifted clear of the bottom-right attribution badge. */}
        <div className="absolute bottom-7 right-3 z-50 flex flex-col overflow-hidden rounded-xl border border-border shadow-lg">
          <button type="button" onClick={() => apiRef.current?.zoom(1)} aria-label="Zoom in" className={zoomBtn}>
            <Plus className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => apiRef.current?.zoom(-1)}
            aria-label="Zoom out"
            className={`${zoomBtn} border-t border-border`}
          >
            <Minus className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => apiRef.current?.reset()}
            aria-label="Recenter map"
            className={`${zoomBtn} border-t border-border !text-primary`}
          >
            <LocateFixed className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* List rail (right) = the single listRef scroller. `relative` so card
          offsetTop is measured from here (the pin->list scroll contract). */}
      <div
        ref={state.listRef}
        className="relative min-h-0 min-w-0 flex-1 overflow-y-auto border-l border-border bg-background"
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
              {state.tab === 'cal' && <CalendarPanel state={state} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
