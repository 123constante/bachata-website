import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { getCalendarEvents, getMapEvents, type CalendarEventRow } from "@/integrations/supabase/eventRpcs";
import type { MapEvent } from "@/modules/home-map/mapTypes";
import { eventHref } from "@/lib/seo/eventHref";
import { addDaysToKey, londonDateKey, londonDayRangeUtc } from "@/lib/londonDate";
import { buildSeoForRoute } from "@/lib/seo";
import Index from "@/pages/Index";
import { stampHome } from "../cacheTags";
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
// them, so the document ships the JSON-LD ItemList (crawlable SEO) AND the
// above-the-fold feed as real server-rendered HTML, and the client hydrates from
// cache without a refetch. Edge-cached on s-maxage and purged on any
// event/festival write via the `home-feed` cache tag (see api.revalidate tagsFor
// + the Supabase revalidation webhook). ISR also unfreezes the
// build-time-frozen London `todayKey` below. The Leaflet map itself is client-only.
export async function loader({ params }: Route.LoaderArgs) {
  const citySlug = (params.slug ?? "").toLowerCase();
  const qc = createQueryClient();

  // The instant this document was rendered at. It ships to the client and pins
  // the first render's time-derived output (the London "today" grouping, the
  // "On now" badges, the "Added 2h ago" stamps) to the server's clock -- see
  // Index.tsx / modules/home-map/homeClock. This response is edge-cached for an
  // hour and served stale for a day, so "now" on the client is emphatically NOT
  // "now" on the server, and the feed is server-rendered markup that has to
  // hydrate byte-identically.
  const nowMs = Date.now();
  // Same London-clock derivation Index uses (useLondonToday → londonDateKey).
  const todayKey = londonDateKey(new Date(nowMs));
  const { start: weekStart, end: weekEnd } = londonDayRangeUtc(todayKey, 7);
  const rangeEnd90 = addDaysToKey(todayKey, 90);

  await Promise.all([
    // This week's events → the JSON-LD ItemList (useCalendarEvents key). Use
    // fetchQuery (NOT prefetchQuery) for this SEO-critical query so a transient
    // RPC error THROWS out of the loader → a 500 with no Vercel-Cache-Tag →
    // cacheHeaders leaves it uncached, instead of edge-caching an empty ItemList
    // for an hour. Mirrors the detail routes' gating fetch (event.tsx).
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
    // 90-day map window (useMapEvents key). This is now the ABOVE-THE-FOLD feed's
    // data, not just the map's: HomeMapShell renders the event list from it on the
    // server. fetchQuery, so a failure 500s (and stays uncached) rather than
    // edge-caching an empty homepage for an hour -- it used to be prefetchQuery,
    // which was right when the only consumer was the client-only map.
    qc.fetchQuery({
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

  // stampHome = `home-feed,city-<slug>` (see ../cacheTags): `home-feed` is purged
  // on any event/festival write, `city-<slug>` is reserved for future per-city
  // precision. taggedData passes the unwrapped payload to the component + meta();
  // seoEventLinks rides along for the sr-only <nav>.
  return taggedData(
    {
      dehydratedState: dehydrate(qc),
      cityDisplay: cityDisplayFromSlug(citySlug),
      seoEventLinks,
      todayKey,
      nowMs,
    },
    stampHome(citySlug),
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
        <Index todayKey={loaderData.todayKey} serverNowMs={loaderData.nowMs} />
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
