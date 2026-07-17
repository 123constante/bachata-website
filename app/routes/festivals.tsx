import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { FESTIVALS_LIST_QUERY_KEY, fetchPublicFestivalsList } from "@/lib/festivalsList";
import { buildSeoForRoute } from "@/lib/seo";
import FestivalHub from "@/pages/FestivalHub";
import { stampFestivalsList } from "../cacheTags";
import { cacheHeaders, taggedData } from "../detailLoader";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/festivals";

// Framework route for /festivals — on-demand SSR + tagged ISR (moved off
// build-time prerender, which froze the dehydrated festival list at deploy time).
// The loader and FestivalHub share ONE fetcher and ONE key (@/lib/festivalsList),
// so the dehydrated entry the document ships is by construction the entry the client
// hook reads — no byte-for-byte mirroring to keep in sync by hand. Edge-cached on
// s-maxage and purged on any festival write via the `festivals-list` cache tag (see
// api.revalidate tagsFor + the Supabase webhook). Secondary attendance queries stay
// client-only.
export async function loader() {
  const qc = createQueryClient();

  // fetchQuery (NOT prefetchQuery) so a transient error THROWS out of the loader
  // → 500 with no Vercel-Cache-Tag → cacheHeaders leaves it uncached, instead of
  // edge-caching an empty festival list for an hour. Mirrors the detail routes.
  await qc.fetchQuery({
    queryKey: FESTIVALS_LIST_QUERY_KEY,
    queryFn: fetchPublicFestivalsList,
    staleTime: 1000 * 60 * 2,
  });

  return taggedData({ dehydratedState: dehydrate(qc) }, stampFestivalsList());
}

export const meta: Route.MetaFunction = () => seoInputToMeta(buildSeoForRoute("festivals"));

// Edge-cache the SSR response + forward the loader's Vercel-Cache-Tag for
// on-demand purge on festival writes. Mirrors the detail routes (event.tsx).
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return cacheHeaders(loaderHeaders);
}

export default function FestivalsRoute({ loaderData }: Route.ComponentProps) {
  return (
    <HydrationBoundary state={loaderData.dehydratedState}>
      <InitialVisiblePageTransition>
        <FestivalHub />
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
