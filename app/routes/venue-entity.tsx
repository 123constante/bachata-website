import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import ComingSoonGate from "@/components/ComingSoonGate";
import { flags } from "@/lib/featureFlags";
import { createQueryClient } from "@/App";
import { buildSeoForRoute, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { fetchPublicVenue } from "@/services/venuePublicService";
import VenueEntity from "@/pages/VenueEntity";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import {
  resolveEntityInLoader,
  throwDetailNotFound,
  cacheHeaders,
  taggedData,
  redirectUuidToSlug,
  normalizeOgImage,
} from "../detailLoader";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/venue-entity";

// Gated detail route (flags.venueDetail — off in prod). Mirrors VenueEntity's
// ['public-venue', id] query (fetchPublicVenue) + dehydrates → content SSRs.
export async function loader({ params, request }: Route.LoaderArgs) {
  // Locked: flag-derived, identical for every id, busts on the next deploy.
  // Cache it with a coarse group tag only.
  if (!flags.venueDetail) return taggedData({ locked: true as const }, "venues");

  const qc = createQueryClient();
  const ref = await resolveEntityInLoader(qc, "venues", params.id);
  if (!ref.id) throwDetailNotFound("Venue");
  redirectUuidToSlug(ref, request, "/venue-entity");

  // null = genuine miss (→ 404); a transient error propagates (→ retryable 500,
  // not a 404+noindex of a valid venue). See app/routes/event.tsx.
  const venue = await qc.fetchQuery({
    queryKey: ["public-venue", ref.id],
    queryFn: () => fetchPublicVenue(ref.id as string),
  });
  if (!venue) throwDetailNotFound("Venue");

  const img = venue.image_url;
  const rawCover = (Array.isArray(img) ? img[0] : img) ?? null;
  // Phase 5 — normalize og:image/twitter:image through /api/og/card?kind=image
  // (a letterboxed JPEG) so WebP/oversized venue photos still render as social
  // link-preview cards. Mirrors middleware.ts's ogNormalizedImage (venues get the
  // simple normalize, not the branded event/festival R2-bake), and lets the
  // /venue-entity matcher be retired. The buildVenueJsonLd structured data
  // (rendered by VenueEntity) is unaffected — it isn't a social-card image.
  return taggedData(
    {
      locked: false as const,
      dehydratedState: dehydrate(qc),
      entityName: venue.name,
      entitySlug: ref.slug ?? params.id,
      cityDisplay: venue.city_name ?? undefined,
      ogImage: normalizeOgImage({ rawUrl: rawCover, request, fallbackImage: DEFAULT_OG_IMAGE }),
    },
    // NOTE: ref.id = venues.id (this route resolves by PK). The Phase-2 DB emit
    // must match this id (see the plan's venue entity_id-vs-id open item).
    `venue-${ref.id},venues`,
  );
}

// Phase 4a ISR — edge-cache + forward the loader's cache tag (see ../detailLoader).
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return cacheHeaders(loaderHeaders);
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
