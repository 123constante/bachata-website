import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { PageErrorBoundary } from '@/components/ErrorBoundary';
import { useCity } from '@/contexts/CityContext';
import { useCalendarEvents } from '@/hooks/useCalendarEventsRpc';
import { useMapEvents } from '@/hooks/useMapEvents';
import { useMapList } from '@/modules/home-map/useMapList';
import { HomeClockProvider } from '@/modules/home-map/homeClock';
import { useUpcomingFestivalsGlobal } from '@/hooks/useUpcomingFestivalsGlobal';
import type { FestivalPreview } from '@/hooks/useUpcomingFestivalsGlobal';
import type { MapEvent, MapTab } from '@/modules/home-map/mapTypes';
import {
  addDaysToKey,
  londonDayRangeUtc,
  instantToLondonWallClockStamp,
} from '@/lib/londonDate';
import { useLondonToday } from '@/hooks/useLondonToday';
import { renderEventListJsonLd } from '@/lib/buildEventListJsonLd';
import { renderWebsiteJsonLd } from '@/lib/buildWebsiteJsonLd';
import { renderOrganizationJsonLd } from '@/lib/buildOrganizationJsonLd';
import { useSeo, buildSeoForRoute, SITE_ORIGIN } from '@/lib/seo';

// STATIC import, deliberately. The shell is the page's above-the-fold content
// (heading, tabs, event feed) and it must land in the server-rendered HTML --
// a lazy import would resolve to a Suspense fallback on the server, which is
// exactly the empty dark box this route used to paint. Leaflet stays lazy inside
// it (HomeMapCard), so the map's bytes are still off the critical path.
import HomeMapShell from '@/modules/home-map/HomeMapShell';

// Stable empty fallback so useMapList's memoised derivations don't churn while
// the map query is loading.
const NO_EVENTS: MapEvent[] = [];

/**
 * Festival Map homepage (`/city/:slug` and `/city/:slug/calendar`). Builds the
 * map data + discovery state, then renders the one CSS-responsive shell. The
 * feed now server-renders from the loader's dehydrated query cache, so the
 * document ships real content rather than a placeholder.
 *
 * `todayKey` / `serverNowMs` come from the route loader (app/routes/home.tsx).
 * They pin every time-derived value on the FIRST render to the instant the
 * server rendered at. This route is edge-cached -- for the SOONEST of London
 * midnight and the next ON-NOW transition, which the loader sizes; the "Soon"
 * edge is deliberately outside that cap, so a served document may omit a Soon
 * badge but never claims an event is on when it is not. It used to be a flat
 * hour fresh plus a day stale, i.e. 25 hours of servability for one clock read
 * -- so without them a browser hydrating
 * hour-old HTML would compute a different
 * "today" group or a different "Added 2h ago" stamp from the same data, and
 * React would throw the server tree away. They are optional: the legacy SPA
 * router (AnimatedRoutes) renders this page with no loader, and then the live
 * clock is the right answer.
 */
const Index = ({
  todayKey: serverTodayKey,
  serverNowMs,
}: {
  todayKey?: string;
  serverNowMs?: number;
} = {}) => {
  const { citySlug } = useCity();
  const { pathname } = useLocation();

  // Derive a display name from the slug. Slugs are '{city}-{country}' (e.g.
  // 'london-gb'); drop a trailing 2-letter country code and title-case every
  // remaining word so multi-word cities render correctly ('new-york-us' ->
  // 'New York', not 'New').
  const cityDisplayName = useMemo(() => {
    if (!citySlug) return 'Your City';
    const parts = citySlug.split('-');
    if (parts.length > 1 && parts[parts.length - 1].length === 2) parts.pop();
    return parts.map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
  }, [citySlug]);

  // Reactive London-calendar "today", seeded from the server's day so the first
  // client render reproduces the cached HTML byte for byte; it then rolls over
  // on its own (a tab left open overnight must not keep querying yesterday).
  const todayKey = useLondonToday(serverTodayKey);

  // SEO-only: this week's events drive the JSON-LD ItemList. Kept separate from
  // the map query (different shape + horizon) so search-engine output is stable.
  const { weekStart, weekEnd } = useMemo(() => {
    const { start, end } = londonDayRangeUtc(todayKey, 7);
    return { weekStart: start, weekEnd: end };
  }, [todayKey]);
  const { data: weekEvents } = useCalendarEvents({
    rangeStart: weekStart,
    rangeEnd: weekEnd,
    citySlug: citySlug ?? null,
    enabled: Boolean(citySlug),
  });
  const eventsJsonLd = useMemo(() => {
    if (!weekEvents || weekEvents.length === 0) return null;
    return renderEventListJsonLd({ events: weekEvents, origin: SITE_ORIGIN });
  }, [weekEvents]);

  // Map data: a 90-day window of occurrences (coords, cover, times, freshness).
  // The loader dehydrates this exact query key, so on the server -- and on the
  // first client render -- the data is already here and the feed renders for
  // real. Keep the key derivation in lockstep with app/routes/home.tsx.
  const rangeStart = todayKey;
  const rangeEnd = useMemo(() => addDaysToKey(todayKey, 90), [todayKey]);
  const { data: mapEvents, isLoading, isError, refetch } = useMapEvents({
    citySlug,
    rangeStart,
    rangeEnd,
    enabled: Boolean(citySlug),
  });
  const { data: globalFestivals = [] } = useUpcomingFestivalsGlobal();

  const allMapEvents = useMemo(() => {
    const base = mapEvents ?? NO_EVENTS;
    const localIds = new Set(base.map((e) => e.event_id));
    const remote = globalFestivals
      .filter((f: FestivalPreview) => !localIds.has(f.id))
      .map((f: FestivalPreview) => ({
        occurrence_id: `remote-${f.id}`,
        event_id: f.id,
        name: f.name,
        cover_image_url: f.poster_url,
        venue_name: f.city,
        area: null,
        city_slug: null,
        lat: null,
        lng: null,
        instance_date: f.date,
        // starts_at is a TRUE UTC instant (get_public_festivals_list_v1
        // resolves the series' local start through the series timezone), but
        // every consumer downstream -- formatTime, startMinutes, the day
        // grouping -- reads HH:MM straight off the string per the naive
        // local-as-UTC convention. Handing it over unconverted printed and
        // sorted every DST-period festival an hour early (live-verified: a
        // 12:00 London festival arrived as 11:00+00). Normalise at THIS
        // boundary so the row is indistinguishable from an occurrence row
        // and no downstream helper needs a special case.
        start_time: instantToLondonWallClockStamp(f.start_time),
        end_time: null,
        type: 'festival',
        has_party: false,
        has_class: false,
        class_start: null,
        class_end: null,
        party_start: null,
        party_end: null,
        created_at: null,
        updated_at: null,
        freshness_kind: null,
        is_cancelled: false,
        cancellation_reason_label: null,
      }));
    return remote.length ? [...base, ...remote] : base;
  }, [mapEvents, globalFestivals]);

  // The LIVE todayKey, not the server seed: useMapList no longer runs a clock of its
  // own, so the feed's grouping and the query window above are the same day by
  // construction, even across a midnight rollover.
  // Derived at RENDER time, not in an effect: see UseMapListOptions.initialTab.
  // Hydration-safe both ways -- /city/:slug is the server-rendered framework
  // route and never ends in /calendar (so server and client both seed 'all'),
  // while /city/:slug/calendar is served by the catchall, which renders nothing
  // on the server, so there is no server tree to disagree with.
  const deepLinkTab: MapTab = pathname.endsWith('/calendar') ? 'cal' : 'all';
  const state = useMapList(allMapEvents, { citySlug, today: todayKey, initialTab: deepLinkTab });

  // Keyed on PATHNAME, not on the derived tab: setTab also clears the picked day,
  // the current selection and the feed scroll, and those must reset on any home
  // navigation -- including a city switch (/city/london-gb -> /city/paris-fr),
  // which keeps this component mounted and leaves deepLinkTab unchanged at 'all'.
  // Depending on deepLinkTab would make this effect mount-only and strand a
  // London occurrence_id (plus the old city's scroll position) on the Paris feed.
  // Fires only on an ACTUAL pathname change, never on mount: useMapList already
  // seeded the right tab (initialTab), so a mount-time call would set the same
  // value and then run setTab's side effects anyway -- one of which scrolls the
  // feed to the top, undoing the scroll position a back-navigation just restored.
  // What this IS for is leaving /calendar and switching city
  // (/city/london-gb -> /city/paris-fr), where the component stays mounted and a
  // stale selection/day/scroll from the previous city must not survive.
  const { setTab } = state;
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;
    setTab(deepLinkTab);
  }, [pathname, deepLinkTab, setTab]);

  // Per-page meta via the centralised SEO primitive.
  useSeo(
    buildSeoForRoute('home', {
      cityDisplay: cityDisplayName === 'Your City' ? undefined : cityDisplayName,
    }),
  );

  const onRetry = () => {
    void refetch();
  };

  return (
    <PageErrorBoundary>
      {eventsJsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: eventsJsonLd }}
        />
      )}
      {/* WebSite + Organization schema - emit on the homepage only.
          Drives sitelinks searchbox and brand knowledge panel in Google. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: renderWebsiteJsonLd() }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: renderOrganizationJsonLd() }}
      />
      {/* The sr-only <h1> that used to live here is gone: the shell's visible
          "What's on in {city}" IS the page heading now. It was only ever an
          sr-only duplicate because the visible one was locked inside the
          client-only mobile surface. */}
      <HomeClockProvider serverNowMs={serverNowMs ?? Date.now()}>
        <HomeMapShell
          state={state}
          cityName={cityDisplayName}
          citySlug={citySlug}
          loading={isLoading}
          // Only when we have NOTHING to show. isError is also true for a failed
          // BACKGROUND refetch, where React Query still holds the last good rows --
          // and tearing the server-rendered feed down for a retry notice in that case
          // would be a self-inflicted outage on a transient blip.
          error={isError && !mapEvents}
          onRetry={onRetry}
        />
      </HomeClockProvider>
    </PageErrorBoundary>
  );
};

export default Index;
