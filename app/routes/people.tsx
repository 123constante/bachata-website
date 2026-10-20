import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createServerQueryClient } from "@/App";
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_ORIGIN, type SeoInput } from "@/lib/seo";
import PersonPage from "@/modules/person-page/PersonPage";
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

  const person = await loadPersonSnapshot(qc, ref.id as string);
  if (!person || person.roles.length === 0) throwDetailNotFound("Person");

  return taggedData(
    {
      dehydratedState: dehydrate(qc),
      person,
      slugOrId: ref.slug ?? params.id,
      ogImage: normalizeOgImage({
        rawUrl: person.avatarUrl ?? person.djPhoto,
        request,
        fallbackImage: DEFAULT_OG_IMAGE,
      }),
    },
    stampDancer(ref.id),
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
        <PersonPage person={loaderData.person} slugOrId={loaderData.slugOrId} />
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
