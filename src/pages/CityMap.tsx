// /city/:slug/map -- the full map. Commit 2 of the teaser arc.
//
// The homepage card is a teaser by decision: pan only, no controls, any tap
// comes here. Everything that let someone half-use a map inside a 148px card
// lives on this page, where there is room for it -- zoom, locate, search, type
// filters, a per-venue panel on pin tap, and a list under the map that stays in
// step with the pins both ways.
//
// STATE LIVES IN THE URL, and that is load-bearing rather than tidy. Selecting
// a venue PUSHES a history entry, so the hardware back button closes the panel
// before it leaves the page -- the one thing a map page with a panel usually
// gets wrong, because a boolean in useState gives back nothing to pop. The same
// entry makes a selected venue shareable and reload-safe for free.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Minus, Plus, Maximize } from 'lucide-react';

import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo, buildSeoForRoute } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { flags } from '@/lib/featureFlags';
import { useCity } from '@/contexts/CityContext';
import { useLondonToday } from '@/hooks/useLondonToday';
import { addDaysToKey } from '@/lib/londonDate';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useMapEvents } from '@/hooks/useMapEvents';
import { fetchPublicVenuesList } from '@/services/venuePublicService';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

import type { MapApi } from '@/modules/home-map/EventMap';
import type { LocationGroup } from '@/modules/home-map/mapListDerivations';
import {
  buildCityMapModel,
  TYPE_FILTERS,
  isMapTypeFilter,
  type MapTypeFilter,
  type VenueRow,
} from '@/modules/home-map/cityMapModel';
import { regularNights } from '@/modules/home-map/venueNights';
import { venuePanelHtml, dateLabel } from '@/modules/home-map/venuePanelHtml';
import { CATEGORY_COLORS, CATEGORY_LABEL } from '@/modules/home-map/mapTypes';
import { SearchField, focusRing } from '@/modules/home-map/cards/controls';
import { MapLocateButton } from '@/modules/home-map/cards/LocateControl';
import '@/modules/home-map/cityMap.css';

// Leaflet touches `window` at module load and this route renders through the
// catchall, which server-renders. Lazy + mount-gated, exactly as HomeMapShell
// does it, so the renderer is never imported on the server.
const EventMap = lazyWithRetry(() => import('@/modules/home-map/EventMap'));

/** How far ahead the map reads. Kept in lockstep with the homepage's own
 *  derivation (pages/Index.tsx) ON PURPOSE: an identical React Query key means
 *  arriving from the teaser reuses rows already in the cache instead of
 *  refetching 90 days of occurrences the visitor just downloaded. */
const HORIZON_DAYS = 90;

export default function CityMap() {
  const { slug } = useParams<{ slug: string }>();
  const { citySlug: contextSlug } = useCity();
  // The path is the authority; the context is the fallback for a direct hit
  // before it has re-anchored.
  const citySlug = slug ?? contextSlug ?? null;
  const todayKey = useLondonToday();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  useSeo(
    buildSeoForRoute('city.map', {
      canonicalPath: citySlug ? `/city/${citySlug}/map` : undefined,
    }),
  );

  // ---- URL state ----------------------------------------------------------
  const rawType = params.get('type');
  const type: MapTypeFilter = isMapTypeFilter(rawType) ? rawType : 'all';
  const q = params.get('q') ?? '';
  const from = params.get('from') === 'tonight' ? ('tonight' as const) : null;
  const selected = params.get('venue');

  /** Filters REPLACE and selection PUSHES. A filter tap is a refinement of the
   *  view you are on -- stacking one history entry per keystroke would make
   *  back a way to un-type. A selection is a place you went, and the entry it
   *  pushes is what back pops to close the panel. */
  /* The FUNCTIONAL updater is load-bearing, not a style choice. Reading
   * `params` from the render closure snapshots the query string, and the
   * debounced search below writes on a timer -- so a timer armed before "Clear
   * filters" fired would land afterwards carrying the pre-clear snapshot and
   * put the filter straight back. Measured: clearing from the zero state left
   * ?type=courses behind, ~250ms after the URL had already gone empty.
   * Reading `prev` at write time cannot go stale, and it makes `patch` itself
   * a stable identity. */
  const patch = useCallback(
    (next: Record<string, string | null>, push: boolean) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(next)) {
            if (v == null || v === '') p.delete(k);
            else p.set(k, v);
          }
          return p;
        },
        { replace: !push },
      );
    },
    [setParams],
  );

  /** Did WE push the entry that is currently on top? Only then may closing the
   *  panel pop it. A visitor who landed directly on a ?venue= link has no entry
   *  of ours underneath, and navigate(-1) there would walk them off the site. */
  const pushedRef = useRef(false);

  const selectVenue = useCallback(
    (rep: string | null) => {
      // Re-selecting the open venue is not a new place, so it must not stack a
      // second entry that back would then have to pop twice.
      if (rep === selected) return;

      if (rep == null) {
        // CLOSING. Pop our own entry when we own one, so the panel session
        // leaves no residue: without this, select-then-close leaves an entry
        // whose only effect is a back press that appears to do nothing.
        if (pushedRef.current) {
          pushedRef.current = false;
          navigate(-1);
          return;
        }
        patch({ venue: null }, false);
        return;
      }

      // Opening from nothing pushes ONE entry for the whole panel session;
      // moving pin-to-pin inside that session replaces, so back is never a way
      // to walk backwards through every pin the visitor tried.
      if (selected == null && !pushedRef.current) {
        pushedRef.current = true;
        patch({ venue: rep }, true);
        return;
      }
      patch({ venue: rep }, false);
    },
    [patch, selected, navigate],
  );

  // A back/forward that changes the venue param out from under us must not
  // leave pushedRef claiming an entry we no longer sit on.
  useEffect(() => {
    if (selected == null) pushedRef.current = false;
  }, [selected]);

  // ---- data ---------------------------------------------------------------
  const rangeStart = todayKey;
  const rangeEnd = useMemo(() => addDaysToKey(todayKey, HORIZON_DAYS), [todayKey]);
  const {
    data: rows,
    isLoading,
    isError,
    refetch,
  } = useMapEvents({ citySlug, rangeStart, rangeEnd, enabled: Boolean(citySlug) });
  const events = useMemo(() => rows ?? [], [rows]);

  const model = useMemo(
    () => buildCityMapModel(events, { citySlug, type, q, from, today: todayKey }),
    [events, citySlug, type, q, from, todayKey],
  );

  // THE VENUE LINK, and why it is a second query. get_map_events_v1 returns no
  // venue_id and no venue slug -- venue identity in the map layer is
  // (coordinate, venue_name) and nothing else. get_public_venues_list_v3 has
  // the ids, so the heading row's destination is resolved by matching the one
  // field both sides carry: the name. A venue that does not match simply gets
  // no link and the panel degrades to nights-only, which is the same shape the
  // flag-off path produces -- so no dead link can ship down either road.
  // Gated on the flag so the query is not even issued when the destination is
  // a ComingSoonGate, and keyed identically to /venues so the two share a cache.
  const { data: publicVenues } = useQuery({
    queryKey: ['venues-directory'],
    queryFn: fetchPublicVenuesList,
    staleTime: 5 * 60 * 1000,
    enabled: flags.venueDetail,
  });

  const venueHrefByName = useMemo(() => {
    const m = new Map<string, string>();
    if (!flags.venueDetail) return m;
    for (const v of publicVenues ?? []) {
      if (!v.name) continue;
      // Case- and whitespace-insensitive, because that is the class of
      // difference a human typing the same venue into two systems produces.
      // Anything beyond that is a different venue until proven otherwise.
      m.set(v.name.trim().toLowerCase(), `/venue-entity/${v.slug ?? v.id}`);
    }
    return m;
  }, [publicVenues]);

  const venueHref = useCallback(
    (name: string | null) =>
      (name && venueHrefByName.get(name.trim().toLowerCase())) || null,
    [venueHrefByName],
  );

  // ---- the panel ----------------------------------------------------------
  // Built from the RAW rows, never from model.pins: dedupePins has already
  // collapsed every event to one soonest day by the time it makes a pin, so a
  // pattern derived from pins would call every night in the city a one-off.
  const buildPanel = useCallback(
    (g: LocationGroup) =>
      venuePanelHtml({
        venueName: g.venueName,
        area: g.area,
        venueHref: venueHref(g.venueName),
        nights: regularNights(events, {
          eventIds: new Set(g.members.map((e) => e.event_id)),
          coordKey: `${g.lat.toFixed(4)},${g.lng.toFixed(4)}`,
          today: todayKey,
        }),
      }),
    [events, todayKey, venueHref],
  );

  const openHref = useCallback((href: string) => navigate(href), [navigate]);

  // ---- map controls -------------------------------------------------------
  const apiRef = useRef<MapApi | null>(null);
  const onMapReady = useCallback((api: MapApi | null) => {
    apiRef.current = api;
  }, []);
  const geo = useGeolocation();
  useEffect(() => {
    if (geo.status === 'granted' && geo.coords) apiRef.current?.panToUser(geo.coords);
  }, [geo.status, geo.coords]);

  // Leaflet is lazy AND mount-gated: this route server-renders through the
  // catchall, and the renderer touches `window` at module load.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ---- list <-> pin sync --------------------------------------------------
  const listRef = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    if (!selected || !listRef.current) return;
    const row = listRef.current.querySelector(`[data-venue="${CSS.escape(selected)}"]`);
    // 'nearest' rather than 'center': the list sits under the map, and centring
    // a row scrolls the map itself off the screen on a phone.
    row?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [selected]);

  // ---- search, debounced into the URL -------------------------------------
  // The field is local so typing stays responsive; the URL catches up 250ms
  // later. Without the debounce every keystroke would be a router navigation,
  // and the whole model would rebuild on each one.
  const [draft, setDraft] = useState(q);
  const qRef = useRef(q);
  qRef.current = q;
  useEffect(() => {
    if (draft === qRef.current) return;
    const t = setTimeout(() => patch({ q: draft }, false), 250);
    return () => clearTimeout(t);
    // `patch` is a stable identity (it reads the query string through the
    // functional updater rather than closing over it), so it can be a real
    // dependency here instead of a suppression.
  }, [draft, patch]);
  // A q that changed from somewhere else (back/forward, chip clear) wins.
  useEffect(() => {
    setDraft((d) => (d === q ? d : q));
  }, [q]);

  const filtered = type !== 'all' || from != null || q !== '';
  const clearAll = useCallback(() => {
    setDraft('');
    patch({ type: null, q: null, from: null }, false);
  }, [patch]);

  const breadcrumbs = buildBreadcrumbs('city.map');

  return (
    <GlobalLayout breadcrumbs={breadcrumbs} showGradientBg={false}>
      <div className="mx-auto w-full max-w-[1100px] px-3 pb-8">
        <h1 className="pt-2 text-lg font-extrabold tracking-tight">
          The map
        </h1>
        <p className="mb-3 text-xs text-muted-foreground">
          Every bachata venue with something on. Tap a pin for its regular nights.
        </p>

        {/* THE MAP. z-index:0 makes this a stacking context so Leaflet's own
            control corners -- which are z-index:1000 against a container of
            `auto` -- stay inside it instead of painting over the page below. */}
        <div className="cmap-shell relative overflow-hidden rounded-2xl border border-border">
          {mounted && citySlug ? (
            <Suspense fallback={<div className="cmap-skeleton" aria-hidden="true" />}>
              <EventMap
                events={model.pins}
                visible={model.visible}
                glow={[]}
                selected={selected}
                hovered={null}
                onSelect={() => {}}
                onHover={() => {}}
                onReady={onMapReady}
                popupMode="venue"
                venuePanelHtml={buildPanel}
                onPanelNavigate={openHref}
                onVenueSelect={selectVenue}
                userCoords={geo.status === 'granted' ? geo.coords : null}
                minZoom={9}
              />
            </Suspense>
          ) : (
            <div className="cmap-skeleton" aria-hidden="true" />
          )}

          {/* Control stack. Real buttons with real labels -- a map control is
              the one place a div-with-a-handler is most tempting and least
              excusable, because it is the only way to zoom without a pinch. */}
          <div className="cmap-controls">
            <button
              type="button"
              aria-label="Zoom in"
              className={cn('cmap-ctrl', focusRing)}
              onClick={() => apiRef.current?.zoom(1)}
            >
              <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              className={cn('cmap-ctrl', focusRing)}
              onClick={() => apiRef.current?.zoom(-1)}
            >
              <Minus className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <MapLocateButton geo={geo} baseClassName={cn('cmap-ctrl', focusRing)} />
            <button
              type="button"
              aria-label="Fit the map to every pin"
              className={cn('cmap-ctrl', focusRing)}
              onClick={() => apiRef.current?.reset()}
            >
              <Maximize className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ---- filters ---- */}
        <div className="mt-3 space-y-2">
          <SearchField
            value={draft}
            onChange={setDraft}
            filter
            placeholder="Search venues and nights..."
            ariaLabel="Search venues and nights"
            matchCount={draft ? model.shownVenues : null}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {TYPE_FILTERS.map((t) => {
              const on = type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => patch({ type: on ? null : t.id }, false)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-bold transition-colors',
                    focusRing,
                    on
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                </button>
              );
            })}
            {/* The inherited-tab chip. It is removable because arriving here
                with a filter you did not set, and no way to see or drop it, is
                indistinguishable from a map that is simply missing venues. */}
            {from === 'tonight' && (
              <button
                type="button"
                onClick={() => patch({ from: null }, false)}
                aria-label="Clear the Tonight filter"
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10',
                  'px-2.5 py-1 text-xs font-bold text-primary',
                  focusRing,
                )}
              >
                Tonight
                <span aria-hidden="true">&times;</span>
              </button>
            )}
          </div>
        </div>

        {/* ---- count + list ---- */}
        <div className="mt-3 flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground" aria-live="polite">
            {isLoading
              ? 'Loading venues...'
              : `${model.shownVenues} of ${model.totalVenues} venues`}
          </p>
          {filtered && (
            <button
              type="button"
              onClick={clearAll}
              className={cn('rounded text-xs font-bold text-primary', focusRing)}
            >
              Clear filters
            </button>
          )}
        </div>

        {isError ? (
          <div className="mt-3 rounded-xl border border-border p-3 text-sm">
            <p className="font-semibold">The map could not load.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className={cn('mt-1.5 text-xs font-bold text-primary', focusRing)}
            >
              Try again
            </button>
          </div>
        ) : !isLoading && model.shownVenues === 0 ? (
          // The zero state gets a REASON and a way out. An empty map with no
          // message is indistinguishable from a broken one -- which is this
          // arc's founding defect one layer up, so it is the one state on this
          // page that must never ship bare.
          <div className="mt-3 rounded-xl border border-border p-3 text-sm">
            <p className="font-semibold">
              {model.totalVenues === 0
                ? 'No venues on the map yet.'
                : 'Nothing matches those filters.'}
            </p>
            {filtered && (
              <button
                type="button"
                onClick={clearAll}
                className={cn('mt-1.5 text-xs font-bold text-primary', focusRing)}
              >
                Show all {model.totalVenues} venues
              </button>
            )}
          </div>
        ) : (
          <ul
            ref={listRef}
            className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          >
            {model.rows.map((r) => (
              <VenueCard
                key={r.repOccId}
                row={r}
                selected={r.repOccId === selected}
                onSelect={selectVenue}
              />
            ))}
          </ul>
        )}
      </div>
    </GlobalLayout>
  );
}

/** One venue in the list under the map.
 *
 *  A BUTTON, not a link: it selects a pin on this page rather than navigating,
 *  and the destinations (the venue, each night) live inside the panel it opens.
 *  Making it a link to somewhere would give the row two meanings and take the
 *  pin-selection one away from keyboard users. */
function VenueCard({
  row,
  selected,
  onSelect,
}: {
  row: VenueRow;
  selected: boolean;
  onSelect: (rep: string) => void;
}) {
  return (
    <li data-venue={row.repOccId}>
      <button
        type="button"
        onClick={() => onSelect(row.repOccId)}
        aria-pressed={selected}
        className={cn(
          'flex h-full w-full flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors',
          focusRing,
          selected
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/40',
        )}
      >
        <span className="line-clamp-2 text-sm font-bold leading-tight">
          {row.venueName ?? 'Unnamed venue'}
        </span>
        {row.area && (
          <span className="truncate text-[11px] text-muted-foreground">{row.area}</span>
        )}
        <span className="mt-auto text-[11px] text-muted-foreground">
          {row.visibleCount} {row.visibleCount === 1 ? 'night' : 'nights'}{' '}
          {row.nextDate ? <>&middot; {dateLabel(row.nextDate, false)}</> : null}
        </span>
        <span className="flex items-center gap-1" aria-hidden="true">
          {row.categories.map((c) => (
            <i
              key={c}
              title={CATEGORY_LABEL[c]}
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: CATEGORY_COLORS[c] }}
            />
          ))}
        </span>
      </button>
    </li>
  );
}
