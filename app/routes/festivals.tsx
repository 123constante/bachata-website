import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { supabase } from "@/integrations/supabase/client";
import { buildSeoForRoute } from "@/lib/seo";
import FestivalHub from "@/pages/FestivalHub";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/festivals";

// Framework route for /festivals — prerendered to static HTML at build time
// (see react-router.config.ts `prerender`). The loader mirrors FestivalHub's
// primary content query (['festival-events-live']) byte-for-byte and dehydrates
// it, so the static document ships the festival list (SEO) without a client
// refetch. Secondary attendance queries stay client-only (user-gated / dynamic).
export async function loader() {
  const qc = createQueryClient();

  await qc.prefetchQuery({
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

  return { dehydratedState: dehydrate(qc) };
}

export const meta: Route.MetaFunction = () => seoInputToMeta(buildSeoForRoute("festivals"));

export default function FestivalsRoute({ loaderData }: Route.ComponentProps) {
  return (
    <HydrationBoundary state={loaderData.dehydratedState}>
      <InitialVisiblePageTransition>
        <FestivalHub />
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
