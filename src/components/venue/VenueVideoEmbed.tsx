import { useState } from 'react';
import { parseVenueVideoUrl } from '@/lib/parseVenueVideoUrl';
import { frameFor, frameStyle } from '@/lib/videoFrame';

interface VenueVideoEmbedProps {
  videoUrls: string[];
}

export default function VenueVideoEmbed({ videoUrls }: VenueVideoEmbedProps) {
  const parsed = videoUrls.map((u) => parseVenueVideoUrl(u)).find(Boolean) ?? null;
  const [measured, setMeasured] = useState(() => frameFor());
  if (!parsed) return null;
  const frame = parsed.kind === 'youtube' && parsed.portrait ? frameFor(9, 16) : measured;
  const style = frameStyle(frame);

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
        src={parsed.src}
        autoPlay
        muted
        loop
        playsInline
        className={`absolute inset-0 h-full w-full rounded-[14px] ${frame.landscape ? 'object-cover' : 'object-contain'}`}
        onLoadedMetadata={(e) => setMeasured(frameFor(e.currentTarget.videoWidth, e.currentTarget.videoHeight))}
      />
    );

  return (
    <div
      className="overflow-hidden rounded-[18px] border p-2"
      style={shell}
    >
      <div className="w-full overflow-hidden rounded-[14px] bg-black">
        <div
          data-video-frame
          className={`relative ${frame.landscape ? 'aspect-video w-full' : ''}`}
          style={style}
        >
          {inner}
        </div>
      </div>
    </div>
  );
}
