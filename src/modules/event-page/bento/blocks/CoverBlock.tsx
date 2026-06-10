import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Images, Maximize2, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { parseVenueVideoUrl, type VenueVideo } from '@/lib/parseVenueVideoUrl';
import { ShareButton } from '@/components/ShareButton';
import { GalleryLightbox } from '@/modules/event-page/bento/modals/GalleryLightbox';
import { PinkFallback } from '@/modules/event-page/bento/blocks/PinkFallback';
import {
  COVER_CAROUSEL_ADVANCE_MS,
  useCoverCarousel,
} from '@/modules/event-page/bento/hooks/useCoverCarousel';

type CoverBlockProps = {
  imageUrl: string | null;
  galleryUrls: string[];
  // P5 cover video — first parseable URL (YouTube/Vimeo/direct upload) plays
  // as the cover, replacing the image carousel. Empty/absent = images only.
  videoUrls?: string[];
  title: string;
  dateLabel: string | null;
  venueName: string | null;
  // Whole-event cancellation -- when true, image is desaturated and a
  // horizontal red "CANCELLED" strip overlays the centre of the cover so
  // the tile reads dead at a glance and screenshots/shares are unambiguous.
  isCancelled?: boolean;
};

// Crossfade between slides. Kept shorter than the dwell so transitions read
// as a clean hand-off rather than overlapping noise.
const CROSSFADE_MS = 300;

// Reads the prefers-reduced-motion media query and re-renders if the user
// toggles the OS preference at runtime. `matchMedia` isn't available during
// SSR so we guard the initial read.
const usePrefersReducedMotion = (): boolean => {
  const [prefers, setPrefers] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setPrefers(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return prefers;
};

// CoverVideo — the P5 cover-video renderer for the bento cover cell. Lifts the
// proven venue-hero logic (autoplay/mute/loop + IntersectionObserver pause for
// direct uploads; a plain iframe for YouTube/Vimeo embeds whose egress isn't
// ours) WITHOUT importing VenueMediaHero (different layout). object-cover fills
// the portrait cell; the cover image is the poster while a direct clip buffers.
const CoverVideo = ({
  video,
  poster,
  title,
  isCancelled,
}: {
  video: VenueVideo;
  poster: string | null;
  title: string;
  isCancelled: boolean;
}) => {
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDirect = video.kind === 'direct';

  // Mirror the play/pause toggle onto the <video> element (direct path only).
  useEffect(() => {
    if (!isDirect) return;
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else v.play().catch(() => {/* autoplay may be blocked */});
  }, [paused, isDirect]);

  // Pause a direct upload when it scrolls out of view — saves our R2 egress.
  // Embeds stream from YouTube/Vimeo, so their bandwidth isn't ours to manage.
  useEffect(() => {
    if (!isDirect) return;
    const v = videoRef.current;
    const c = containerRef.current;
    if (!v || !c || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            try { v.pause(); } catch { /* noop */ }
          } else if (!paused) {
            v.play().catch(() => {/* autoplay may be blocked */});
          }
        }
      },
      { threshold: 0.1 },
    );
    io.observe(c);
    return () => io.disconnect();
  }, [paused, isDirect]);

  return (
    <div
      ref={containerRef}
      className="relative block h-full w-full overflow-hidden rounded-[22px] border border-[color:var(--bento-hairline)] bg-[hsl(var(--bento-surface-raised))]"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 32px rgba(0,0,0,0.55), 0 8px 16px rgba(0,0,0,0.45)',
        filter: isCancelled ? 'saturate(0.45) brightness(0.6)' : undefined,
      }}
    >
      {video.kind === 'direct' ? (
        <>
          <video
            ref={videoRef}
            className="h-full w-full object-cover object-center"
            src={video.src}
            autoPlay
            preload="metadata"
            muted={muted}
            loop
            playsInline
            poster={poster ?? undefined}
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
          />
          <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="inline-flex items-center justify-center rounded-full bg-black/60 p-1.5 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/80"
              aria-label={paused ? 'Play video' : 'Pause video'}
            >
              {paused ? <Play className="h-4 w-4 fill-white" /> : <Pause className="h-4 w-4 fill-white" />}
            </button>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="inline-flex items-center justify-center rounded-full bg-black/60 p-1.5 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/80"
              aria-label={muted ? 'Unmute video' : 'Mute video'}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </>
      ) : (
        // YouTube / Vimeo: the embed URL already carries autoplay+mute+loop and
        // its own player owns the controls, so there's no custom overlay here.
        <iframe
          src={video.embedUrl}
          title={`${title} video`}
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      )}
    </div>
  );
};

// Cover lives inside the bento grid as a 2×3 portrait cell. It fills the
// grid cell rather than imposing its own aspect ratio. Gallery + share
// overlay sits on the top-right corner of the cell.
//
// Phase 8d-cover: auto-rotates through cover + gallery images every 4 s
// with a 300 ms crossfade. Rotation pauses while the lightbox is open and
// is disabled entirely when the user prefers reduced motion. Every image
// renders with object-fit: contain on top of a subtle dark backdrop so
// nothing gets cropped and no image-derived colour bleeds into the frame
// (previous iteration used a duplicate blurred <img> as backdrop, which
// tinted the frame with the image's dominant colour — pink on the BOS
// banner, etc.). A mild inset shadow softens the backdrop's inner border
// so the image doesn't meet a hard, flat line.
export const CoverBlock = ({
  imageUrl,
  galleryUrls,
  videoUrls,
  title,
  dateLabel,
  venueName,
  isCancelled = false,
}: CoverBlockProps) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Ordered slide list: cover first, then gallery entries (deduped against
  // the cover so we don't render the same image twice).
  const images = useMemo(() => {
    const list: string[] = [];
    if (imageUrl) list.push(imageUrl);
    for (const url of galleryUrls) if (url && url !== imageUrl) list.push(url);
    return list;
  }, [imageUrl, galleryUrls]);

  // P5 cover video: the first parseable URL wins. When present it replaces the
  // image carousel in the cover cell; the images stay reachable via the gallery
  // lightbox. parseVenueVideoUrl is the shared YouTube/Vimeo/direct classifier.
  const coverVideo = useMemo<VenueVideo | null>(() => {
    if (!Array.isArray(videoUrls)) return null;
    for (const u of videoUrls) {
      const parsed = parseVenueVideoUrl(u);
      if (parsed) return parsed;
    }
    return null;
  }, [videoUrls]);

  const { index: currentIndex, sessionId, advance } = useCoverCarousel({
    count: images.length,
    paused: lightboxOpen,
    // A cover video takes the cell, so freeze the image carousel underneath it.
    disabled: prefersReducedMotion || coverVideo != null,
  });

  const handleImageError = useCallback(
    (i: number) => {
      // Log once per failing image; onError only fires when the src first
      // fails, so this won't spam. Skip only if the broken image is the
      // currently-showing one — a broken background slide doesn't need to
      // interrupt the current display.
      // eslint-disable-next-line no-console
      console.warn(`CoverBlock: image at index ${i} failed to load`);
      if (i === currentIndex && images.length > 1) advance();
    },
    [advance, currentIndex, images.length],
  );

  // Tap on the cover area:
  //   • 2+ images → advance the carousel to the next slide.
  //   • 1 image   → open the lightbox on that single image (there's no
  //     separate Gallery button in the single-image case since it'd have
  //     only one slide, so tapping the cover is the only affordance).
  //   • 0 images  → nothing renders the button, so unreachable.
  // Siblings (Gallery / Share buttons, progress-bar segments) have their
  // own handlers and stop propagation where needed so their taps don't
  // double-fire this.
  const handleCoverTap = useCallback(() => {
    if (images.length > 1) {
      advance();
    } else if (images.length === 1) {
      setLightboxOpen(true);
    }
  }, [advance, images.length]);

  // With a cover video, the cell is the video, so surface the gallery button
  // as soon as there's even one photo (otherwise photos would be unreachable).
  const showGalleryButton = coverVideo ? images.length >= 1 : images.length >= 2;

  return (
    <>
      <div className="relative h-full w-full">
        {coverVideo ? (
          <CoverVideo video={coverVideo} poster={imageUrl} title={title} isCancelled={isCancelled} />
        ) : imageUrl ? (
          <button
            type="button"
            aria-label={
              images.length > 1
                ? 'Advance to next cover image'
                : 'Open cover image full-screen'
            }
            onClick={handleCoverTap}
            data-cancelled={isCancelled ? 'true' : undefined}
            // Cover uses --bento-surface-raised so the letterbox space
            // around contain-fit images matches the colour of every other
            // tile in the grid (date / city / venue / etc.). Strong-button
            // tile treatment around it: brass hairline border, two-layer
            // shadow (inset top highlight + drop shadow), scale-to-98%
            // press. Combined with the existing inset vignette so image
            // edges don't meet a flat line.
            className="relative block h-full w-full cursor-pointer overflow-hidden rounded-[22px] bg-[hsl(var(--bento-surface-raised))] border border-[color:var(--bento-hairline)] transition-transform duration-150 ease-out active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 after:pointer-events-none after:absolute after:inset-0 after:rounded-[22px] after:bg-black/10 after:opacity-0 after:transition-opacity after:duration-150 after:content-[''] active:after:opacity-100"
            style={{
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 32px rgba(0,0,0,0.55), 0 8px 16px rgba(0,0,0,0.45)',
              filter: isCancelled ? 'saturate(0.45) brightness(0.6)' : undefined,
            }}
          >
            {images.map((url, i) => {
              const isSingle = images.length === 1;
              return (
                <div
                  key={url}
                  className="absolute inset-0"
                  style={{
                    opacity: i === currentIndex ? 1 : 0,
                    transition: `opacity ${CROSSFADE_MS}ms ease`,
                  }}
                  aria-hidden={i !== currentIndex}
                >
                  <img
                    src={url}
                    alt={i === 0 ? title : ''}
                    className="h-full w-full"
                    style={{
                      objectFit: 'contain',
                      transformOrigin: 'center',
                      animation:
                        isSingle && !prefersReducedMotion
                          ? 'cover-single-zoom 3s ease-in-out infinite alternate'
                          : undefined,
                    }}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    fetchPriority={i === 0 ? 'high' : 'auto'}
                    decoding="async"
                    onError={() => handleImageError(i)}
                  />
                </div>
              );
            })}
          </button>
        ) : (
          <PinkFallback title={title} fill />
        )}

        {/* Top-right overlay: Gallery sits left of Share so they don't collide.
            Share keeps rotation running — it opens a system sheet, not a
            dwell action. Gallery opens the lightbox which is its own
            hard-pause. Both stop event propagation so the cover's underlying
            tap-to-advance doesn't also fire. */}
        <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
          {showGalleryButton && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(true);
              }}
              aria-label={`Open gallery (${images.length} photos)`}
              className="flex h-7 items-center gap-1 rounded-full bg-black/55 px-2 text-white backdrop-blur-sm transition hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <Images className="h-3 w-3" />
              <span className="text-[10px] font-semibold">Gallery</span>
            </button>
          )}
          <div onClick={(e) => e.stopPropagation()}>
            <ShareButton
              eventName={title}
              dateLabel={dateLabel}
              venueName={venueName}
              variant="icon"
              fallback="copy"
            />
          </div>
        </div>

        {/* Stories-style progress segments at the bottom. One segment per
            slide; active segment animates 0 → 100 % via the `cover-progress`
            keyframe over ADVANCE_MS. Completed segments stay filled;
            upcoming segments stay at 25 % opacity empty. Hidden when a cover
            video is showing (the carousel is frozen behind it). */}
        {!coverVideo && images.length > 1 && (
          <div
            className="pointer-events-none absolute bottom-2 left-2 right-2 z-20 flex gap-[4px]"
            aria-hidden="true"
          >
            {images.map((_, i) => {
              const isCompleted = i < currentIndex;
              const isActive = i === currentIndex;
              return (
                <div
                  key={i}
                  className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25"
                >
                  <div
                    // Only the active segment is keyed to sessionId so its
                    // animation restarts at 0 whenever a new dwell window
                    // begins (natural advance, manual advance, unpause).
                    // Completed / upcoming segments keep stable keys.
                    key={isActive ? `active-${sessionId}` : `static-${i}`}
                    className="h-full origin-left bg-white"
                    style={{
                      transform: isCompleted ? 'scaleX(1)' : 'scaleX(0)',
                      animation:
                        isActive && !prefersReducedMotion
                          ? `cover-progress ${COVER_CAROUSEL_ADVANCE_MS}ms linear forwards`
                          : undefined,
                      animationPlayState: lightboxOpen ? 'paused' : undefined,
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Single-image case: when there is only one cover image we show
            neither the Gallery button (only renders for >=2 images) nor
            the Stories-style progress segments — leaving the cover
            looking like a static photo with no tap affordance. Render a
            compact pill in the bottom-left corner that mirrors the
            Share/Gallery pill style at the top, so the affordance is
            visible without a heavy scrim strip across the image.
            pointer-events-none so the tap still goes through to the
            underlying button. Suppressed when a cover video is showing. */}
        {!coverVideo && images.length === 1 && (
          <div
            className="pointer-events-none absolute bottom-2 left-2 z-20 flex h-7 items-center gap-1 rounded-full bg-black/55 px-2 text-white backdrop-blur-sm"
            aria-hidden="true"
          >
            <Maximize2 className="h-3 w-3" />
            <span className="text-[10px] font-semibold">Tap to expand</span>
          </div>
        )}
        {isCancelled && (
          <div
            className="pointer-events-none absolute left-0 right-0 top-1/2 z-30 -translate-y-1/2 px-1"
            data-testid="cover-cancelled-strip"
            aria-hidden="true"
          >
            <div
              className="mx-auto flex flex-col items-center justify-center border-y-2 border-white py-1.5 text-center text-white shadow-2xl"
              style={{
                background: 'rgba(220, 38, 38, 0.94)',
                textShadow: '0 2px 6px rgba(0,0,0,0.5)',
              }}
            >
              <div className="text-[18px] font-black uppercase tracking-[0.16em] leading-none">
                Cancelled
              </div>
              <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.06em] opacity-90">
                This event will not take place
              </div>
            </div>
          </div>
        )}
      </div>

      <GalleryLightbox
        urls={images}
        open={lightboxOpen}
        // Open the lightbox on whichever slide is currently visible in the
        // cover, not always slide 0 — if the user has rotated past index 0
        // and taps Gallery, landing on slide 0 would feel broken.
        initialIndex={currentIndex}
        onOpenChange={setLightboxOpen}
      />
    </>
  );
};
