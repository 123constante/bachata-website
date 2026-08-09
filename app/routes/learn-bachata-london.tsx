import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { SEO_LANDING_WINDOWS, loadSeoLandingDay } from "@/lib/seoLandingEvents";
import LearnBachataLondon, { SEO_INPUT } from "@/pages/seo/LearnBachataLondon";
import { stampSeoLanding } from "../cacheTags";
import { cacheHeaders, taggedData } from "../detailLoader";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/learn-bachata-london";

// Framework route for /learn-bachata-london (beginner pillar) -- on-demand SSR +
// tagged ISR. Crawlers get the full HTML (Article + FAQPage JSON-LD, h1,
// canonical) AND the beginner-classes section as real server-rendered listings
// with crawlable /event/ links; under build-time prerender that section shipped
// empty. The loader and LiveEventsSection share ONE key + fetcher
// (@/lib/seoLandingEvents), so the dehydrated entry is by construction the entry
// the client hook reads. NOTE the window is the FULL 28-day list -- classesOnly
// filters at render time, so the loader must not narrow it or the keys diverge.
export async function loader() {
  const qc = createQueryClient();

  // The London day this document was rendered on. It ships to the client and
  // pins the first render's window -- see LiveEventsSectionProps.serverTodayKey.
  // One helper: it derives that key, fills the cache via fetchQuery (NOT
  // prefetchQuery -- a transient RPC error must THROW out of the loader, so the
  // 500 carries no Vercel-Cache-Tag and cacheHeaders leaves it uncached rather
  // than edge-caching an empty listing for an hour; mirrors /festivals), and
  // reports how much of the pinned day is left.
  const { todayKey, edgeTtlBoundSeconds } = await loadSeoLandingDay(
    qc,
    SEO_LANDING_WINDOWS.learn,
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

export const meta: Route.MetaFunction = () => seoInputToMeta(SEO_INPUT);

// Edge-cache the SSR response + forward the loader's Vercel-Cache-Tag for
// on-demand purge on event/festival writes. Mirrors festivals.tsx.
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return cacheHeaders(loaderHeaders);
}

export default function LearnBachataLondonRoute({ loaderData }: Route.ComponentProps) {
  return (
    <HydrationBoundary state={loaderData.dehydratedState}>
      <InitialVisiblePageTransition>
        <LearnBachataLondon serverTodayKey={loaderData.todayKey} />
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
