import { Image as ImageIcon } from 'lucide-react';
import { optimizedImageUrl } from '@/lib/imageCdn';

interface VenueHeroMosaicProps {
  name: string;
  photos: string[];
  onPhoto: (index: number) => void;
}

const PLACEHOLDER_GRADIENTS = [
  'linear-gradient(135deg,#7a2160 0%,#c42b7a 66%,#e0568f 100%)',
  'linear-gradient(135deg,#241b3a,#46306e)',
  'linear-gradient(135deg,#16283a,#264a6e)',
];

const PLACEHOLDER_LABELS = ['Main studio', 'Mirrored hall', 'On-site cafe'];

interface SlotProps {
  src: string | null;
  fallbackGrad: string;
  fallbackLabel: string;
  badge?: number;
  alt: string;
  onClick: () => void;
  style?: React.CSSProperties;
}

function PhotoSlot({
  src,
  fallbackGrad,
  fallbackLabel,
  badge,
  alt,
  onClick,
  style,
}: SlotProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-full items-center justify-center overflow-hidden border-none p-0"
      style={{
        background: src ? '#0E0F13' : fallbackGrad,
        cursor: 'pointer',
        ...style,
      }}
      aria-label={alt}
    >
      {src ? (
        <img
          src={optimizedImageUrl(src, 640)}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-1 opacity-70">
          <ImageIcon className="h-5 w-5 text-white" aria-hidden="true" />
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">
            {fallbackLabel}
          </span>
        </div>
      )}
      {badge && badge > 0 ? (
        <span
          className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold text-white backdrop-blur"
          style={{
            background: 'rgba(10,11,14,0.6)',
            borderColor: 'rgba(255,255,255,0.22)',
          }}
        >
          <ImageIcon className="h-3 w-3" aria-hidden="true" />+{badge}
        </span>
      ) : null}
    </button>
  );
}

function splitNameForAccent(name: string): { main: string; accent: string } {
  // Bicolour split rule: only apply gold accent to the last word when the name
  // has exactly two words (e.g. "Pulse Bar" -> Pulse + **Bar**). For 1-word
  // names (no split possible) and 3+ word names (a lone short last word reads
  // as a tag-along and looks unbalanced), render the whole name uniformly.
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length !== 2) return { main: trimmed, accent: '' };
  return { main: words[0], accent: words[1] };
}

export default function VenueHeroMosaic({
  name,
  photos,
  onPhoto,
}: VenueHeroMosaicProps) {
  const { main, accent } = splitNameForAccent(name);
  const overflow = Math.max(0, photos.length - 3);

  return (
    <div className="w-full">
      <h1
        className="mx-4 mb-5 mt-3 text-center text-[32px] font-bold leading-[1.05] tracking-tight md:mb-7 md:mt-4 md:text-5xl"
        style={{
          fontFamily: 'var(--va-display)',
          color: 'var(--va-ink-text)',
          letterSpacing: '-0.02em',
        }}
      >
        {main}
        {accent ? (
          <>
            {' '}
            <span style={{ color: 'var(--va-title-accent)' }}>{accent}</span>
          </>
        ) : null}
      </h1>

      <div
        className="grid h-[240px] gap-[3px] md:h-[360px]"
        style={{
          gridTemplateColumns: '1.75fr 1fr',
          gridTemplateRows: '1fr 1fr',
          background: 'var(--va-bg)',
        }}
      >
        <PhotoSlot
          src={photos[0] ?? null}
          fallbackGrad={PLACEHOLDER_GRADIENTS[0]}
          fallbackLabel="Cover photo"
          alt={`${name} cover photo`}
          onClick={() => onPhoto(0)}
          style={{ gridRow: '1 / span 2' }}
        />
        <PhotoSlot
          src={photos[1] ?? null}
          fallbackGrad={PLACEHOLDER_GRADIENTS[1]}
          fallbackLabel={PLACEHOLDER_LABELS[1]}
          alt={`${name} photo 2`}
          onClick={() => onPhoto(Math.min(1, photos.length - 1))}
        />
        <PhotoSlot
          src={photos[2] ?? null}
          fallbackGrad={PLACEHOLDER_GRADIENTS[2]}
          fallbackLabel={PLACEHOLDER_LABELS[2]}
          badge={overflow}
          alt={`${name} photo 3`}
          onClick={() => onPhoto(Math.min(2, photos.length - 1))}
        />
      </div>
    </div>
  );
}
