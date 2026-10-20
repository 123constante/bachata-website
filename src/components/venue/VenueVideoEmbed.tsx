import { useRef, useState } from 'react';
import { parseVenueVideoUrl } from '@/lib/parseVenueVideoUrl';
import { VIDEO_CAP_CLASS, frameFor, frameStyle, hugStyle, resolveFrame, useReportVideoSize, type MeasuredFrame } from '@/lib/videoFrame';

interface VenueVideoEmbedProps {
  videoUrls: string[];
}

/** The tile's p-2 (0.5rem a side) + 1px border a side, added to a hugging tile's width. */
const SHELL_CHROME = '1rem + 2px';

export default function VenueVideoEmbed({ videoUrls }: VenueVideoEmbedProps) {
  const parsed = videoUrls.map((u) => parseVenueVideoUrl(u)).find(Boolean) ?? null;
  const [measured, setMeasured] = useState<MeasuredFrame | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const src = parsed?.kind === 'direct' ? parsed.src : undefined;
  useReportVideoSize(videoRef, src, (w, h) => src && setMeasured({ src, shape: frameFor(w, h) }));
  if (!parsed) return null;
  const frame = resolveFrame(parsed, measured);
  const style = frameStyle(frame);
  // Portrait/square: the tile hugs the video (as wide as it, centred), no black bars.
  const hug = !frame.landscape;

  const shell = {
    background: 'var(--va-surface)',
    borderColor: 'var(--va-accent-line)',
    boxShadow:
      '0 0 0 1px color-mix(in srgb, var(--va-halo) 10%, transparent), 0 18px 44px -22px color-mix(in srgb, var(--va-halo) 32%, transparent)',
  };

  const inner =
    parsed.kind === 'youtube' || parsed.kind === 'vimeo' ? (
      <iframe
        src={parsed.embedUrl}
        title="Venue video"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        className="absolute inset-0 h-full w-full rounded-[14px]"
        style={{ border: 'none' }}
      />
    ) : (
      <video
        ref={videoRef}
        src={parsed.src}
        autoPlay
        muted
        loop
        playsInline
        className={`absolute inset-0 h-full w-full rounded-[14px] ${frame.landscape ? 'object-cover' : 'object-contain'}`}
        onLoadedMetadata={(e) =>
          setMeasured({ src: parsed.src, shape: frameFor(e.currentTarget.videoWidth, e.currentTarget.videoHeight) })
        }
      />
    );

  return (
    <div
      data-video-hug={hug || undefined}
      className={hug ? `${VIDEO_CAP_CLASS} mx-auto overflow-hidden rounded-[18px] border p-2` : 'overflow-hidden rounded-[18px] border p-2'}
      style={hug ? { ...shell, ...hugStyle(frame, SHELL_CHROME) } : shell}
    >
      <div className={hug ? 'w-full overflow-hidden rounded-[14px]' : 'w-full overflow-hidden rounded-[14px] bg-black'}>
        <div
          data-video-frame
          className={`relative ${frame.landscape ? 'aspect-video w-full' : VIDEO_CAP_CLASS}`}
          style={style}
        >
          {inner}
        </div>
      </div>
    </div>
  );
}
