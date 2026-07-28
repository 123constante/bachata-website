// Festival Map home -- ONE shell for both viewports, and the only part of the
// homepage that server-renders.
//
// WHY IT IS ONE SHELL (WS13). This used to be two lazy components,
// MobileMapHome and DesktopMapHome, chosen by `useIsMobile()`. Both sat behind a
// client-only `mapMounted` gate, so the server rendered nothing but a dark box:
// the first paint of a 95%-mobile site was empty, and every visible pixel waited
// on the JS bundle. We cannot simply drop that gate, because `useIsMobile`'s
// getServerSnapshot returns `false` -- the server would commit to DESKTOP markup
// for everyone, and mobile clients would hydrate it and immediately re-render.
// That is precisely the React #421 hydration bail that emptied the homepage in
// production (see AppChrome.tsx). And we cannot sniff the User-Agent on the
// server either: the route is edge-cached (s-maxage=3600), so UA-varying HTML
// would split and poison the ISR cache.
//
// So the head, the dock and the feed -- everything the server renders -- contain
// NO JS viewport branch at all. They are one tree, laid out by CSS: a column on
// mobile, a map-beside-rail split at >=768px (.home-map-fill in index.css, plus
// Tailwind's md: prefixes here, which are the same media query).
//
// The Leaflet map card is the exception, and it is free precisely BECAUSE it
// never server-renders: Leaflet touches `window` at module load, so the card
// stays behind `mapMounted` (set in an effect, i.e. after hydration has
// committed -- never mid-hydration). Its chrome is wildly different per viewport
// (mobile: fullscreen + inline preview + coach hint; desktop: zoom stack +
// hover hint), and all of that lives in HomeMapCard, where a JS viewport branch
// is safe. See ./viewport.
//
// Layout: [page head][map card][dock: tabs + chips][feed]. The feed is the ONE
// scroller at every viewport now (the desktop rail used to scroll itself, which
// made the pin->list scroll measure offsetTop from a different element per
// breakpoint). `.home-map` scopes the cover-scene CSS; `.home-map-fill` supplies
// the shell height + the responsive layout.

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import type { UseMapListResult } from './useMapList';
import { CATEGORY_COLORS } from './mapTypes';
import { TabBar, CategoryChips, SearchField, RAIL_PANEL_ID, railTabId } from './cards/controls';
import {
  TonightCard,
  NewsRow,
  EmptyState,
  ListSkeleton,
  RetryNotice,
} from './cards/cards';
import { AllEventsList } from './cards/AllEventsList';
import { LocateControl } from './cards/LocateControl';
import { HomeExploreLinks } from '@/components/home/HomeExploreLinks';
import { MAP_PLACEHOLDERS } from './mapPlaceholders';

// Leaflet + every viewport-branched map control. Lazy AND mapMounted-gated, so
// the module is never even imported on the server.
const HomeMapCard = lazyWithRetry(() => import('./HomeMapCard'));

// Prewarm the SAME dynamic import at module scope so the chunk fetch races
// hydration instead of waiting for the mapMounted effect to fire first (which
// only runs after hydration commits). This does not mount anything early --
// mapMounted below is untouched -- it only starts the network fetch sooner.
// Guarded on `document` so the SSR pass never touches it.
if (typeof document !== 'undefined') {
  void import('./HomeMapCard').catch(() => {});
}

// The Calendar tab is never the first render (the tab always starts on 'all';
// the /calendar deep-link switches it in an effect), so it can stay lazy -- and
// it must: CalendarPanel statically imports DayDetailModal, which drags
// framer-motion + date-fns + the Radix dialog stack (~61 KB gzip) behind it.
// That tail alone would blow the home first-load budget (perf-budgets.json).
const CalendarPanel = lazyWithRetry(() =>
  import('./cards/CalendarPanel').then((m) => ({ default: m.CalendarPanel })),
);

// A layout effect on the client, a (never-run) effect on the server. The shell is
// server-rendered, and React warns loudly that useLayoutEffect cannot be encoded into the
// server output -- but we genuinely want the pre-paint timing on the client.
const useIsoLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

// Tagline keyword colours == the map category colours, so the head doubles as a
// pin/chip legend.
const KW = { class: CATEGORY_COLORS.class, party: CATEGORY_COLORS.party, fest: CATEGORY_COLORS.fest } as const;

/** All-tab body: the shared events list. The in-rail filter field is desktop-only
 *  by DESIGN (mobile filters through the header omnibox and the fullscreen map's
 *  own field) -- hidden in CSS, never branched in JS, so the server can render
 *  one tree. */
function AllBody({ state }: { state: UseMapListResult }) {
  return (
    <>
      {/* NOT wrapped in a space-y-* parent: the field is display:none on mobile but is
          still a sibling, so `> * + *` would leave a phantom gap above the feed. Its own
          md:mb-3 carries the spacing only where it is actually visible. */}
      <div className="hidden md:mb-3 md:block">
        <SearchField
          value={state.q}
          onChange={state.setQ}
          filter
          placeholder="Filter by name or venue"
          ariaLabel="Filter events"
          matchCount={state.q ? state.listEvents.length : null}
        />
      </div>
      <AllEventsList state={state} stickyHeaders showSearchEmpty />
    </>
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

/** News-tab body: recently added/updated events, freshest first. */
function NewsBody({ state }: { state: UseMapListResult }) {
  const events = state.listEvents;
  return (
    <div className="space-y-1">
      <div className="px-1 pb-2 pt-1">
        <div className="flex items-center gap-2 pb-1.5">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-foreground">Latest news</h3>
          <span className="rounded-full bg-primary px-[5px] py-[1.5px] text-[8px] font-black uppercase leading-none tracking-wide text-black">
            Live
          </span>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-primary/70 to-primary/0" />
      </div>
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

export default function HomeMapShell({
  state,
  cityName,
  citySlug,
  loading,
  error,
  onRetry,
}: {
  state: UseMapListResult;
  cityName: string;
  citySlug?: string | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  const sideRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // The map is client-only (Leaflet touches `window` at module load). An EFFECT
  // sets this -- effects run after React has finished hydrating, so the resulting
  // re-render can never land inside a still-hydrating Suspense boundary. Never
  // convert this to useSyncExternalStore / a render-time check.
  const [mapMounted, setMapMounted] = useState(false);
  useEffect(() => setMapMounted(true), []);

  // Fullscreen lives HERE, not in the card, because it drives the shell: the
  // `is-fullscreen` class turns the card into a fixed edge-to-edge overlay, and
  // the feed underneath must leave the tab order. `inert` is set in a layout
  // effect (pre-paint) so screen readers and touch can't reach the covered feed
  // for even one frame. It always starts false, so the server renders the
  // ordinary inset layout.
  // The FEED stays mounted in fullscreen (covered by the overlay) so leaving restores its
  // scroll position -- but it must leave the tab order and the a11y tree, or a screen
  // reader could walk out of the modal map into content the sighted user cannot see.
  // `inert` in a LAYOUT effect, so it lands before paint rather than a frame late.
  // (The page head needs no such thing: it is unmounted outright below.)
  //
  // useIsoLayoutEffect, not useLayoutEffect: this shell SERVER-RENDERS now, and React
  // warns that a layout effect "does nothing on the server". Degrading to useEffect there
  // costs nothing -- `fullscreen` is always false on the server, so the effect is a no-op
  // on that pass anyway.
  useIsoLayoutEffect(() => {
    if (sideRef.current) sideRef.current.inert = fullscreen;
  }, [fullscreen]);

  const placeholder = citySlug ? MAP_PLACEHOLDERS[citySlug] : undefined;

  return (
    <div
      className={cn(
        'home-map-fill home-map relative isolate w-full overflow-hidden',
        fullscreen && 'is-fullscreen',
        state.tab === 'cal' && 'is-cal',
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

      {/* The page's canonical <h1>. It used to be an sr-only heading in Index with the
          visible title hidden inside the (client-only) mobile surface -- so the server
          shipped a heading no human ever saw, and desktop had none at all. One visible
          heading now serves both.

          Unmounted in fullscreen (as the old mobile surface did): the expanded map is a
          modal dialog, and taking the head out of the document beats merely hiding it.
          `fullscreen` is client-only state that always starts false, so the server still
          renders this -- it is a STATE branch, not a viewport branch, and is SSR-safe. */}
      {!fullscreen && (
      <header className="hm-pagehead shrink-0 px-3 pb-1 pt-2 md:px-4 md:pb-2 md:pt-3">
        <h1 className="truncate text-base font-extrabold tracking-tight">
          What&rsquo;s on in {cityName}
          {/* The visible heading is the canonical h1, but "What's on in London" carries
              none of the term this page is trying to rank for. The old sr-only h1 (which
              this one replaced) held the keywords; keep them, inside the ONE heading,
              rather than reintroducing a duplicate h1. */}
          <span className="sr-only">
            {' '}&mdash; bachata classes, parties &amp; festivals
          </span>
        </h1>
        {/* The live counts, at EVERY viewport. The deleted desktop RailHeader showed
            "N this week" whenever the week had anything in it, independent of tonight;
            gating the whole line behind `tonight > 0` silently dropped that cue on
            precisely the quiet days it existed for. Only a genuinely empty week falls
            back to the tagline (whose coloured keywords double as the category legend). */}
        <p className="text-xs font-semibold text-muted-foreground">
          {state.stats.tonight > 0 || state.stats.thisWeek > 0 ? (
            <>
              {state.stats.tonight > 0 && (
                <>
                  <b className="text-primary">{state.stats.tonight}</b> on tonight
                  {state.stats.thisWeek > 0 && <> &middot; </>}
                </>
              )}
              {state.stats.thisWeek > 0 && <>{state.stats.thisWeek} this week</>}
            </>
          ) : (
            <>
              Every <b style={{ color: KW.class }}>class</b>,{' '}
              <b style={{ color: KW.party }}>party</b> &amp;{' '}
              <b style={{ color: KW.fest }}>festival</b> in one place.
            </>
          )}
        </p>
      </header>
      )}

      {/* Map card. Sizing/positioning are entirely CSS (.hm-mapcard, and
          .is-fullscreen for the overlay) so the box is the right size on the
          very first paint, before any JS runs -- that is what keeps the map
          swap free of layout shift (WS15). Until it mounts, a pre-rendered
          basemap still (below) or the plain dark box fills it. */}
      <div
        className="hm-mapcard relative overflow-hidden"
        role={fullscreen ? 'dialog' : 'region'}
        aria-modal={fullscreen || undefined}
        aria-label={fullscreen ? `Full screen map of what's on in ${cityName}` : 'Event map'}
      >
        {/* Unconditional placeholder layer: renders identically on the server and
            the client's first render (there is no JS branch gating it), so it adds
            no new hydration surface. It sits BENEATH the mapMounted slot below in
            DOM/paint order and is never removed once mounted -- Leaflet's own
            opaque tile layer simply paints over it, so there is no flash back to a
            flat dark box if the HomeMapCard chunk is still streaming in when
            mapMounted flips true. Only cities with a still in MAP_PLACEHOLDERS get
            one; everyone else keeps the plain dark box exactly as before. */}
        {placeholder && (
          <picture>
            <source media="(min-width: 768px)" srcSet={placeholder.desktop} />
            <img
              src={placeholder.mobile}
              alt=""
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </picture>
        )}
        {/* Static attribution while the still is showing -- EventMap's own live
            Leaflet attribution control takes over once mounted, so this must not
            linger and double up once real tiles are on screen. */}
        {placeholder && !mapMounted && (
          <div className="pointer-events-none absolute bottom-0 right-0 z-10 rounded-tl bg-background/70 px-1 text-[9px] leading-tight text-muted-foreground">
            &copy;{' '}
            <a href="https://www.openstreetmap.org/copyright" className="pointer-events-auto underline">
              OpenStreetMap
            </a>{' '}
            &copy;{' '}
            <a href="https://carto.com/attributions" className="pointer-events-auto underline">
              CARTO
            </a>
          </div>
        )}
        {mapMounted ? (
          <Suspense fallback={<div className="absolute inset-0" style={{ background: '#11121a' }} />}>
            <HomeMapCard
              state={state}
              loading={loading}
              error={error}
              fullscreen={fullscreen}
              setFullscreen={setFullscreen}
            />
          </Suspense>
        ) : (
          !placeholder && <div className="absolute inset-0" style={{ background: '#11121a' }} />
        )}
      </div>

      {/* Feed stays mounted in fullscreen (covered by the fixed map overlay) so
          leaving fullscreen restores the list scroll. */}
      <div ref={sideRef} className="hm-side flex min-h-0 flex-1 flex-col">
        <div className="hm-dock shrink-0 px-3 pt-3 md:px-4">
          <TabBar tab={state.tab} setTab={state.setTab} />
          <CategoryChips filter={state.filter} setFilter={state.setFilter} className="mt-2 pb-0.5" />
        </div>

        <div
          ref={state.listRef}
          id={RAIL_PANEL_ID}
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={railTabId(state.tab)}
          // An INSET focus ring: the shell is overflow:hidden, so the shared focusRing's
          // offset ring would be clipped and this -- the skip link's destination -- would
          // have no visible focus indicator at all.
          className="hm-feed relative min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:px-4 md:pb-8"
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
              {state.tab === 'all' && <AllBody state={state} />}
              {state.tab === 'tonight' && <TonightBody state={state} />}
              {state.tab === 'news' && <NewsBody state={state} />}
              {state.tab === 'cal' && (
                <Suspense fallback={<ListSkeleton />}>
                  <CalendarPanel state={state} />
                </Suspense>
              )}
            </>
          )}
          {!loading && !error && <HomeExploreLinks />}
        </div>
      </div>
    </div>
  );
}
