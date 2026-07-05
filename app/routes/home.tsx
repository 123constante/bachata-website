import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { getCalendarEvents, getMapEvents } from "@/integrations/supabase/eventRpcs";
import { addDaysToKey, londonDateKey, londonDayRangeUtc } from "@/lib/londonDate";
import { buildSeoForRoute } from "@/lib/seo";
import Index from "@/pages/Index";
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

// Framework route for /city/:slug (the homepage) — prerendered to static HTML.
// The loader mirrors Index.tsx's two data hooks BYTE-FOR-BYTE (same query keys +
// London date-range derivation) and dehydrates them, so the static document ships
// with the JSON-LD ItemList (the crawlable SEO payload the sr-only <h1> + schema
// give the map-only page) and the client map hydrates from cache without a
// refetch. The visible Leaflet map is client-only (Index gates it on mount).
export async function loader({ params }: Route.LoaderArgs) {
  const citySlug = (params.slug ?? "").toLowerCase();
  const qc = createQueryClient();

  // Same London-clock derivation Index uses (useLondonToday → londonDateKey).
  const todayKey = londonDateKey(new Date());
  const { start: weekStart, end: weekEnd } = londonDayRangeUtc(todayKey, 7);
  const rangeEnd90 = addDaysToKey(todayKey, 90);

  await Promise.all([
    // This week's events → the JSON-LD ItemList (useCalendarEvents key).
    qc.prefetchQuery({
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

  return { dehydratedState: dehydrate(qc), cityDisplay: cityDisplayFromSlug(citySlug) };
}

export const meta: Route.MetaFunction = ({ data }) =>
  seoInputToMeta(buildSeoForRoute("home", { cityDisplay: data?.cityDisplay }));

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
