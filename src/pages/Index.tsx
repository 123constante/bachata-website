import { Suspense, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { PageErrorBoundary } from '@/components/ErrorBoundary';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useCity } from '@/contexts/CityContext';
import { useCalendarEvents } from '@/hooks/useCalendarEventsRpc';
import { useMapEvents } from '@/hooks/useMapEvents';
import { useMapList } from '@/modules/home-map/useMapList';
import { useUpcomingFestivalsGlobal } from '@/hooks/useUpcomingFestivalsGlobal';
import type { FestivalPreview } from '@/hooks/useUpcomingFestivalsGlobal';
import { todayStr } from '@/modules/home-map/mapTypes';
import type { MapEvent } from '@/modules/home-map/mapTypes';
import { useIsMobile } from '@/hooks/use-mobile';
import { renderEventListJsonLd } from '@/lib/buildEventListJsonLd';
import { renderWebsiteJsonLd } from '@/lib/buildWebsiteJsonLd';
import { renderOrganizationJsonLd } from '@/lib/buildOrganizationJsonLd';
import { useSeo, buildSeoForRoute, SITE_ORIGIN } from '@/lib/seo';

// Both home surfaces are lazy so neither bundle blocks the other; the Festival
// Map's Leaflet code only loads once one of them mounts.
const MobileMapHome = lazyWithRetry(() => import('@/modules/home-map/mobile/MobileMapHome'));
const DesktopMapHome = lazyWithRetry(() => import('@/modules/home-map/DesktopMapHome'));

// Stable empty fallback so useMapList's memoised derivations don't churn while
// the map query is loading.
const NO_EVENTS: MapEvent[] = [];

/**
 * Festival Map homepage (`/city/:slug` and `/city/:slug/calendar`). A thin
 * responsive switch: the map data + discovery state are built unconditionally,
 * then the mobile or desktop surface renders. SEO JSON-LD + an sr-only <h1>
 * stay so the map surface (which has no visible heading) remains crawlable.
 */
const Index = () => {
  const { citySlug } = useCity();
  const { pathname } = useLocation();
  const isMobile = useIsMobile();

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

  // SEO-only: this week's events drive the JSON-LD ItemList. Kept separate from
  // the map query (different shape + horizon) so search-engine output is stable.
  const weekStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return d;
  }, [weekStart]);
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
  const rangeStart = useMemo(() => todayStr(), []);
  const rangeEnd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return todayStr(d);
  }, []);
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
        start_time: f.start_time,
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

  const state = useMapList(allMapEvents, { scrollOnPinSelect: !isMobile });

  // Deep-link: /city/:slug/calendar opens the Calendar tab on mount.
  const { setTab } = state;
  useEffect(() => {
    // /city/:slug/calendar deep-links to Calendar; any other home path resets
    // to the default (All Events) so leaving /calendar doesn't strand the rail.
    setTab(pathname.endsWith('/calendar') ? 'cal' : 'all');
  }, [pathname, setTab]);

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
      <h1 className="sr-only">Bachata classes, parties &amp; festivals in {cityDisplayName}</h1>
      <Suspense
        fallback={<div style={{ height: 'calc(100svh - 60px)', background: '#11121a' }} />}
      >
        {isMobile ? (
          <MobileMapHome
            state={state}
            cityName={cityDisplayName}
            loading={isLoading}
            error={isError}
            onRetry={onRetry}
          />
        ) : (
          <DesktopMapHome
            state={state}
            cityName={cityDisplayName}
            loading={isLoading}
            error={isError}
            onRetry={onRetry}
          />
        )}
      </Suspense>
    </PageErrorBoundary>
  );
};

export default Index;
