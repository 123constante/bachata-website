import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { supabase } from "@/integrations/supabase/client";
import { buildSeoForRoute } from "@/lib/seo";
import { festivalDetailQueryKey, parseFestivalDetail } from "@/modules/event-page/useFestivalDetailQuery";
import FestivalDetail from "@/pages/FestivalDetail";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { resolveEntityInLoader, throwDetailNotFound } from "../detailLoader";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/festival";

// /festival/:id — resolves events slug→uuid then prefetches the three queries
// FestivalDetail mounts (festival-event basic row, festival-snapshot event_view_p5,
// and the parsed festival-detail via the shared exported key + parser), so the
// cinematic page SSRs with content. 404+noindex when the id isn't a live festival.
export async function loader({ params }: Route.LoaderArgs) {
  const qc = createQueryClient();
  const ref = await resolveEntityInLoader(qc, "events", params.id);
  if (!ref.id) throwDetailNotFound("Festival");
  const eventId = ref.id as string;

  await Promise.all([
    qc.prefetchQuery({
      queryKey: ["festival-event", eventId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("events")
          .select("id, name, city, date, start_time, poster_url, description, ticket_url, faq, meta_data")
          .eq("id", eventId)
          .eq("type", "festival")
          .maybeSingle();
        if (error) throw error;
        return data;
      },
    }),
    qc.prefetchQuery({
      queryKey: ["festival-snapshot", eventId],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("event_view_p5" as never, {
          p_target: { series_id: eventId },
          p_viewer: { role: "anon", shape: "snapshot_compat" },
        } as never);
        if (error) throw error;
        return data as Record<string, unknown> | null;
      },
    }),
    qc.prefetchQuery({
      queryKey: festivalDetailQueryKey(eventId),
      queryFn: async () => {
        const { data, error } = await supabase.rpc("get_public_festival_detail", { p_event_id: eventId });
        if (error) throw error;
        return parseFestivalDetail(data);
      },
      staleTime: 1000 * 60,
    }),
  ]);

  const festival = qc.getQueryData(["festival-event", eventId]) as Record<string, unknown> | null;
  if (!festival) throwDetailNotFound("Festival");

  return {
    dehydratedState: dehydrate(qc),
    entityName: (festival.name as string | null) ?? undefined,
    entitySlug: ref.slug ?? params.id,
    cityDisplay: (festival.city as string | null) ?? undefined,
    ogImage: (festival.poster_url as string | null) ?? undefined,
  };
}

export const meta: Route.MetaFunction = ({ data }) =>
  seoInputToMeta(
    buildSeoForRoute("festival.detail", {
      entityName: data?.entityName,
      entitySlug: data?.entitySlug,
      cityDisplay: data?.cityDisplay,
      ogImage: data?.ogImage,
    }),
  );

export default function FestivalRoute({ loaderData, params }: Route.ComponentProps) {
  return (
    <HydrationBoundary state={loaderData.dehydratedState}>
      <InitialVisiblePageTransition key={params.id}>
        <FestivalDetail />
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
