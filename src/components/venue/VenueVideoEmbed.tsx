import { parseVenueVideoUrl } from '@/lib/parseVenueVideoUrl';

interface VenueVideoEmbedProps {
  videoUrls: string[];
}

export default function VenueVideoEmbed({ videoUrls }: VenueVideoEmbedProps) {
  const parsed = videoUrls.map((u) => parseVenueVideoUrl(u)).find(Boolean) ?? null;
  if (!parsed) return null;

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
        className="absolute inset-0 h-full w-full rounded-[14px] object-cover"
      />
    );

  return (
    <div
      className="overflow-hidden rounded-[18px] border p-2"
      style={shell}
    >
      <div className="relative w-full overflow-hidden rounded-[14px]" style={{ paddingBottom: '56.25%' }}>
        {inner}
      </div>
    </div>
  );
}
