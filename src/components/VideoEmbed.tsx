import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import type { VenueVideo } from '@/lib/parseVenueVideoUrl';

type VideoEmbedProps = {
  video: VenueVideo;
  poster?: string | null;
  title: string;
};

/**
 * VideoEmbed — shared inline video player for the event video tile and the
 * festival aftermovie section. Layout-agnostic: fills its parent (h-full
 * w-full), so the caller imposes the box (e.g. an `aspect-video` wrapper).
 *
 * Direct R2 uploads → <video> autoplay/mute/loop + an IntersectionObserver that
 * pauses it off-screen (saves our egress) + play/mute controls. YouTube/Vimeo →
 * a plain <iframe> (their player owns controls + bandwidth). Extracted verbatim
 * from the original CoverBlock `CoverVideo`, minus the cover-tile chrome.
 */
export const VideoEmbed = ({ video, poster, title }: VideoEmbedProps) => {
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
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
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

export default VideoEmbed;
