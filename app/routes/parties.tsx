import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createServerQueryClient } from "@/App";
import { buildSeoForRoute } from "@/lib/seo";
import { SEO_LANDING_WINDOWS, loadSeoLandingDay } from "@/lib/seoLandingEvents";
import Parties from "@/pages/Parties";
import { stampSeoLanding } from "../cacheTags";
import { cacheHeaders, taggedData } from "../detailLoader";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { withSsrLoaderTimeout } from "../lib/ssrLoaderTimeout";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/parties";

// Framework route for /parties -- on-demand SSR + tagged ISR (site structure S2c,
// 2026-11-26). It used to be build-time prerendered, and the EventCalendar on it
// is client-only (mount-gated), so the indexed HTML carried ZERO event links.
// The loader now dehydrates the London "this week" list that the page's
// LiveEventsSection reads, so crawlers get real, crawlable /event/ links. Same
// pattern as routes/learn-bachata-london.tsx: ONE key + fetcher from
// @/lib/seoLandingEvents (window SEO_LANDING_WINDOWS.guide = 7 days, the same
// entry /london-bachata-guide uses), fetchQuery inside loadSeoLandingDay so an
// RPC error throws and the 500 is not edge-cached, and an edge TTL bounded to
// the London day the list was rendered for. partiesOnly filters at render time, so
// the loader must not narrow the window or the keys diverge.
export const loader = withSsrLoaderTimeout("parties-loader", async function loaderImpl() {
  const qc = createServerQueryClient();
  const { todayKey, edgeTtlBoundSeconds } = await loadSeoLandingDay(
    qc,
    SEO_LANDING_WINDOWS.guide,
  );
  return taggedData({ dehydratedState: dehydrate(qc), todayKey }, stampSeoLanding(), {
    edgeTtlBoundSeconds,
  });
});

export const meta: Route.MetaFunction = () => seoInputToMeta(buildSeoForRoute("parties"));

// Edge-cache the SSR response + forward the loader's Vercel-Cache-Tag for
// on-demand purge on event writes. Mirrors learn-bachata-london.tsx.
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return cacheHeaders(loaderHeaders);
}

export default function PartiesRoute({ loaderData }: Route.ComponentProps) {
  return (
    <HydrationBoundary state={loaderData.dehydratedState}>
      <InitialVisiblePageTransition>
        <Parties serverTodayKey={loaderData.todayKey} />
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
