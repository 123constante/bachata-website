import { useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

type EventGallerySectionProps = {
  galleryUrls: string[];
};

const cacheBust = (url: string) => {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=1`;
};

// ---------------------------------------------------------------------------
// Lightbox overlay (preserved from prior implementation)
// ---------------------------------------------------------------------------
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
}) => {
  return (
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
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          aria-label="Previous image"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {urls.length > 1 && (
        <button
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label="Next image"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      <img
        src={cacheBust(urls[index])}
        alt={`Gallery image ${index + 1} of ${urls.length}`}
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
};

// ---------------------------------------------------------------------------
// Gallery section
// ---------------------------------------------------------------------------
export const EventGallerySection = ({ galleryUrls }: EventGallerySectionProps) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const open = useCallback((i: number) => setLightboxIndex(i), []);
  const close = useCallback(() => setLightboxIndex(null), []);
  const prev = useCallback(
    () => setLightboxIndex((i) => (i !== null ? (i - 1 + galleryUrls.length) % galleryUrls.length : null)),
    [galleryUrls.length],
  );
  const next = useCallback(
    () => setLightboxIndex((i) => (i !== null ? (i + 1) % galleryUrls.length : null)),
    [galleryUrls.length],
  );

  if (!galleryUrls.length) return null;

  const total = galleryUrls.length;
  const showOverflowTile = total > 6;
  const thumbnailCount = showOverflowTile ? 5 : Math.min(total, 6);
  const thumbnails = galleryUrls.slice(0, thumbnailCount);
  const overflow = total - thumbnailCount;

  return (
    <>
      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
        <div className="grid grid-cols-3 gap-2">
          {thumbnails.map((url, i) => (
            <button
              key={url}
              type="button"
              className="block aspect-square overflow-hidden rounded-md border-[0.5px] border-white/10 bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              onClick={() => open(i)}
            >
              <img
                src={cacheBust(url)}
                alt={`Gallery image ${i + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
          {showOverflowTile && (
            <button
              type="button"
              onClick={() => open(thumbnailCount)}
              className="flex aspect-square flex-col items-center justify-center rounded-md border-[0.5px] border-white/15 bg-white/[0.06]"
            >
              <span className="text-[16px] font-medium text-white">+{overflow}</span>
              <span className="text-[10px] text-white/55">more</span>
            </button>
          )}
        </div>
      </section>

      {lightboxIndex !== null && (
        <Lightbox urls={galleryUrls} index={lightboxIndex} onClose={close} onPrev={prev} onNext={next} />
      )}
    </>
  );
};
