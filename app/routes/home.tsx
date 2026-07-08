import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { getCalendarEvents, getMapEvents, type CalendarEventRow } from "@/integrations/supabase/eventRpcs";
import type { MapEvent } from "@/modules/home-map/mapTypes";
import { eventHref } from "@/lib/seo/eventHref";
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

  // Crawlable event links for the sr-only <nav> below (SEO plan 1.1, restored
  // after the RR7 migration dropped it -- the server HTML had 0 /event/ links).
  // Read back the two prefetches, dedupe by event_id, skip cancelled, and link
  // the canonical slug URL WITHOUT ?occurrenceId so link equity lands on the
  // page Google indexes.
  const calendarRows =
    (qc.getQueryData([
      "calendar-events",
      weekStart.toISOString(),
      weekEnd.toISOString(),
      citySlug,
    ]) as CalendarEventRow[] | undefined) ?? [];
  const mapRows =
    (qc.getQueryData(["map-events", citySlug, todayKey, rangeEnd90]) as MapEvent[] | undefined) ??
    [];
  const seen = new Set<string>();
  const seoEventLinks: Array<{ href: string; name: string }> = [];
  for (const e of [...calendarRows, ...mapRows]) {
    if (!e?.event_id || !e.name || seen.has(e.event_id)) continue;
    if (e.is_cancelled === true) continue;
    seen.add(e.event_id);
    seoEventLinks.push({ href: eventHref(e), name: e.name });
  }

  return {
    dehydratedState: dehydrate(qc),
    cityDisplay: cityDisplayFromSlug(citySlug),
    seoEventLinks,
  };
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
        {/* Loader-data-driven so server and client render byte-identically
            (zero hydration-mismatch surface). sr-only: invisible, but a real
            <nav> for crawlers (internal-link equity from the highest-authority
            page) and an honest a11y win for screen-reader users on the
            map-only homepage. Plain <a> (not <Link>): these exist for the
            crawler; a full navigation on activation is fine. */}
        <nav aria-label="Upcoming events in this city" className="sr-only">
          <ul>
            {loaderData.seoEventLinks.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.name}</a>
              </li>
            ))}
          </ul>
        </nav>
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
