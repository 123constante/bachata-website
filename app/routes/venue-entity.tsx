import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import ComingSoonGate from "@/components/ComingSoonGate";
import { flags } from "@/lib/featureFlags";
import { createQueryClient } from "@/App";
import { buildSeoForRoute } from "@/lib/seo";
import { fetchPublicVenue } from "@/services/venuePublicService";
import VenueEntity from "@/pages/VenueEntity";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { resolveEntityInLoader, throwDetailNotFound } from "../detailLoader";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/venue-entity";

// Gated detail route (flags.venueDetail — off in prod). Mirrors VenueEntity's
// ['public-venue', id] query (fetchPublicVenue) + dehydrates → content SSRs.
export async function loader({ params }: Route.LoaderArgs) {
  if (!flags.venueDetail) return { locked: true as const };

  const qc = createQueryClient();
  const ref = await resolveEntityInLoader(qc, "venues", params.id);
  if (!ref.id) throwDetailNotFound("Venue");

  let venue: Awaited<ReturnType<typeof fetchPublicVenue>>;
  try {
    venue = await qc.fetchQuery({
      queryKey: ["public-venue", ref.id],
      queryFn: () => fetchPublicVenue(ref.id as string),
    });
  } catch {
    throwDetailNotFound("Venue");
  }
  if (!venue) throwDetailNotFound("Venue");

  const img = venue.image_url;
  return {
    locked: false as const,
    dehydratedState: dehydrate(qc),
    entityName: venue.name,
    entitySlug: ref.slug ?? params.id,
    cityDisplay: venue.city_name ?? undefined,
    ogImage: (Array.isArray(img) ? img[0] : img) ?? undefined,
  };
}

export const meta: Route.MetaFunction = ({ data }) => {
  if (!data || data.locked) {
    return [
      { title: "Coming soon — Venue — Bachata Calendar" },
      { name: "robots", content: "noindex,nofollow" },
    ];
  }
  return seoInputToMeta(
    buildSeoForRoute("venue.detail", {
      entityName: data.entityName,
      entitySlug: data.entitySlug,
      cityDisplay: data.cityDisplay,
      ogImage: data.ogImage,
    }),
  );
};

export default function VenueEntityRoute({ loaderData, params }: Route.ComponentProps) {
  const gate = (
    <ComingSoonGate enabled={flags.venueDetail} title="Venue" section="venue_detail">
      <InitialVisiblePageTransition key={params.id}>
        <VenueEntity />
      </InitialVisiblePageTransition>
    </ComingSoonGate>
  );
  return loaderData?.locked ? (
    gate
  ) : (
    <HydrationBoundary state={loaderData.dehydratedState}>{gate}</HydrationBoundary>
  );
}
