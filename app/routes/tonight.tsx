import { useSyncExternalStore } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createServerQueryClient } from "@/App";
import { buildSeoForRoute } from "@/lib/seo";
import { SEO_LANDING_WINDOWS, loadSeoLandingDay } from "@/lib/seoLandingEvents";
import LiveEventsSection from "@/components/seo/LiveEventsSection";
import Tonight from "@/pages/Tonight";
import { stampSeoLanding } from "../cacheTags";
import { cacheHeaders, taggedData } from "../detailLoader";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { withSsrLoaderTimeout } from "../lib/ssrLoaderTimeout";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/tonight";

// Framework route for bare /tonight (site structure S2c-2, 2026-11-26). Before
// this it rode the catchall, which renders null on the server, so the indexed
// HTML had no heading and no event links. The Tonight page itself stays
// CLIENT-ONLY: it reads the visitor's stored city, the clock and geolocation,
// so server-rendering it would mismatch at hydration. Instead the server
// renders a London "this week" list (the SAME query entry /parties and
// /classes dehydrate: SEO_LANDING_WINDOWS.guide = 7 days), and after hydration
// the real page mounts and shows that list below its own cards for London.
// /city/:slug/tonight stays on the catchall (no loader, no list).
export const loader = withSsrLoaderTimeout("tonight-loader", async function loaderImpl() {
  const qc = createServerQueryClient();
  const { todayKey, edgeTtlBoundSeconds } = await loadSeoLandingDay(
    qc,
    SEO_LANDING_WINDOWS.guide,
  );
  return taggedData({ dehydratedState: dehydrate(qc), todayKey }, stampSeoLanding(), {
    edgeTtlBoundSeconds,
  });
});

export const meta: Route.MetaFunction = () => seoInputToMeta(buildSeoForRoute("tonight"));

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return cacheHeaders(loaderHeaders);
}

// Same gate as routes/catchall.tsx: false on the server AND on the hydration
// render (React uses the server snapshot), true right after. So the server
// list hydrates cleanly, then the client page replaces it.
const emptySubscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export default function TonightRoute({ loaderData }: Route.ComponentProps) {
  const hydrated = useHydrated();
  return (
    <HydrationBoundary state={loaderData.dehydratedState}>
      <InitialVisiblePageTransition>
        {hydrated ? (
          <Tonight serverTodayKey={loaderData.todayKey} />
        ) : (
          <main className="px-4 py-6">
            <h1 className="text-2xl font-bold mb-4">Bachata tonight in London</h1>
            <LiveEventsSection
              id="this-week"
              heading="Bachata in London this week"
              serverTodayKey={loaderData.todayKey}
            />
          </main>
        )}
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
