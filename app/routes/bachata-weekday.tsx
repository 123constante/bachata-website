import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { londonDateKey } from "@/lib/londonDate";
import { SEO_LANDING_WINDOWS, fetchSeoLandingEventsIntoCache } from "@/lib/seoLandingEvents";
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
  const todayKey = londonDateKey(new Date());

  // fetchQuery (NOT prefetchQuery) so a transient RPC error THROWS out of the
  // loader -> 500 with no Vercel-Cache-Tag -> cacheHeaders leaves it uncached,
  // instead of edge-caching an empty listing for an hour. Mirrors /festivals.
  await fetchSeoLandingEventsIntoCache(qc, todayKey, SEO_LANDING_WINDOWS.weekday);

  return taggedData({ dehydratedState: dehydrate(qc), todayKey }, stampSeoLanding());
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
