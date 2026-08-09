import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { getCalendarEvents, getMapEvents, type CalendarEventRow } from "@/integrations/supabase/eventRpcs";
import { soonestLiveStatusChangeMs, type MapEvent } from "@/modules/home-map/mapTypes";
import { eventHref } from "@/lib/seo/eventHref";
import {
  LONDON_TZ,
  addDaysToKey,
  londonDateKey,
  londonDayRangeUtc,
  secondsUntilKeyRollsOver,
} from "@/lib/londonDate";
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

// The two query keys this page's data is filed under, both derived from the
// pinned London day. ONE derivation, because three call sites have to agree on
// it -- the fetch, the read-back for the sr-only nav, and the eviction of a
// superseded day below. A key the dehydrated entry is not filed under hydrates
// against a miss and refetches over server HTML that already had events.
function homeQueryKeys(citySlug: string, todayKey: string) {
  const { start: weekStart, end: weekEnd } = londonDayRangeUtc(todayKey, 7);
  const rangeEnd90 = addDaysToKey(todayKey, 90);
  return {
    weekStart,
    weekEnd,
    rangeEnd90,
    calendar: ["calendar-events", weekStart.toISOString(), weekEnd.toISOString(), citySlug],
    map: ["map-events", citySlug, todayKey, rangeEnd90],
  };
}

// Both of the loader's queries for ONE pinned London day. Extracted so the
// midnight-straddle retry below can re-run the identical fetch under a new key
// rather than restate it -- a second copy would be the thing that drifts.
async function fetchHomeDay(
  qc: ReturnType<typeof createQueryClient>,
  citySlug: string,
  todayKey: string,
) {
  const keys = homeQueryKeys(citySlug, todayKey);
  await Promise.all([
    // This week's events -> the JSON-LD ItemList (useCalendarEvents key). Use
    // fetchQuery (NOT prefetchQuery) for this SEO-critical query so a transient
    // RPC error THROWS out of the loader -> a 500 with no Vercel-Cache-Tag ->
    // cacheHeaders leaves it uncached, instead of edge-caching an empty ItemList
    // for an hour. Mirrors the detail routes' gating fetch (event.tsx).
    qc.fetchQuery({
      queryKey: keys.calendar,
      queryFn: () =>
        getCalendarEvents({
          range_start: keys.weekStart.toISOString(),
          range_end: keys.weekEnd.toISOString(),
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
      queryKey: keys.map,
      queryFn: () =>
        getMapEvents({ city_slug_param: citySlug, range_start: todayKey, range_end: keys.rangeEnd90 }),
      staleTime: 1000 * 60 * 5,
    }),
  ]);
  return keys;
}

// Framework route for /city/:slug (the homepage) -- on-demand SSR + tagged ISR
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
  // Index.tsx / modules/home-map/homeClock. This response is edge-cached, so
  // "now" on the client is emphatically NOT "now" on the server, and the feed is
  // server-rendered markup that has to hydrate byte-identically. How long the
  // edge may keep serving THIS instant is bounded at the bottom of the loader --
  // it used to be a flat hour fresh plus a day stale, which is 25 hours of
  // servability for one clock read.
  //
  // `let`, because the straddle retry below re-pins it. The INVARIANT it and
  // todayKey are held to on every path out of this loader is that they name the
  // same London day: they are always read from one Date.now(), never two.
  let nowMs = Date.now();
  // Same London-clock derivation Index uses (useLondonToday -> londonDateKey).
  //
  // DERIVED BEFORE THE FETCH, WHICH IS WHY THE STRADDLE IS HANDLED BELOW rather
  // than by moving this line down. /festival/:id fixed the same defect by
  // deriving its key last; that option does not exist here, because this key is
  // an INPUT to both queries and seeds the keys they dehydrate under. Moving it
  // below the await ships a key the cache entries are not filed under.
  let todayKey = londonDateKey(new Date(nowMs));

  let keys = await fetchHomeDay(qc, citySlug, todayKey);

  // THE MIDNIGHT STRADDLE. A fetch spanning London midnight leaves the pin stale
  // before the document is even emitted, and the bound alone cannot save it --
  // declining to CACHE a false claim does not unsay it to the requester, which
  // may be the single crawl Googlebot makes. Same treatment as
  // loadSeoLandingDay: re-derive and re-fetch, bounded at one retry, with
  // secondsUntilKeyRollsOver -- keyed on the PIN, not on `now` -- as the
  // backstop should the second fetch straddle too (it reads 0, and that document
  // is served but never cached).
  //
  // ONE clock read feeds BOTH re-pins. Re-deriving the key while leaving `nowMs`
  // on the previous day does not merely leave the pin stale, it makes the PAIR
  // false: londonMinutesOfDay(nowMs) reads 1439 while todayKey names the day
  // after, so todayLiveStatus opens its today gate on the new day's rows and
  // then measures them against 23:59 -- and any row whose window contains that
  // minute server-renders "On now" for an event up to 20 hours away. The badge
  // bound below would then be sized off that false status and cache it. The
  // invariant is cheap to state and cheap to hold: nowMs and todayKey are two
  // readings of the same instant.
  const emissionMs = Date.now();
  const keyAtEmission = londonDateKey(new Date(emissionMs));
  if (keyAtEmission !== todayKey) {
    const supersededKeys = keys;
    todayKey = keyAtEmission;
    nowMs = emissionMs;
    keys = await fetchHomeDay(qc, citySlug, todayKey);
    // Evict yesterday's entries before dehydrate() sees them. The client only
    // reads the key shipped below, so leaving them would not be WRONG -- but
    // dehydrate serialises every entry in the cache, and one of these is a
    // 90-day London window. Shipping that array twice would double the
    // dehydrated payload of the site's busiest document to buy a cache entry
    // nothing reads.
    qc.removeQueries({ queryKey: supersededKeys.calendar });
    qc.removeQueries({ queryKey: supersededKeys.map });
  }
  // Crawlable event links for the sr-only <nav> below (SEO plan 1.1, restored
  // after the RR7 migration dropped it -- the server HTML had 0 /event/ links).
  // Read back the two prefetches, dedupe by event_id, skip cancelled, and link
  // the canonical slug URL WITHOUT ?occurrenceId so link equity lands on the
  // page Google indexes.
  //
  // Read back through `keys`, NOT a second hand-built literal. These used to be
  // restated here, which was survivable while one derivation fed one fetch; it
  // is not now that a midnight straddle can re-file both entries under a new
  // day. A literal built from the ORIGINAL key would read back undefined after
  // the retry, emptying the crawlable nav and -- since mapRows also feeds the
  // badge bound below -- silently restoring the day-only bound this change
  // exists to replace. Two failures, no throw, on the one path no request
  // normally takes.
  const calendarRows =
    (qc.getQueryData(keys.calendar) as CalendarEventRow[] | undefined) ?? [];
  const mapRows = (qc.getQueryData(keys.map) as MapEvent[] | undefined) ?? [];
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
  // HOW LONG THIS DOCUMENT STAYS TRUE -- the lesser of TWO independent expiries,
  // because this route pins two clock reads with different shelf lives.
  //
  // `todayKey` expires at London midnight. It drives the feed's day grouping,
  // the "N on tonight" counts and both query windows above.
  //
  // `nowMs` expires far sooner: the feed server-renders an "On now" / "Soon"
  // badge from it (cards.tsx LiveBadge -> todayLiveStatus), and that claim goes
  // false the moment an event starts or ends -- 23:30 is the same calendar day
  // as the 22:55 the document was rendered at, so the day bound does not reach
  // it. Bounding on the day alone would fix the grouping and leave a finished
  // social reading "On now" to Googlebot, which is worse than not bounding at
  // all: the page would then LOOK fixed.
  //
  // WHAT IS DELIBERATELY NOT BOUNDED, and this is where the TTL is won or lost.
  // The badge's null -> "Soon" edge is excluded (see soonestLiveStatusChangeMs):
  // it is a third mark on every row, 90 minutes ahead of every start, and it
  // buys precision on the one transition where a stale document does not make a
  // false claim. A document not yet saying "Soon" omits an advance warning; one
  // saying "Soon" mid-event, or "On now" after closing, asserts something untrue
  // about right now, and those two are bounded.
  //
  // The number that drove the exclusion, stated with its scope because it is NOT
  // a measurement of what shipped: walking a plausible 15-event London Friday
  // minute by minute, the THREE-mark variant gave a mean bound of ~17 minutes, a
  // floor of 60 seconds, and 28% of evening minutes under 10 -- against a flat
  // 3600 before. Dropping the soon mark removes a third of the marks and the
  // earliest of them; the resulting distribution has not been measured. If this
  // route's origin load matters later, measure the two-mark variant rather than
  // quoting the figure above, which describes the variant that was rejected.
  //
  // The freshness stamps ("Added 2h ago",
  // relativeShort) move every minute, so bounding on them would collapse the TTL
  // to ~60s whenever a recently-added event is in the feed -- on the site's
  // busiest route, to buy precision on a decorative cell that never makes a
  // false claim about an event's STATE and self-corrects a tick after hydration.
  // They ride inside whichever bound wins below. That is a chosen trade, not an
  // oversight; the same reasoning is why the coarse useHomeNowStatic readers
  // (isRecentlyChanged's 14 days, isFreshNew's 30) need nothing here at all.
  //
  // MEASURED AT EMISSION, against Date.now() rather than `nowMs`. The gap
  // between them is the fetch above, and it runs one way: sizing the bound from
  // the pin would over-grant by however long the RPCs took. A badge edge that
  // fell INSIDE that gap yields a non-positive number, which edgeCacheControl
  // floors to no caching at all -- the honest answer, since the document is
  // already stale on emission.
  const nextBadgeChangeMs = soonestLiveStatusChangeMs(mapRows, todayKey, nowMs);
  const boundSeconds = Math.min(
    secondsUntilKeyRollsOver(todayKey, LONDON_TZ),
    nextBadgeChangeMs === null
      ? Number.POSITIVE_INFINITY
      : (nextBadgeChangeMs - Date.now()) / 1000,
  );

  return taggedData(
    {
      dehydratedState: dehydrate(qc),
      cityDisplay: cityDisplayFromSlug(citySlug),
      seoEventLinks,
      todayKey,
      nowMs,
    },
    stampHome(citySlug),
    // Unclamped on purpose: edgeCacheControl is the single owner of the clamping
    // rule (see its note in app/detailLoader.ts), and a second copy here would
    // let the header and the directive drift apart.
    { edgeTtlBoundSeconds: boundSeconds },
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
