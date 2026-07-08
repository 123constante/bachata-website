import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { getCalendarEvents, getMapEvents } from "@/integrations/supabase/eventRpcs";
import { addDaysToKey, londonDateKey, londonDayRangeUtc } from "@/lib/londonDate";
import { buildSeoForRoute } from "@/lib/seo";
import Index from "@/pages/Index";
import { cacheHeaders, taggedData } from "../detailLoader";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/home";

// Slug → display name, mirroring Index.tsx's cityDisplayName: drop a trailing
// 2-letter country code ('london-gb' → 'London') and title-case the rest.
function cityDisplayFromSlug(slug: string): string | undefined {
  if (!slug) return undefined;
  const parts = slug.split("-");
  if (parts.length > 1 && parts[parts.length - 1].length === 2) parts.pop();
  return parts.map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ") || undefined;
}

// Framework route for /city/:slug (the homepage) — on-demand SSR + tagged ISR
// (moved off build-time prerender, which froze the dehydrated feed at deploy time
// with no revalidation, so a swapped cover / cancelled event stayed stale in the
// SSR HTML until the next deploy). The loader mirrors Index.tsx's two data hooks
// BYTE-FOR-BYTE (same query keys + London date-range derivation) and dehydrates
// them, so the document ships the JSON-LD ItemList (crawlable SEO) and the client
// map hydrates from cache without a refetch. Edge-cached on s-maxage and purged
// on any event/festival write via the `home-feed` cache tag (see api.revalidate
// tagsFor + the Supabase revalidation webhook). ISR also unfreezes the
// build-time-frozen London `todayKey` below. The Leaflet map itself is client-only.
export async function loader({ params }: Route.LoaderArgs) {
  const citySlug = (params.slug ?? "").toLowerCase();
  const qc = createQueryClient();

  // Same London-clock derivation Index uses (useLondonToday → londonDateKey).
  const todayKey = londonDateKey(new Date());
  const { start: weekStart, end: weekEnd } = londonDayRangeUtc(todayKey, 7);
  const rangeEnd90 = addDaysToKey(todayKey, 90);

  await Promise.all([
    // This week's events → the JSON-LD ItemList (useCalendarEvents key). Use
    // fetchQuery (NOT prefetchQuery) for this SEO-critical query so a transient
    // RPC error THROWS out of the loader → a 500 with no Vercel-Cache-Tag →
    // cacheHeaders leaves it uncached, instead of edge-caching an empty ItemList
    // for an hour. Mirrors the detail routes' gating fetch (event.tsx). The map
    // query below stays prefetchQuery: the map is client-only (hydrates/refetches
    // on mount), so its failure must not 500 the SEO document.
    qc.fetchQuery({
      queryKey: ["calendar-events", weekStart.toISOString(), weekEnd.toISOString(), citySlug],
      queryFn: () =>
        getCalendarEvents({
          range_start: weekStart.toISOString(),
          range_end: weekEnd.toISOString(),
          city_slug_param: citySlug,
        }),
      staleTime: 1000 * 60 * 5,
    }),
    // 90-day map window (useMapEvents key) → map hydrates from cache.
    qc.prefetchQuery({
      queryKey: ["map-events", citySlug, todayKey, rangeEnd90],
      queryFn: () =>
        getMapEvents({ city_slug_param: citySlug, range_start: todayKey, range_end: rangeEnd90 }),
      staleTime: 1000 * 60 * 5,
    }),
  ]);

  // `home-feed` is purged on any event/festival write (api.revalidate tagsFor);
  // `city-<slug>` is stamped for future per-city precision. taggedData passes the
  // unwrapped payload through to the component + meta() unchanged.
  return taggedData(
    { dehydratedState: dehydrate(qc), cityDisplay: cityDisplayFromSlug(citySlug) },
    `home-feed,city-${citySlug}`,
  );
}

export const meta: Route.MetaFunction = ({ data }) =>
  seoInputToMeta(buildSeoForRoute("home", { cityDisplay: data?.cityDisplay }));

// Edge-cache the SSR response (s-maxage/SWR) + forward the loader's Vercel-Cache-Tag
// so a content edit can purge it on demand. Mirrors the detail routes (event.tsx).
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return cacheHeaders(loaderHeaders);
}

export default function HomeRoute({ loaderData, params }: Route.ComponentProps) {
  return (
    <HydrationBoundary state={loaderData.dehydratedState}>
      {/* key by slug so /city/a → /city/b fully remounts (matches today's
          location.pathname-keyed <Routes>). */}
      <InitialVisiblePageTransition key={params.slug}>
        <Index />
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
