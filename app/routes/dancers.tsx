import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createServerQueryClient } from "@/App";
import { supabase } from "@/integrations/supabase/client";
import { buildSeoForRoute, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { personCardPhoto } from "@/lib/seo/personCard";
import { DANCER_PUBLIC_COLS, attachPublicDancerName, mapDancerPublicProfile } from "@/modules/profile/dancerPublicProfile";
import { NOT_DEACTIVATED } from "@/lib/notDeactivatedFilter";
import { flags } from "@/lib/featureFlags";
import { seedPersonSnapshot } from "@/modules/person-page/seedPersonSnapshot";
import DancerProfile from "@/pages/DancerProfile";
import { DEGRADED_EDGE_TTL_SECONDS, PUBLIC_PAGE_DEADLINE_MS, loadPublicPageV2 } from "@/modules/dancer-app/public-page/loadPublicPage";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import {
  resolveEntityInLoader,
  throwDetailNotFound,
  cacheHeaders,
  taggedData,
  redirectUuidToSlug,
  normalizeOgImage,
} from "../detailLoader";
import { withSsrLoaderTimeout } from "../lib/ssrLoaderTimeout";
import { stampDancer } from "../cacheTags";
import { personPageTtlBound } from "../personPageTtl";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/dancers";

// See app/lib/ssrLoaderTimeout.ts -- #425.
export const loader = withSsrLoaderTimeout("dancer-loader", async function loaderImpl({
  params,
  request,
}: Route.LoaderArgs) {
  const qc = createServerQueryClient();
  const ref = await resolveEntityInLoader(qc, "dancer_profiles", params.id);
  if (!ref.id) throwDetailNotFound("Dancer");
  redirectUuidToSlug(ref, request, "/dancers");

  // Public page v2 (dancer rebuild W2f): decided HERE so the server HTML and the
  // first paint agree. Started beside today's read below; it never rejects and
  // has its own deadline. Inside it the extras are read only once the flag says
  // open (never fetched-then-dropped). page null (flag closed, or the read failed) = today's
  // page. It changes the BODY only: entityName / entitySlug / ogImage, and so
  // meta(), are computed exactly as before in both modes.
  const publicPageLoad = loadPublicPageV2(ref.id as string);

  // Return null on a genuine miss (→ 404 below) but let a TRANSIENT supabase
  // error propagate — a swallowing catch would 404+noindex a valid dancer on a
  // DB blip (mirrors app/routes/event.tsx).
  const dancerRead = qc.fetchQuery({
    queryKey: ["dancer-profile", ref.id],
    queryFn: async () => {
      // Must match app/routes/sitemap.tsx's fetchDancerProfiles() gate exactly --
      // otherwise a deactivated profile is either sitemapped-but-404 or
      // resolvable-but-unsitemapped, the same soft-404/discovery mismatch class
      // this branch closes elsewhere. 0 rows are is_active = false today.
      const { data, error } = await supabase
        .from("dancer_profiles")
        .select(DANCER_PUBLIC_COLS)
        .eq("id", ref.id as string)
        .not(...NOT_DEACTIVATED)
        .maybeSingle();
      if (error) throw error;
      return data ? ((await attachPublicDancerName(data)) as Record<string, unknown>) : null;
    },
    staleTime: 1000 * 60 * 5,
  });
  // People arc S7 (flags.personWorlds only): the person's roles, read beside the reads here and
  // seeded into the dehydrated cache so the served HTML holds the role tabs and the preview reserve.
  // Started AFTER the dancer read above is issued, so ['dancer-profile'] runs THIS file's query body
  // (the snapshot's own dancer read joins it). Never rejects, own deadline; a miss = the hook reads
  // after mount. Meta unchanged; the tag and edge TTL change below (S7b).
  const rolesSeed = flags.personWorlds ? seedPersonSnapshot(qc, ref.id as string, PUBLIC_PAGE_DEADLINE_MS) : null;
  const dancer = await dancerRead;
  if (!dancer) throwDetailNotFound("Dancer");

  const view = mapDancerPublicProfile(dancer as never);
  const { page: publicPage, degraded } = await publicPageLoad;
  // false = the seed failed or missed its deadline: the page is served without tabs (S7b); or it
  // answered partial: seeded, but a tab may be missing (S7c).
  const snapshotComplete = rolesSeed ? await rolesSeed : true;
  return taggedData(
    {
      dehydratedState: dehydrate(qc),
      publicPage,
      // `?? undefined` is load-bearing, not tidiness: buildSeoForRoute noindexes a
      // .detail route on a FALSY entityName, so a nameless dancer must arrive as
      // undefined. resolvePublicName already refuses to invent one (it returns
      // null rather than "Dancer" or an id), and this is where that null turns
      // into the routing decision Ricky chose -- 200 + noindex, not a 404, so an
      // existing link into a thin profile still resolves.
      entityName: view.displayName ?? undefined,
      entitySlug: ref.slug ?? params.id,
      // S5: the person's own city on the card (was always London).
      entityCity: view.city ?? null,
      // Phase 5 — normalize og:image through /api/og/card?kind=image (letterboxed
      // JPEG) so WebP/oversized avatars still render as social link-preview cards.
      // Mirrors middleware.ts's ogNormalizedImage; lets the /dancers matcher be retired.
      ogImage: normalizeOgImage({ rawUrl: personCardPhoto(null, dancer.avatar_url), request, fallbackImage: DEFAULT_OG_IMAGE }),
    },
    // S7b: with the role tabs served, a DJ or teacher write must purge this page too.
    stampDancer(ref.id, flags.personWorlds),
    // A failed flag / extras read, or a roles seed that did not answer completely, is cached briefly,
    // never for the full edge TTL.
    personPageTtlBound(degraded, snapshotComplete, DEGRADED_EDGE_TTL_SECONDS),
  );
});

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
      cityDisplay: data?.entityCity,
    }),
  );

export default function DancerRoute({ loaderData, params }: Route.ComponentProps) {
  return (
    <HydrationBoundary state={loaderData.dehydratedState}>
      <InitialVisiblePageTransition key={params.id}>
        <DancerProfile publicPage={loaderData.publicPage} />
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
