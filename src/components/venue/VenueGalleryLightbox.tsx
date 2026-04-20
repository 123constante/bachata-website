import { useState, useCallback } from 'react';
import { Building2, ChevronLeft, ChevronRight, X } from 'lucide-react';

const Lightbox = ({
  urls,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  urls: string[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) => (
  <div
    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
    onClick={onClose}
  >
    <button
      className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
      onClick={onClose}
      aria-label="Close"
    >
      <X className="h-5 w-5" />
    </button>
    {urls.length > 1 && (
      <button
        className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        aria-label="Previous"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
    )}
    {urls.length > 1 && (
      <button
        className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        aria-label="Next"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    )}
    <img
      src={`${urls[index]}?t=1`}
      alt={`Photo ${index + 1} of ${urls.length}`}
      className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
      onClick={(e) => e.stopPropagation()}
    />
    {urls.length > 1 && (
      <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60">
        {index + 1} / {urls.length}
      </span>
    )}
  </div>
);

export const VenueGalleryLightbox = ({
  allImages,
  venueName,
}: {
  allImages: string[];
  venueName: string;
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const close = useCallback(() => setLightboxIndex(null), []);
  const prev = useCallback(
    () => setLightboxIndex((i) => (i !== null ? (i - 1 + allImages.length) % allImages.length : null)),
    [allImages.length],
  );
  const next = useCallback(
    () => setLightboxIndex((i) => (i !== null ? (i + 1) % allImages.length : null)),
    [allImages.length],
  );

  if (allImages.length === 0) {
    return (
      <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20 flex items-center justify-center">
        <Building2 className="w-10 h-10 text-primary/40" />
      </div>
    );
  }

  if (allImages.length === 1) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          className="block w-full aspect-[16/9] overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <img
            src={`${allImages[0]}?t=1`}
            alt={`${venueName} cover`}
            className="h-full w-full object-cover object-center"
            loading="eager"
          />
        </button>
        {lightboxIndex !== null && (
          <Lightbox urls={allImages} index={lightboxIndex} onClose={close} onPrev={prev} onNext={next} />
        )}
      </>
    );
  }

  const showMore = allImages.length > 3;
  const moreCount = allImages.length - 3;
  const thumbTop = allImages[1];
  const thumbBottom = allImages[2];

  return (
    <>
      <div className="aspect-[16/9] grid grid-cols-[3fr_2fr] gap-1.5 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          className="overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <img
            src={`${allImages[0]}?t=1`}
            alt={`${venueName} cover`}
            className="h-full w-full object-cover object-center"
            loading="eager"
          />
        </button>

        <div className="grid grid-rows-2 gap-1.5">
          {thumbTop ? (
            <button
              type="button"
              onClick={() => setLightboxIndex(1)}
              className="overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <img
                src={`${thumbTop}?t=1`}
                alt={`${venueName} photo 2`}
                className="h-full w-full object-cover object-center"
                loading="lazy"
              />
            </button>
          ) : (
            <div aria-hidden="true" />
          )}

          {thumbBottom ? (
            <button
              type="button"
              onClick={() => setLightboxIndex(2)}
              className="relative overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <img
                src={`${thumbBottom}?t=1`}
                alt={`${venueName} photo 3`}
                className="h-full w-full object-cover object-center"
                loading="lazy"
              />
              {showMore && (
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-white text-sm font-medium rounded-md pointer-events-none">
                  +{moreCount}
                </div>
              )}
            </button>
          ) : (
            <div aria-hidden="true" />
          )}
        </div>
      </div>

      {lightboxIndex !== null && (
        <Lightbox urls={allImages} index={lightboxIndex} onClose={close} onPrev={prev} onNext={next} />
      )}
    </>
  );
};

export default VenueGalleryLightbox;
