import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { supabase } from "@/integrations/supabase/client";
import { buildSeoForRoute, DEFAULT_OG_IMAGE } from "@/lib/seo";
import DJProfile from "@/pages/DJProfile";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import {
  resolveEntityInLoader,
  throwDetailNotFound,
  cacheHeaders,
  taggedData,
  redirectUuidToSlug,
  normalizeOgImage,
} from "../detailLoader";
import { resolvePublicName } from "@/lib/publicName";
import { stampDj } from "../cacheTags";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/djs";

export async function loader({ params, request }: Route.LoaderArgs) {
  const qc = createQueryClient();
  const ref = await resolveEntityInLoader(qc, "dancer_profiles", params.id);
  if (!ref.id) throwDetailNotFound("DJ");
  redirectUuidToSlug(ref, request, "/djs");

  // Mirrors DJProfile's ['dj-profile', id] query (get_public_dj_v1 → raw cast).
  // null = genuine miss (→ 404); a transient error propagates (→ retryable 500,
  // not a 404+noindex of a valid DJ). See app/routes/event.tsx.
  const dj = await qc.fetchQuery({
    queryKey: ["dj-profile", ref.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_dj_v1", { p_dj_id: ref.id as string });
      if (error) throw error;
      return (data as unknown as Record<string, unknown> | null) ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
  if (!dj) throwDetailNotFound("DJ");

  const photo = dj.photo_url;
  const rawPhoto = (Array.isArray(photo) ? photo[0] : photo) as string | null | undefined;
  return taggedData(
    {
      dehydratedState: dehydrate(qc),
      // NOT dj.display_name directly: get_public_dj_v1's COALESCE ends in
      // dp.id::text, so that field is the row's UUID for a profile named only in
      // dancer_profiles.display_name — and a UUID is truthy, so it sailed past
      // buildSeoForRoute's noindex and became the indexed <title>. resolvePublicName
      // returns null there, which noindexes the page instead. Mirrors DJProfile.
      entityName: resolvePublicName(dj as Parameters<typeof resolvePublicName>[0]) ?? undefined,
      entitySlug: ref.slug ?? params.id,
      // Phase 5 — normalize og:image through /api/og/card?kind=image (letterboxed
      // JPEG) so WebP/oversized DJ photos still render as social link-preview
      // cards. Mirrors middleware.ts's ogNormalizedImage; lets the /djs matcher
      // be retired.
      ogImage: normalizeOgImage({ rawUrl: rawPhoto, request, fallbackImage: DEFAULT_OG_IMAGE }),
    },
    stampDj(ref.id),
  );
}

// Phase 4a ISR — edge-cache + forward the loader's cache tag (see ../detailLoader).
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return cacheHeaders(loaderHeaders);
}

export const meta: Route.MetaFunction = ({ data }) =>
  seoInputToMeta(
    buildSeoForRoute("dj.detail", {
      entityName: data?.entityName,
      entitySlug: data?.entitySlug,
      ogImage: data?.ogImage,
    }),
  );

export default function DJRoute({ loaderData, params }: Route.ComponentProps) {
  return (
    <HydrationBoundary state={loaderData.dehydratedState}>
      <InitialVisiblePageTransition key={params.id}>
        <DJProfile />
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
