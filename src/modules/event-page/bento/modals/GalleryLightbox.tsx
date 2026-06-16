import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// Gallery lightbox built on Radix Dialog so focus management is correct:
// focus is trapped inside the dialog, Escape closes it, and focus returns to
// the trigger (the cover Gallery button) on close. Radix Portals to <body>,
// so `position: fixed` resolves to the viewport rather than the nearest
// transformed ancestor -- the event page is wrapped in <PageTransition>
// (a framer-motion motion.div) whose transform would otherwise contain a raw
// fixed overlay and trap it inside the page bounds. Keyboard arrows + a
// horizontal swipe drive navigation.

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

  // Element that opened the lightbox. Radix's default focus restore lands on
  // <body> for this controlled-open dialog (no Dialog.Trigger), so we capture
  // the opener on the open transition -- during render, before Radix moves
  // focus into the dialog -- and restore it via onCloseAutoFocus below.
  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current && typeof document !== 'undefined') {
    openerRef.current = document.activeElement as HTMLElement | null;
  }
  wasOpen.current = open;

  // Reset index whenever the modal opens or the initial index changes.
  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  // ArrowLeft/Right navigate. Escape + focus trap/restore are owned by Radix.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + urls.length) % urls.length);
      else if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % urls.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, urls.length]);

  if (urls.length === 0) return null;

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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9998] bg-black/90 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          aria-modal="true"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            openerRef.current?.focus?.();
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center focus:outline-none"
          onClick={() => onOpenChange(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <Dialog.Title className="sr-only">Image gallery</Dialog.Title>

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
            loading="lazy"
            onClick={(e) => e.stopPropagation()}
          />

          {urls.length > 1 && (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60">
              {index + 1} / {urls.length}
            </span>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
