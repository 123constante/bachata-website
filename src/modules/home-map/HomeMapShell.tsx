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
// Layout: [page head][map card][dock: tabs][feed]. The feed is the ONE
// scroller at every viewport now (the desktop rail used to scroll itself, which
// made the pin->list scroll measure offsetTop from a different element per
// breakpoint). `.home-map` scopes the cover-scene CSS; `.home-map-fill` supplies
// the shell height + the responsive layout.

import { Suspense, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import type { UseMapListResult } from './useMapList';
import { CATEGORY_COLORS } from './mapTypes';
import { TabBar, SearchField, RAIL_PANEL_ID, railTabId } from './cards/controls';
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
// The tile provider's required credit, for the pre-mount still. Safe to import
// into this EAGER, server-rendered shell: basemapTiles.ts has no imports of its
// own and pulls in nothing -- which is the whole reason it was split out of
// EventMap.tsx (that module pulls in Leaflet and three stylesheets).
// NOT "no side effects", which an earlier draft of this line claimed: TILE_HOSTS
// runs Array.from(new Set(...new URL(...))) at MODULE EVALUATION, and that now
// happens during SSR rather than only inside the lazy Leaflet chunk. It is
// harmless -- two string parses -- but this comment is the standing licence for
// what may be added to that module later, so it has to say what is actually
// true. Anything with a real cost or a browser dependency does not belong there.
import { ATTR } from './basemapTiles';

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

// On /city/:slug/calendar the Calendar tab now IS the first render (the tab is
// seeded from the pathname -- see UseMapListOptions.initialTab; it used to be
// corrected in an effect, which cost a 0.417 CLS). So that route's first paint
// is this Suspense fallback while the chunk loads. Kept lazy regardless, and it
// must be: CalendarPanel statically imports DayDetailModal, which drags
// framer-motion + date-fns + the Radix dialog stack (~61 KB gzip) behind it.
// That tail alone would blow the home first-load budget (perf-budgets.json).
const CalendarPanel = lazyWithRetry(() =>
  import('./cards/CalendarPanel').then((m) => ({ default: m.CalendarPanel })),
);

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
            today={state.today}
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

  // The map is client-only (Leaflet touches `window` at module load). An EFFECT
  // sets this -- effects run after React has finished hydrating, so the resulting
  // re-render can never land inside a still-hydrating Suspense boundary. Never
  // convert this to useSyncExternalStore / a render-time check.
  const [mapMounted, setMapMounted] = useState(false);
  useEffect(() => setMapMounted(true), []);

  // FULLSCREEN IS GONE, along with the `inert` layout effect that guarded the
  // covered feed and the body.hm-immersive header/nav hiding. The teaser is not
  // a tool, so there is nothing to expand into -- /city/:citySlug/map is the
  // full experience now, and it is a real page with a real back button rather
  // than a fixed overlay pretending to be one. Deleting it also removes
  // `.home-map-fill.is-fullscreen .hm-mapcard`'s `z-index: 1000`, which sat
  // above the Radix dialog's z-50 and was a latent inversion nothing exercised.
  //
  // THE CARD IS NOT SHOWN ON EVERY TAB. All Events and Tonight get it; What's
  // New and Calendar do not. The rule used to be "demote on What's New, remove
  // on Calendar", justified by the tab row not jumping -- and that was false:
  // the demotion reordered .hm-side ABOVE .hm-mapcard, which raises the tab row
  // by exactly the card's height, the same jump removal causes. Demoting bought
  // nothing on the axis it was chosen for and paid a live Leaflet map parked
  // under a feed nobody scrolls to. The ~149px jump is ACCEPTED on both tabs;
  // do not add a sticky header or a fade to soften it.
  //
  // citySlug is required, not optional: the card's entire purpose is to open
  // /city/:citySlug/map, and a card that cannot say where it goes should not be
  // on screen. No city, no card -- the still and the dark box below still render.
  const showMapCard = !!citySlug && (state.tab === 'all' || state.tab === 'tonight');

  const placeholder = citySlug ? MAP_PLACEHOLDERS[citySlug] : undefined;

  return (
    <div
      className={cn('home-map-fill home-map relative isolate w-full overflow-hidden')}
    >
      {/* The skip link only has something to skip when the card is on screen.
          On What's New and Calendar the map is not rendered at all, so a link
          offering to skip it would name a landmark that is not there. */}
      {showMapCard && (
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

          It used to be unmounted in fullscreen, because the expanded map was a modal
          dialog and taking the head out of the document beat merely hiding it. Fullscreen
          is gone, so there is no modal state left to step out of and the head renders
          unconditionally, on every tab. */}
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

      {/* Map card. Sizing is entirely CSS (.hm-mapcard: a flat 148px, 260px from
          768px up) so the box is the right size on the very first paint, before
          any JS runs -- that is what keeps the map swap free of layout shift
          (WS15). Until it mounts, a pre-rendered basemap still (below) or the
          plain dark box fills it.
          The whole block is REMOVED, not hidden, on What's New and Calendar:
          `display:none` would leave Leaflet mounted at zero size, which is the
          worst of both -- it still costs a live map and still moves the tab row. */}
      {showMapCard && (
      <div
        className="hm-mapcard relative overflow-hidden"
        role="region"
        aria-label="Event map"
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
            linger and double up once real tiles are on screen.
            THE CREDIT MUST NAME WHOEVER RENDERED THE STILL, not whoever serves
            the live tiles -- they were different providers until 2026-09-01 and
            could be again. They are the same now: the stills under
            /map-placeholder are Esri Base + Reference composited at this map's
            own default view, which is why this credits Esri. If you re-render
            them from another provider, this string moves with them.
            ATTR, not a hand-written copy. Esri's terms require the service's
            stated credit verbatim, and a second spelling of it here would be
            free to drift from the one the live map shows -- the exact failure
            basemapTiles.ts was split out to prevent. dangerouslySetInnerHTML is
            what lets ONE constant serve both: ATTR carries an <a> for the OSM
            copyright link, it is a module constant with no user input anywhere
            near it, and the alternative is that second spelling. */}
        {placeholder && !mapMounted && (
          <div
            className="pointer-events-none absolute bottom-0 right-0 z-10 rounded-tl bg-background/70 px-1 text-[9px] leading-tight text-muted-foreground [&_a]:pointer-events-auto [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: ATTR }}
          />
        )}
        {/* #4d4d4f, NOT the shell dark, and it is the SAME defect the
            .leaflet-container ground was changed for -- this plate is just the
            one that shows first. `mapMounted` flips the instant hydration
            commits, but HomeMapCard is ~198 KB of lazy Leaflet, so on any
            connection slower than hydration this fallback covers the still for
            the whole chunk download. At #11121a that was still (luma 77) ->
            flat 18 -> 77: a black flash BETWEEN two identical greys, which
            matching the ground had made more conspicuous, not less.
            It stays OPAQUE, and the static credit below depends on that. That
            credit is gated on `!mapMounted`, but Leaflet's own attribution
            control does not exist until HomeMapCard actually mounts -- so for
            this window there is imagery-shaped nothing on screen and no credit,
            which is only correct while this plate hides the still. MAKE THIS
            TRANSPARENT AND YOU MUST MOVE THE CREDIT ONTO A REAL on-screen
            signal (onReady) FIRST, or Esri imagery shows uncredited. */}
        {mapMounted ? (
          <Suspense fallback={<div className="absolute inset-0" style={{ background: '#4d4d4f' }} />}>
            {/* citySlug is non-null here by construction: showMapCard gates this
                whole block on it. The assertion is the narrowing TypeScript
                cannot do across that boundary, not a claim about the data. */}
            <HomeMapCard
              state={state}
              cityName={cityName}
              citySlug={citySlug as string}
              /* The card derives its headline from the rows it was given, and
                 an empty array is indistinguishable from "no events" -- so on a
                 failed or in-flight fetch it asserted "0 venues on the map" and
                 "0 tonight" beside the feed's own RetryNotice, stating a fact
                 about London next to a notice saying we could not load it. */
              notReady={loading || error ? (error ? 'error' : 'loading') : null}
            />
          </Suspense>
        ) : (
          /* SHELL DARK HERE ON PURPOSE, and deliberately NOT the #4d4d4f the two
             sibling plates use. This is the no-still branch: the card genuinely
             has no map yet, so the coherent ground is the page's own
             (.home-map-fill is #11121a). The grey is specifically for a plate
             that REPLACES a still -- matching the tone it covers is the whole
             point of it, and there is nothing to match here. A grey slab in a
             dark page before any map exists would be worse, not better.
             Review round 2 called this a common-path miss, reasoning that `/` is
             prerendered with citySlug null so most visitors land here.
             DISPROVED with one request: `/` is a 307 to /city/london-gb, so
             getCityFromPath resolves the slug SYNCHRONOUSLY on the server and
             the first client render (CityContext.tsx:42) and every visitor gets
             the placeholder. This branch is reached only by a city with no entry
             in MAP_PLACEHOLDERS -- none today, but every one the multi-country
             arc adds. Re-decide it there, WITH a still to compare against. */
          !placeholder && <div className="absolute inset-0" style={{ background: '#11121a' }} />
        )}
      </div>
      )}

      <div ref={sideRef} className="hm-side flex min-h-0 flex-1 flex-col">
        <div className="hm-dock shrink-0 px-3 pt-3 md:px-4">
          <TabBar tab={state.tab} setTab={state.setTab} />
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
