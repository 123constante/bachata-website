import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { supabase } from "@/integrations/supabase/client";
import { buildSeoForRoute } from "@/lib/seo";
import FestivalHub from "@/pages/FestivalHub";
import { cacheHeaders, taggedData } from "../detailLoader";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/festivals";

// Framework route for /festivals — on-demand SSR + tagged ISR (moved off
// build-time prerender, which froze the dehydrated festival list at deploy time).
// The loader mirrors FestivalHub's primary content query (['festival-events-live'])
// byte-for-byte and dehydrates it, so the document ships the festival list (SEO)
// without a client refetch. Edge-cached on s-maxage and purged on any festival
// write via the `festivals-list` cache tag (see api.revalidate tagsFor + the
// Supabase webhook). Secondary attendance queries stay client-only.
export async function loader() {
  const qc = createQueryClient();

  // fetchQuery (NOT prefetchQuery) so a transient error THROWS out of the loader
  // → 500 with no Vercel-Cache-Tag → cacheHeaders leaves it uncached, instead of
  // edge-caching an empty festival list for an hour. Mirrors the detail routes.
  await qc.fetchQuery({
    queryKey: ["festival-events-live"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, city, date, start_time, poster_url")
        .eq("type", "festival")
        .eq("is_active", true)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 2,
  });

  return taggedData({ dehydratedState: dehydrate(qc) }, "festivals-list");
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
