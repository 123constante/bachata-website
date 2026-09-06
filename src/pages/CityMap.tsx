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
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Minus, Plus, Maximize } from 'lucide-react';

import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo, buildSeoForRoute } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { flags } from '@/lib/featureFlags';
import { cityDisplayFromSlug } from '@/lib/cityDisplayName';
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
import {
  dateLabel,
  regularNights,
  type VenueNight,
} from '@/modules/home-map/venueNights';

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
  const [params, setParams] = useSearchParams();

  // cityDisplay is passed, not left to the SEO layer's CITY_DEFAULT. Without it
  // the title and description hardcoded "London" under a canonical carrying the
  // real slug -- latent while London is the only active city, and wrong the day
  // it is not. The derivation is shared with Index rather than copied.
  useSeo(
    buildSeoForRoute('city.map', {
      cityDisplay: cityDisplayFromSlug(citySlug),
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

  const selectVenue = useCallback(
    (rep: string | null) => {
      // RE-SELECTING THE OPEN VENUE CLOSES IT. This used to return early, which
      // made the heading's aria-expanded a promise the page could not keep: a
      // second tap and Enter were both no-ops (measured), so keyboard and
      // screen-reader users had no way to collapse at all -- closing by tapping
      // bare map is pointer-only. Folding the re-select into the null branch
      // keeps what the early return was actually protecting: closing REPLACES
      // rather than pushes, so a toggle still cannot stack a second history
      // entry that back would have to pop twice.
      const next = rep === selected ? null : rep;
      // Nothing open and nothing asked for: no navigation at all, rather than a
      // replace that rewrites the URL to itself on every stray call.
      if (next == null && selected == null) return;

      // CLOSING REPLACES; it does not pop. An earlier draft called
      // navigate(-1) to leave no residue, and that discarded the WHOLE query
      // string with it -- so a filter set while the panel was open vanished
      // when the panel did (measured: tap a pin, tap Parties, close, and
      // ?type=parties was gone). Replacing keeps every other parameter, and
      // back still means "the state before I opened this", which is what back
      // should mean anyway.
      if (next == null) {
        patch({ venue: null }, false);
        return;
      }

      // Opening from nothing PUSHES one entry, which is what makes the
      // hardware back button close the panel instead of leaving the page.
      // Moving pin-to-pin replaces, so back is never a walk backwards through
      // every pin the visitor tried.
      patch({ venue: next }, selected == null);
    },
    [patch, selected],
  );

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
    // AMBIGUOUS NAMES ARE INDEXED TO NOTHING.
    //
    // Two venues sharing a name is not something a name-join can resolve, and
    // guessing one produces a confidently WRONG link -- worse than the missing
    // link this whole approach was chosen on the promise of degrading to.
    // Counting first and indexing only the unambiguous also covers the reason
    // a city filter was considered here: the directory is global (44 London,
    // plus Gammarth and Budapest today), so a London venue sharing a name with
    // a foreign one is exactly the ambiguous case and already loses its link.
    // That makes deriving a display name from the slug -- a second copy of
    // logic that lives in pages/Index.tsx and is not exported -- unnecessary.
    //
    // Measured on the live directory: 46 venues, ZERO duplicate names. This
    // changes nothing visible today and closes the hole before it opens.
    const seen = new Map<string, string[]>();
    for (const v of publicVenues ?? []) {
      if (!v.name) continue;
      // Case- and whitespace-insensitive, because that is the class of
      // difference a human typing the same venue into two systems produces.
      // Anything beyond that is a different venue until proven otherwise.
      const key = v.name.trim().toLowerCase();
      const href = `/venue-entity/${v.slug ?? v.id}`;
      const prev = seen.get(key);
      if (prev) prev.push(href);
      else seen.set(key, [href]);
    }
    for (const [key, hrefs] of seen) if (hrefs.length === 1) m.set(key, hrefs[0]);
    return m;
  }, [publicVenues]);

  const venueHref = useCallback(
    (name: string | null) =>
      (name && venueHrefByName.get(name.trim().toLowerCase())) || null,
    [venueHrefByName],
  );

  // ---- the selected venue's nights ----------------------------------------
  // Derived from the RAW rows, never from model.pins: dedupePins has already
  // collapsed every event to one soonest day by the time it makes a pin, so a
  // pattern derived from pins would call every night in the city a one-off.
  const selectedRow = useMemo(
    () => model.rows.find((r) => r.repOccId === selected) ?? null,
    [model.rows, selected],
  );
  const selectedNights = useMemo<VenueNight[]>(
    () =>
      selectedRow
        ? regularNights(events, {
            eventIds: selectedRow.eventIds,
            coordKey: selectedRow.coordKey,
            today: todayKey,
          })
        : [],
    [selectedRow, events, todayKey],
  );

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
                nights={r.repOccId === selected ? selectedNights : null}
                venueHref={r.repOccId === selected ? venueHref(r.venueName) : null}
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
 *  Collapsed it is a BUTTON that selects the matching pin -- not a link, because
 *  it acts on this page rather than navigating, and making it a link would take
 *  the pin-selection meaning away from keyboard users.
 *
 *  SELECTED, it spans the grid and expands in place to show that venue's
 *  regular nights. This is where the Leaflet popup used to be. Everything the
 *  popup needed and got wrong -- escaping, touch handling that fought its own
 *  scrolling, a lifecycle nothing owned, an iOS pointer-events workaround no
 *  local browser can verify -- is absent here because these are real React
 *  nodes: React escapes text, the browser handles the taps, and unmounting is
 *  what closing means.
 *
 *  Nothing interactive nests inside anything interactive: the heading button
 *  and the night links are SIBLINGS. That is the shape the reverted attribution
 *  chip got wrong. */
function VenueCard({
  row,
  selected,
  nights,
  venueHref,
  onSelect,
}: {
  row: VenueRow;
  selected: boolean;
  /** The venue's regular nights, only when selected. */
  nights: VenueNight[] | null;
  /** /venue-entity href, or null when the flag is off or the name is not
   *  unambiguously in the public directory. */
  venueHref: string | null;
  onSelect: (rep: string) => void;
}) {
  return (
    <li data-venue={row.repOccId} className={cn(selected && 'col-span-full')}>
      <div
        className={cn(
          'h-full rounded-xl border transition-colors',
          selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40',
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(row.repOccId)}
          aria-expanded={selected}
          className={cn(
            'flex w-full flex-col items-start gap-1 p-3 text-left',
            focusRing,
          )}
        >
          <span className="line-clamp-2 text-sm font-bold leading-tight">
            {row.venueName ?? 'Unnamed venue'}
          </span>
          {row.area && (
            <span className="truncate text-[11px] text-muted-foreground">{row.area}</span>
          )}
          <span className="text-[11px] text-muted-foreground">
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

        {selected && nights && (
          <div className="border-t border-primary/25 px-3 pb-3 pt-2">
            {nights.length === 0 ? (
              // NEVER an empty expansion. A venue that opens onto nothing is
              // indistinguishable from a broken one -- this arc's founding
              // defect one layer up.
              //
              // THE REACHABLE CASE IS NOT A FILTER, whatever this comment used
              // to claim. It said "whenever a filter hides every night at a
              // venue whose pin is still drawn", which was never the mechanism:
              // eventIds ignored the filter entirely. Now that eventIds carries
              // exactly the members the card counted, a counted card cannot
              // expand to zero on filtering at all. What DOES reach here is a
              // member with no instance_date -- buildCityMapModel counts it,
              // regularNights skips it -- so the copy names dates, not filters.
              <p className="text-[11px] text-muted-foreground">
                No dates listed for this venue yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {nights.map((n) => (
                  <li key={n.eventId}>
                    <Link
                      to={`/event/${n.eventId}?occurrenceId=${n.nextOccId}`}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-primary/10',
                        focusRing,
                      )}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[13px] font-bold leading-tight">
                          {n.name}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {n.pattern}
                          {n.nextDate ? ` · next ${dateLabel(n.nextDate, !n.isWeekly)}` : ''}
                          {n.time ? ` · ${n.time}` : ''}
                        </span>
                      </span>
                      <span
                        className="ml-auto shrink-0 rounded-full border px-2 py-[1px] text-[10px] font-bold"
                        style={{
                          color: CATEGORY_COLORS[n.category],
                          borderColor: CATEGORY_COLORS[n.category],
                        }}
                      >
                        {CATEGORY_LABEL[n.category]}
                      </span>
                      {n.isCancelled && (
                        <span className="shrink-0 text-[10px] font-bold text-[#E2415C]">
                          Cancelled
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {venueHref && (
              <Link
                to={venueHref}
                className={cn(
                  'mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-primary hover:bg-primary/10',
                  focusRing,
                )}
              >
                View venue
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
