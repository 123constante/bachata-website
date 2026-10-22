import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "react-router";
import { flags } from "@/lib/featureFlags";
import { fetchBadges } from "@/modules/person-page/badges";
import { personPageRedirect } from "@/modules/person-page/hub/model";
import { createServerQueryClient } from "@/App";
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_ORIGIN, type SeoInput } from "@/lib/seo";
import PersonPage from "@/modules/person-page/PersonPage";
import { DEGRADED_EDGE_TTL_SECONDS, loadPublicPageV2 } from "@/modules/dancer-app/public-page/loadPublicPage";
import { loadPersonSnapshot } from "@/modules/person-page/reads";
import { ROLE_PAGE_BASE, strongestRole } from "@/modules/person-page/personRoles";
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
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/people";

// /people/:id -- one page per person, roles as tabs (search v7). The id is the
// persona id the old /teachers, /djs and /dancers pages take. The loader runs the
// SAME public reads those pages use (see modules/person-page/reads.ts); an unknown
// or non-public id gets the same 404 + noindex treatment as they do.
// See app/lib/ssrLoaderTimeout.ts -- #425.
export const loader = withSsrLoaderTimeout("person-loader", async function loaderImpl({
  params,
  request,
}: Route.LoaderArgs) {
  const qc = createServerQueryClient();
  const ref = await resolveEntityInLoader(qc, "dancer_profiles", params.id);
  if (!ref.id) throwDetailNotFound("Person");
  redirectUuidToSlug(ref, request, "/people");

  // Public page v2 for the Dancing tab, exactly as app/routes/dancers.tsx loads it (same
  // deadline; never rejects): the tab then matches /dancers/:id. page null (flag closed or
  // read failed) = the classic embedded grid.
  const publicPageLoad = loadPublicPageV2(ref.id as string);

  // flags.personHub: this person's badges row (the wall's read, same key shape), so the hub knows on first
  // paint whether a DJ gig leads and never swaps its cards when the gig list lands. Never rejects.
  const badgeLoad = flags.personHub
    ? qc.prefetchQuery({ queryKey: ["people-badges", [ref.id]], queryFn: () => fetchBadges([ref.id as string]), staleTime: 5 * 60 * 1000 })
    : Promise.resolve();

  const person = await loadPersonSnapshot(qc, ref.id as string);
  // W2-D: only people with two or more HELD roles see the hub; everyone else goes straight to the page the
  // wall tile opens (personDestination, the ONE rule). A redirect, so Back never bounces through /people.
  if (person && flags.personHub) {
    const to = personPageRedirect(person, { teacherPagesOpen: flags.teacherDetail }, ref.slug ?? params.id);
    if (to) throw redirect(to);
  }
  if (!person || person.roles.length === 0) throwDetailNotFound("Person");
  const [{ page: publicPage, degraded }] = await Promise.all([publicPageLoad, badgeLoad]);

  return taggedData(
    {
      dehydratedState: dehydrate(qc),
      person,
      publicPage,
      slugOrId: ref.slug ?? params.id,
      ogImage: normalizeOgImage({
        rawUrl: person.avatarUrl ?? person.djPhoto,
        request,
        fallbackImage: DEFAULT_OG_IMAGE,
      }),
    },
    stampDancer(ref.id),
    // A failed flag / extras read is cached briefly, never for the full edge TTL.
    degraded ? { edgeTtlBoundSeconds: DEGRADED_EDGE_TTL_SECONDS } : undefined,
  );
});

// Phase 4a ISR -- edge-cache + forward the loader's cache tag (see ../detailLoader).
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return cacheHeaders(loaderHeaders);
}

// noindex until the owner approves otherwise; canonical = the person's strongest
// role page, so no ranking signal splits onto /people. Not in any sitemap.
export const meta: Route.MetaFunction = ({ data }) => {
  if (!data) {
    return [{ title: `Profile not found | ${SITE_NAME}` }, { name: "robots", content: "noindex,nofollow" }];
  }
  const { person, slugOrId } = data;
  const role = strongestRole(person.roles);
  const name = person.name ?? "Bachata Calendar profile";
  const seo: SeoInput = {
    title: `${name} - Bachata Calendar`,
    description: `${name} on Bachata Calendar: ${person.roles
      .map((r) => ({ teacher: "teacher", dj: "DJ", dancer: "dancer" })[r])
      .join(", ")}.`,
    canonical: `${SITE_ORIGIN}${role ? ROLE_PAGE_BASE[role] : "/dancers"}/${slugOrId}`,
    ogImage: data.ogImage,
    ogType: "profile",
    noindex: true,
  };
  return seoInputToMeta(seo);
};

export default function PeopleRoute({ loaderData, params }: Route.ComponentProps) {
  return (
    <HydrationBoundary state={loaderData.dehydratedState}>
      <InitialVisiblePageTransition key={params.id}>
        <PersonPage person={loaderData.person} slugOrId={loaderData.slugOrId} publicPage={loaderData.publicPage} />
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
