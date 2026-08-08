import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { supabase } from "@/integrations/supabase/client";
import { dateKeyInTz } from "@/lib/londonDate";
import { buildSeoForRoute, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { festivalDetailQueryKey, fetchFestivalDetail } from "@/modules/event-page/useFestivalDetailQuery";
import { festivalEventQueryKey, fetchFestivalEventRow } from "@/modules/event-page/festivalEventQuery";
// Aliased: the page component below is also called FestivalDetail.
import type { FestivalDetail as FestivalDetailData } from "@/modules/event-page/types";
import FestivalDetail from "@/pages/FestivalDetail";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import {
  resolveEntityInLoader,
  throwDetailNotFound,
  cacheHeaders,
  taggedData,
  redirectUuidToSlug,
  resolveOgCardImage,
} from "../detailLoader";
import { stampFestival } from "../cacheTags";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/festival";

// /festival/:id — resolves events slug→uuid then prefetches the three queries
// FestivalDetail mounts (festival-event basic row, festival-snapshot event_view_p5,
// and the parsed festival-detail via the shared exported key + parser), so the
// cinematic page SSRs with content. 404+noindex when the id isn't a live festival.
export async function loader({ params, request }: Route.LoaderArgs) {
  const qc = createQueryClient();
  const ref = await resolveEntityInLoader(qc, "events", params.id);
  if (!ref.id) throwDetailNotFound("Festival");
  redirectUuidToSlug(ref, request, "/festival");
  const eventId = ref.id as string;

  // festival-event is the GATING query (drives the 404). Use fetchQuery (not
  // prefetchQuery, which swallows errors) so a TRANSIENT supabase error
  // propagates → retryable 500, not a 404+noindex of a live festival. null =
  // genuine miss / not-a-festival → 404. See app/routes/event.tsx.
  const [festival] = await Promise.all([
    qc.fetchQuery({
      queryKey: festivalEventQueryKey(eventId),
      queryFn: () => fetchFestivalEventRow(eventId),
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
      // Shared fetcher = same RPC (_v2) + same parse as the client hook, so the
      // dehydrated entry matches what the client would fetch byte-for-byte.
      queryFn: async () => fetchFestivalDetail(eventId),
      staleTime: 1000 * 60,
    }),
  ]);

  if (!festival) throwDetailNotFound("Festival");

  // "Today" on the FESTIVAL's own calendar, for the hero's days-away label.
  //
  // Derived here rather than in the component because the label is clock-read:
  // rendered client-side only it can never appear in the crawled HTML, and
  // rendered without a pinned key it straddles midnight between the server and
  // hydration (#418). Reading the zone back off the prefetch above costs no
  // extra request. The `?? "Europe/London"` mirrors FestivalDetail's own
  // eventTz default EXACTLY -- if the two ever disagree the server and client
  // derive different keys and the pin becomes the bug it exists to prevent.
  // (dateKeyInTz also falls back to London on a missing/invalid zone.)
  const detail = qc.getQueryData(festivalDetailQueryKey(eventId)) as FestivalDetailData | null;
  const todayKey = dateKeyInTz(new Date(), detail?.dates?.timezone ?? "Europe/London");

  // Phase 5 — normalize og:image/twitter:image (prefer the R2-baked festival card,
  // else a live /api/og/card render) so WhatsApp/Facebook/Twitter/LinkedIn always
  // get a renderable JPEG instead of a raw (often WebP) poster URL. The schema.org
  // JSON-LD `image` (buildEventJsonLd, rendered by FestivalDetail) is unaffected —
  // Google's structured-data parser handles WebP fine. Mirrors app/routes/event.tsx
  // and lets middleware.ts's /festival matcher be retired.
  const ogImage = await resolveOgCardImage({
    entityType: "festival",
    entityId: eventId,
    coverUrl: (festival.poster_url as string | null) ?? undefined,
    request,
    fallbackImage: DEFAULT_OG_IMAGE,
  });

  return taggedData(
    {
      dehydratedState: dehydrate(qc),
      entityName: (festival.name as string | null) ?? undefined,
      entitySlug: ref.slug ?? params.id,
      cityDisplay: (festival.city as string | null) ?? undefined,
      ogImage,
      todayKey,
    },
    // The same events.id is reachable at /event/:id AND /festival/:id, so tag
    // both surfaces — a single edit to that row purges both pages.
    stampFestival(eventId),
  );
}

// Phase 4a ISR — edge-cache + forward the loader's cache tag (see ../detailLoader).
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return cacheHeaders(loaderHeaders);
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
        <FestivalDetail serverTodayKey={loaderData.todayKey} />
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
