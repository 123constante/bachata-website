import { VenueGalleryLightbox } from './VenueGalleryLightbox';

/**
 * Venue hero — pass-through wrapper around VenueGalleryLightbox.
 *
 * Decided 2026-04-30 (Ricky): cover image stays exactly as it is,
 * no colour overlay, no gradient. The wrapper is kept (not inlined
 * back) so future presentation tweaks have a stable mount point
 * without re-touching VenueEntity.tsx.
 *
 * Layout, ratios, lightbox open/close behaviour all unchanged from
 * VenueGalleryLightbox itself.
 */
export const VenueHero = ({
  allImages,
  venueName,
}: {
  allImages: string[];
  venueName: string;
}) => <VenueGalleryLightbox allImages={allImages} venueName={venueName} />;

export default VenueHero;
