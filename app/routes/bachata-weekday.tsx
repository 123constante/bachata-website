import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { SEO_LANDING_WINDOWS, loadSeoLandingDay } from "@/lib/seoLandingEvents";
import BachataWeekday, { weekdaySeoInput } from "@/pages/seo/BachataWeekday";
import { stampSeoLanding } from "../cacheTags";
import { cacheHeaders, taggedData } from "../detailLoader";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/bachata-weekday";

// ONE module serving all seven weekday landing pages (registered per path in
// app/routes.ts with explicit ids weekday-monday ... weekday-sunday):
//   /bachata-london-{monday|tuesday|...|sunday}
// meta() derives the weekday from the pathname via the same helper the page's
// useSeo() uses, so server and client emit identical head tags.
//
// On-demand SSR + tagged ISR (moved off build-time prerender, which shipped
// "(0 events)" and zero /event/ links as the INDEXED HTML -- the whole point of
// these pages). The loader and the page share ONE key + fetcher
// (@/lib/seoLandingEvents), so the dehydrated entry is by construction the entry
// the client hook reads. All seven paths share one query key (the same 28-day
// London window) and one cache tag, so a single event write refreshes the set.
export async function loader() {
  const qc = createQueryClient();

  // The London day this document was rendered on. It ships to the client and
  // pins the first render's window -- see BachataWeekday's serverTodayKey doc.
  // One helper: it derives that key, fills the cache via fetchQuery (NOT
  // prefetchQuery -- a transient RPC error must THROW out of the loader, so the
  // 500 carries no Vercel-Cache-Tag and cacheHeaders leaves it uncached rather
  // than edge-caching an empty listing for an hour; mirrors /festivals), and
  // reports how much of the pinned day is left.
  const { todayKey, edgeTtlBoundSeconds } = await loadSeoLandingDay(
    qc,
    SEO_LANDING_WINDOWS.weekday,
  );

  // Cap how long the edge may serve THIS generation. Both `todayKey` and the
  // event window it opens are frozen at render time, while the default policy
  // keeps one generation servable for 25 hours -- so an unbounded document
  // rendered at 23:50 is still served at 00:50 listing yesterday's window. See
  // loadSeoLandingDay for why the key is derived above the fetch and the bound
  // below it; the two cannot swap places here.
  return taggedData({ dehydratedState: dehydrate(qc), todayKey }, stampSeoLanding(), {
    edgeTtlBoundSeconds,
  });
}

export const meta: Route.MetaFunction = ({ location }) =>
  seoInputToMeta(weekdaySeoInput(location.pathname));

// Edge-cache the SSR response + forward the loader's Vercel-Cache-Tag for
// on-demand purge on event/festival writes. Mirrors festivals.tsx.
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return cacheHeaders(loaderHeaders);
}

export default function BachataWeekdayRoute({ loaderData }: Route.ComponentProps) {
  return (
    <HydrationBoundary state={loaderData.dehydratedState}>
      <InitialVisiblePageTransition>
        <BachataWeekday serverTodayKey={loaderData.todayKey} />
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
