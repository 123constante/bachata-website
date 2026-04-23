import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// Clean copy of EventGallerySection's Lightbox, extended with keyboard nav
// and basic horizontal swipe. Kept self-contained rather than imported so the
// old section can be deleted after rollout without breaking the bento.
//
// Rendered via createPortal(document.body) so `position: fixed` resolves to
// the viewport instead of the nearest transformed ancestor. The event page
// is wrapped in <PageTransition> which is a framer-motion motion.div — even
// with `x: 0` at rest, framer-motion emits `transform: translateX(0px)`,
// and any non-`none` transform creates a containing block for fixed
// descendants (CSS spec). Without portalling, the lightbox's fixed inset-0
// fills the PageTransition bounds, not the viewport, and the Gallery
// button appears to do nothing on mobile.

type GalleryLightboxProps = {
  urls: string[];
  open: boolean;
  initialIndex?: number;
  onOpenChange: (open: boolean) => void;
};

const SWIPE_THRESHOLD_PX = 50;

export const GalleryLightbox = ({
  urls,
  open,
  initialIndex = 0,
  onOpenChange,
}: GalleryLightboxProps) => {
  const [index, setIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);

  // Reset index whenever the modal opens or the initial index changes.
  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  // Keyboard: Esc closes, ArrowLeft/Right navigate.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
      else if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + urls.length) % urls.length);
      else if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % urls.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, urls.length, onOpenChange]);

  if (!open || urls.length === 0) return null;
  if (typeof document === 'undefined') return null;

  const prev = () => setIndex((i) => (i - 1 + urls.length) % urls.length);
  const next = () => setIndex((i) => (i + 1) % urls.length);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const delta = e.changedTouches[0].clientX - start;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta < 0) next();
    else prev();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(false);
        }}
        aria-label="Close gallery"
      >
        <X className="h-5 w-5" />
      </button>

      {urls.length > 1 && (
        <>
          <button
            type="button"
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <img
        src={urls[index]}
        alt={`Gallery image ${index + 1} of ${urls.length}`}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {urls.length > 1 && (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60">
          {index + 1} / {urls.length}
        </span>
      )}
    </div>,
    document.body,
  );
};
