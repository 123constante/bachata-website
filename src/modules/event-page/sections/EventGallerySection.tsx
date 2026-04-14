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
// Lightbox overlay
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
      {/* Close */}
      <button
        className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Prev */}
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

      {/* Next */}
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

      {/* Image */}
      <img
        src={cacheBust(urls[index])}
        alt={`Gallery image ${index + 1} of ${urls.length}`}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Counter */}
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

  return (
    <>
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
        <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/45">Gallery</p>

        {/* Mobile: horizontal scroll — Desktop: 2-3 col grid */}
        <div className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-2 md:overflow-x-visible lg:grid-cols-3">
          {galleryUrls.map((url, i) => (
            <button
              key={url}
              type="button"
              className="flex-none cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              onClick={() => open(i)}
            >
              <img
                src={cacheBust(url)}
                alt={`Gallery image ${i + 1}`}
                className="h-32 w-48 object-cover md:h-40 md:w-full"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </section>

      {lightboxIndex !== null && (
        <Lightbox urls={galleryUrls} index={lightboxIndex} onClose={close} onPrev={prev} onNext={next} />
      )}
    </>
  );
};
