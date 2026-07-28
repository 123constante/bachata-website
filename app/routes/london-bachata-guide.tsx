import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { londonDateKey } from "@/lib/londonDate";
import { SEO_LANDING_WINDOWS, fetchSeoLandingEventsIntoCache } from "@/lib/seoLandingEvents";
import BachataInLondon, { SEO_INPUT } from "@/pages/seo/BachataInLondon";
import { stampSeoLanding } from "../cacheTags";
import { cacheHeaders, taggedData } from "../detailLoader";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/london-bachata-guide";

// Framework route for /london-bachata-guide (pillar page) -- on-demand SSR +
// tagged ISR. Crawlers get the full guide HTML (Article + FAQPage JSON-LD, h1,
// canonical) AND the live "this week" section as real server-rendered listings
// with crawlable /event/ links; under build-time prerender that section shipped
// empty. The loader and LiveEventsSection share ONE key + fetcher
// (@/lib/seoLandingEvents), so the dehydrated entry is by construction the entry
// the client hook reads.
export async function loader() {
  const qc = createQueryClient();

  // The London day this document was rendered on. It ships to the client and
  // pins the first render's window -- see LiveEventsSectionProps.serverTodayKey.
  const todayKey = londonDateKey(new Date());

  // fetchQuery (NOT prefetchQuery) so a transient RPC error THROWS out of the
  // loader -> 500 with no Vercel-Cache-Tag -> cacheHeaders leaves it uncached,
  // instead of edge-caching an empty listing for an hour. Mirrors /festivals.
  await fetchSeoLandingEventsIntoCache(qc, todayKey, SEO_LANDING_WINDOWS.guide);

  return taggedData({ dehydratedState: dehydrate(qc), todayKey }, stampSeoLanding());
}

export const meta: Route.MetaFunction = () => seoInputToMeta(SEO_INPUT);

// Edge-cache the SSR response + forward the loader's Vercel-Cache-Tag for
// on-demand purge on event/festival writes. Mirrors festivals.tsx.
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return cacheHeaders(loaderHeaders);
}

export default function LondonBachataGuideRoute({ loaderData }: Route.ComponentProps) {
  return (
    <HydrationBoundary state={loaderData.dehydratedState}>
      <InitialVisiblePageTransition>
        <BachataInLondon serverTodayKey={loaderData.todayKey} />
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
