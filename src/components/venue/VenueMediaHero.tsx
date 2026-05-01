import { useState, useCallback, useRef, useEffect } from 'react';
import { Building2, ChevronLeft, ChevronRight, X, Images, Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { parseVenueVideoUrl, type VenueVideo } from '@/lib/parseVenueVideoUrl';

const Lightbox = ({
  urls, index, onClose, onPrev, onNext,
}: {
  urls: string[]; index: number; onClose: () => void; onPrev: () => void; onNext: () => void;
}) => {
  // a11y: ESC closes, arrow keys navigate (WCAG 2.1.1).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && urls.length > 1) onPrev();
      else if (e.key === 'ArrowRight' && urls.length > 1) onNext();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [urls.length, onClose, onPrev, onNext]);

  return (
  <div
    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
    onClick={onClose}
    role="dialog"
    aria-modal="true"
    aria-label={`Photo viewer, ${index + 1} of ${urls.length}`}
  >
    <button className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
            onClick={onClose} aria-label="Close">
      <X className="h-5 w-5" />
    </button>
    {urls.length > 1 && (
      <button className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); onPrev(); }} aria-label="Previous">
        <ChevronLeft className="h-6 w-6" />
      </button>
    )}
    {urls.length > 1 && (
      <button className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); onNext(); }} aria-label="Next">
        <ChevronRight className="h-6 w-6" />
      </button>
    )}
    <img src={`${urls[index]}?t=1`} alt={`Photo ${index + 1} of ${urls.length}`}
         className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
         onClick={(e) => e.stopPropagation()} />
    {urls.length > 1 && (
      <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60">
        {index + 1} / {urls.length}
      </span>
    )}
  </div>
  );
};

/**
 * VenueMediaHero — image+video hero.
 *
 * Two render paths depending on the video URL:
 *   - Direct media (mp4/webm/mov, or our Supabase Storage upload):
 *     <video> with autoplay + mute + loop + playsInline. Custom Play/Pause
 *     and Mute/Unmute controls. IntersectionObserver pauses when scrolled
 *     out of view (cost saving for our egress).
 *   - YouTube / Vimeo embed: <iframe> with autoplay+mute+loop URL params.
 *     Their player handles its own controls; we hide our custom buttons.
 *     No viewport-pause needed — the bandwidth cost is on Google/Vimeo,
 *     not us.
 *
 * Decided 2026-04-30 (Ricky): pasting a YouTube link should "just work"
 * because that's the easiest workflow for organisers.
 */
export const VenueMediaHero = ({
  allImages,
  videoUrls,
  venueName,
}: {
  allImages: string[];
  videoUrls: string[] | null | undefined;
  venueName: string;
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setLightboxIndex(null), []);
  const prev = useCallback(
    () => setLightboxIndex((i) => (i !== null ? (i - 1 + allImages.length) % allImages.length : null)),
    [allImages.length],
  );
  const next = useCallback(
    () => setLightboxIndex((i) => (i !== null ? (i + 1) % allImages.length : null)),
    [allImages.length],
  );

  // Pick the first parseable video URL (direct, YouTube, or Vimeo).
  let parsed: VenueVideo | null = null;
  if (Array.isArray(videoUrls)) {
    for (const u of videoUrls) {
      const p = parseVenueVideoUrl(u);
      if (p) { parsed = p; break; }
    }
  }

  const isDirect = parsed?.kind === 'direct';

  // Sync paused state with the <video> element (direct path only).
  useEffect(() => {
    if (!isDirect) return;
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else v.play().catch(() => {/* autoplay may be blocked */});
  }, [paused, isDirect]);

  // IntersectionObserver pause (direct path only — iframes stream from
  // YouTube/Vimeo so cost isn't ours to optimise).
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

  const hasMedia = parsed || allImages.length > 0;

  if (!hasMedia) {
    return (
      <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-venue-surface flex items-center justify-center mb-3">
        <Building2 className="w-10 h-10 text-venue-cream-mut/40" />
      </div>
    );
  }

  // Single image only, no video — full-bleed cover.
  if (!parsed && allImages.length === 1) {
    return (
      <>
        <button type="button" onClick={() => setLightboxIndex(0)}
                className="block w-full aspect-[16/9] overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-venue-ember/40 mb-3">
          <img src={`${allImages[0]}?t=1`} alt={`${venueName} cover`}
               className="h-full w-full object-cover object-center" loading="eager" />
        </button>
        {lightboxIndex !== null && (
          <Lightbox urls={allImages} index={lightboxIndex} onClose={close} onPrev={prev} onNext={next} />
        )}
      </>
    );
  }

  const showMore = allImages.length > 3;
  const moreCount = Math.max(0, allImages.length - 3);
  // When a video occupies the LEFT slot, photo indexes 0+1 fill the right
  // thumbs. When the cover image is in the LEFT, photos 1+2 fill the right.
  // Thumb mapping (Ricky 2026-04-30):
  //   When a video is present, the LEFT slot is the video, so:
  //     thumbTop    = allImages[0]  → COVER photo (always first in allImages)
  //     thumbBottom = allImages[1]  → first GALLERY photo
  //   When no video, the cover takes the LEFT slot, so thumbs slide down:
  //     thumbTop    = allImages[1]  → first gallery photo
  //     thumbBottom = allImages[2]  → second gallery photo
  const thumbTop = allImages[parsed ? 0 : 1];
  const thumbBottom = allImages[parsed ? 1 : 2];
  const openGallery = () => setLightboxIndex(0);

  return (
    <>
      <div ref={containerRef} className="relative aspect-[16/9] grid grid-cols-[3fr_2fr] gap-1.5 rounded-xl overflow-hidden mb-3">
        {/* LEFT — video if present, else cover image */}
        {parsed?.kind === 'direct' ? (
          <div className="relative overflow-hidden rounded-md bg-venue-bg">
            <video
              ref={videoRef}
              className="h-full w-full object-cover object-center"
              src={parsed.src}
              autoPlay
              preload="metadata"
              muted={muted}
              loop
              playsInline
              poster={allImages[0] ? `${allImages[0]}?t=1` : undefined}
              onPlay={() => setPaused(false)}
              onPause={() => setPaused(true)}
            />
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className="inline-flex items-center justify-center rounded-full bg-black/60 text-white/90 backdrop-blur-sm p-1.5 hover:bg-black/80 transition-colors"
                aria-label={paused ? 'Play video' : 'Pause video'}
              >
                {paused ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4 fill-white" />}
              </button>
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className="inline-flex items-center justify-center rounded-full bg-black/60 text-white/90 backdrop-blur-sm p-1.5 hover:bg-black/80 transition-colors"
                aria-label={muted ? 'Unmute video' : 'Mute video'}
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ) : parsed ? (
          // YouTube / Vimeo iframe embed. Their player handles autoplay,
          // mute, loop, and controls itself via the URL params we set in
          // parseVenueVideoUrl. No custom button overlay — would conflict.
          <div className="relative overflow-hidden rounded-md bg-black">
            <iframe
              src={parsed.embedUrl}
              title={`${venueName} video tour`}
              className="absolute inset-0 h-full w-full"
              loading="lazy"
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            className="overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-venue-ember/40"
          >
            <img src={`${allImages[0]}?t=1`} alt={`${venueName} cover`}
                 className="h-full w-full object-cover object-center" loading="eager" />
          </button>
        )}

        {/* RIGHT — 2 stacked thumbs */}
        <div className="grid grid-rows-2 gap-1.5">
          {thumbTop ? (
            <button type="button" onClick={() => setLightboxIndex(parsed ? 0 : 1)}
                    className="overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-venue-ember/40">
              <img src={`${thumbTop}?t=1`} alt={`${venueName} photo`}
                   className="h-full w-full object-cover object-center" loading="lazy" />
            </button>
          ) : (
            <div aria-hidden="true" className="bg-venue-surface rounded-md" />
          )}
          {thumbBottom ? (
            <button type="button" onClick={() => setLightboxIndex(parsed ? 1 : 2)}
                    className="relative overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-venue-ember/40">
              <img src={`${thumbBottom}?t=1`} alt={`${venueName} photo`}
                   className="h-full w-full object-cover object-center" loading="lazy" />
              {showMore && (
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-white text-sm font-medium rounded-md pointer-events-none">
                  +{moreCount}
                </div>
              )}
            </button>
          ) : (
            <div aria-hidden="true" className="bg-venue-surface rounded-md" />
          )}
        </div>

        {allImages.length > 0 && (
          <button type="button" onClick={openGallery}
                  className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/70 text-white text-xs font-semibold backdrop-blur-sm px-2.5 py-1.5 hover:bg-black/90 transition-colors"
                  aria-label={`Open gallery (${allImages.length} photos)`}>
            <Images className="w-3.5 h-3.5" />
            Gallery {allImages.length > 0 && <span className="text-white/80">({allImages.length})</span>}
          </button>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox urls={allImages} index={lightboxIndex} onClose={close} onPrev={prev} onNext={next} />
      )}
    </>
  );
};

export default VenueMediaHero;
