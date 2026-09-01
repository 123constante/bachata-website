import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { supabase } from "@/integrations/supabase/client";
import { buildSeoForRoute, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { DANCER_PUBLIC_COLS, mapDancerPublicProfile } from "@/modules/profile/dancerPublicProfile";
import DancerProfile from "@/pages/DancerProfile";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import {
  resolveEntityInLoader,
  throwDetailNotFound,
  cacheHeaders,
  taggedData,
  redirectUuidToSlug,
  normalizeOgImage,
} from "../detailLoader";
import { stampDancer } from "../cacheTags";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/dancers";

export async function loader({ params, request }: Route.LoaderArgs) {
  const qc = createQueryClient();
  const ref = await resolveEntityInLoader(qc, "dancer_profiles", params.id);
  if (!ref.id) throwDetailNotFound("Dancer");
  redirectUuidToSlug(ref, request, "/dancers");

  // Return null on a genuine miss (→ 404 below) but let a TRANSIENT supabase
  // error propagate — a swallowing catch would 404+noindex a valid dancer on a
  // DB blip (mirrors app/routes/event.tsx).
  const dancer = await qc.fetchQuery({
    queryKey: ["dancer-profile", ref.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dancer_profiles")
        .select(DANCER_PUBLIC_COLS)
        .eq("id", ref.id as string)
        .maybeSingle();
      if (error) throw error;
      return (data as Record<string, unknown> | null) ?? null;
    },
    staleTime: 1000 * 60 * 5,
  });
  if (!dancer) throwDetailNotFound("Dancer");

  const view = mapDancerPublicProfile(dancer as never);
  return taggedData(
    {
      dehydratedState: dehydrate(qc),
      // `?? undefined` is load-bearing, not tidiness: buildSeoForRoute noindexes a
      // .detail route on a FALSY entityName, so a nameless dancer must arrive as
      // undefined. resolvePublicName already refuses to invent one (it returns
      // null rather than "Dancer" or an id), and this is where that null turns
      // into the routing decision Ricky chose -- 200 + noindex, not a 404, so an
      // existing link into a thin profile still resolves.
      entityName: view.displayName ?? undefined,
      entitySlug: ref.slug ?? params.id,
      // Phase 5 — normalize og:image through /api/og/card?kind=image (letterboxed
      // JPEG) so WebP/oversized avatars still render as social link-preview cards.
      // Mirrors middleware.ts's ogNormalizedImage; lets the /dancers matcher be retired.
      ogImage: normalizeOgImage({ rawUrl: dancer.avatar_url as string | null, request, fallbackImage: DEFAULT_OG_IMAGE }),
    },
    stampDancer(ref.id),
  );
}

// Phase 4a ISR — edge-cache + forward the loader's cache tag (see ../detailLoader).
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return cacheHeaders(loaderHeaders);
}

export const meta: Route.MetaFunction = ({ data }) =>
  seoInputToMeta(
    buildSeoForRoute("dancer.detail", {
      entityName: data?.entityName,
      entitySlug: data?.entitySlug,
      ogImage: data?.ogImage,
    }),
  );

export default function DancerRoute({ loaderData, params }: Route.ComponentProps) {
  return (
    <HydrationBoundary state={loaderData.dehydratedState}>
      <InitialVisiblePageTransition key={params.id}>
        <DancerProfile />
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
