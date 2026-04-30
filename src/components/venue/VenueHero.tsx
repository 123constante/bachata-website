import { VenueGalleryLightbox } from './VenueGalleryLightbox';

/**
 * Venue hero — thin presentation wrapper around VenueGalleryLightbox.
 *
 * Adds a subtle bottom-up venue-spice gradient on the LEFT cover photo
 * (the 3fr column of the 3fr/2fr grid) so overlays stay legible
 * regardless of the photo's brightness. The +N counter, focus rings,
 * and any future at-a-glance pills positioned over the photo will sit
 * on this gentle ink lift instead of fighting the underlying image.
 *
 * Deliberately no name overlay — the locked page-header already carries
 * the venue title and any duplicate would look amateur. The lightbox
 * itself is preserved exactly as Ricky designed it; this wrapper only
 * stamps an absolute-positioned gradient. Layout, ratios, click
 * behaviour, and lightbox open/close are all untouched.
 *
 * For 2+ images: the gallery uses `grid-cols-[3fr_2fr] gap-1.5`, so the
 * left cover takes ~60% width. The overlay is sized to match (slightly
 * less to avoid bleeding into the gap).
 *
 * For 1 image: overlay covers the full width since the gallery renders
 * the single image edge-to-edge.
 *
 * For 0 images: placeholder gradient already lives in the lightbox; no
 * additional overlay (would double up).
 */
export const VenueHero = ({
  allImages,
  venueName,
}: {
  allImages: string[];
  venueName: string;
}) => {
  if (allImages.length === 0) {
    return <VenueGalleryLightbox allImages={allImages} venueName={venueName} />;
  }

  // Match the lightbox grid: 3fr/2fr with a 6px gap → left cover is
  // roughly 59-60% of total width minus a sliver of the gap. For a
  // single image, the overlay covers the full width.
  const overlayWidthPct = allImages.length >= 2 ? '59%' : '100%';

  return (
    <div className="relative">
      <VenueGalleryLightbox allImages={allImages} venueName={venueName} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-[35%] rounded-bl-xl"
        style={{
          width: overlayWidthPct,
          background:
            'linear-gradient(to top, hsl(var(--venue-spice) / 0.55), transparent)',
        }}
      />
    </div>
  );
};

export default VenueHero;
