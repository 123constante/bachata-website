import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Images, X } from 'lucide-react';

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

  if (!allImages.length) return null;

  const primary = allImages[0];
  const thumbs = allImages.slice(1, 5);
  const showMore = allImages.length > 5;
  const moreCount = allImages.length - 5;

  return (
    <>
      {allImages.length === 1 && (
        <button
          type="button"
          className="w-full aspect-[16/9] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          onClick={() => setLightboxIndex(0)}
        >
          <img
            src={`${allImages[0]}?t=1`}
            alt={`${venueName} cover`}
            className="h-full w-full object-cover object-center"
            loading="eager"
          />
        </button>
      )}

      {allImages.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto md:hidden">
          {allImages.map((url, i) => (
            <button
              key={url + i}
              type="button"
              className="flex-none aspect-[4/3] h-52 overflow-hidden rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              onClick={() => setLightboxIndex(i)}
            >
              <img
                src={`${url}?t=1`}
                alt={`${venueName} photo ${i + 1}`}
                className="h-full w-full object-cover object-center"
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            </button>
          ))}
        </div>
      )}

      {allImages.length > 1 && (
        <div className="hidden md:grid md:grid-cols-[3fr_2fr] md:gap-1 overflow-hidden rounded-xl">
          <button
            type="button"
            className="relative aspect-[4/3] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            onClick={() => setLightboxIndex(0)}
          >
            <img
              src={`${primary}?t=1`}
              alt={`${venueName} cover`}
              className="h-full w-full object-cover object-center"
              loading="eager"
            />
          </button>

          {thumbs.length > 0 && (
            <div className="grid grid-cols-2 gap-1">
              {thumbs.map((url, i) => {
                const absIdx = i + 1;
                const isLastVisible = i === thumbs.length - 1 && showMore;
                return (
                  <button
                    key={url + i}
                    type="button"
                    className="relative aspect-square overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    onClick={() => setLightboxIndex(isLastVisible ? 0 : absIdx)}
                  >
                    <img
                      src={`${url}?t=1`}
                      alt={`${venueName} photo ${absIdx + 1}`}
                      className="h-full w-full object-cover object-center"
                      loading="lazy"
                    />
                    {isLastVisible && (
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-white"
                        onClick={(e) => { e.stopPropagation(); setLightboxIndex(0); }}
                      >
                        <Images className="h-5 w-5" />
                        <span className="text-sm font-semibold">+{moreCount} more</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox urls={allImages} index={lightboxIndex} onClose={close} onPrev={prev} onNext={next} />
      )}
    </>
  );
};

export default VenueGalleryLightbox;
