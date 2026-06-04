import { Copy as CopyIcon, Footprints as WalkIcon, Navigation as NavIcon } from 'lucide-react';
import { TubeLineChip } from './TubeLineChip';

interface VenueDirectionsCardProps {
  addressLine: string | null;
  nearestStation: string | null;
  nearestLines: string[];
  walkMinutes: number | null;
  googleMapsHref?: string | null;
  onDirections: () => void;
  onCopy: () => void;
}

function Roundel({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-label="Underground">
      <circle cx="20" cy="20" r="13.5" fill="none" stroke="#E32017" strokeWidth="6" />
      <rect x="2" y="16.5" width="36" height="7" fill="#10069F" />
    </svg>
  );
}

export default function VenueDirectionsCard({
  addressLine,
  nearestStation,
  nearestLines,
  walkMinutes,
  googleMapsHref,
  onDirections,
  onCopy,
}: VenueDirectionsCardProps) {
  return (
    <div
      className="overflow-hidden rounded-[18px] border"
      style={{
        background: 'var(--va-surface)',
        borderColor: 'var(--va-accent-line)',
        boxShadow:
          '0 0 0 1px color-mix(in srgb, var(--va-halo) 10%, transparent), 0 18px 44px -22px color-mix(in srgb, var(--va-halo) 32%, transparent)',
      }}
    >
      <div className="p-4">
        {addressLine ? (
          <div
            className="flex items-center gap-3 rounded-2xl border px-3 py-2.5"
            style={{
              background: 'var(--va-surface2)',
              borderColor: 'var(--va-line)',
            }}
          >
            <span
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ background: 'var(--va-accent-soft)', color: 'var(--va-text)' }}
              aria-hidden="true"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12Z" />
                <circle cx="12" cy="10" r="2.6" fill="var(--va-ink-gold)" />
              </svg>
            </span>
            <a
              href={googleMapsHref ?? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressLine)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 no-underline"
            >
              <div
                className="text-[9.5px] font-bold uppercase tracking-[0.1em]"
                style={{ color: 'var(--va-text3)' }}
              >
                Address
              </div>
              <div
                className="text-[14.5px] font-bold leading-tight underline underline-offset-2"
                style={{
                  fontFamily: 'var(--va-display)',
                  color: 'var(--va-text)',
                  letterSpacing: '-0.005em',
                }}
              >
                {addressLine}
              </div>
            </a>
            <button
              type="button"
              onClick={onCopy}
              aria-label="Copy address"
              className="flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold"
              style={{
                background: 'var(--va-btn-bg)',
                borderColor: 'var(--va-btn-border)',
                color: 'var(--va-ink-gold)',
                boxShadow: '0 6px 14px -8px rgba(0,0,0,0.5)',
              }}
            >
              <CopyIcon className="h-[15px] w-[15px]" />
              Copy
            </button>
          </div>
        ) : null}

        {nearestStation ? (
          <div
            className="mt-3 flex items-center gap-3 rounded-2xl border px-3.5 py-3"
            style={{
              background: 'var(--va-surface2)',
              borderColor: 'var(--va-line)',
            }}
          >
            <Roundel size={34} />
            <div className="min-w-0 flex-1">
              <div
                className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.1em]"
                style={{ color: 'var(--va-text3)' }}
              >
                Nearest station
              </div>
              <div
                className="text-[15.5px] font-bold leading-tight"
                style={{ color: 'var(--va-text)' }}
              >
                {nearestStation}
              </div>
              {nearestLines.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {nearestLines.map((l) => (
                    <TubeLineChip key={l} name={l} variant="full" />
                  ))}
                </div>
              ) : null}
            </div>
            {walkMinutes != null ? (
              <div
                className="flex min-w-[70px] flex-col items-center justify-center gap-0.5 rounded-[11px] border px-2.5 py-2"
                style={{
                  background: 'var(--va-accent-soft)',
                  borderColor: 'var(--va-accent-line)',
                }}
              >
                <WalkIcon
                  className="h-5 w-5"
                  style={{ color: 'var(--va-accent)' }}
                />
                <span
                  className="text-[26px] font-extrabold leading-none"
                  style={{
                    fontFamily: 'var(--va-display)',
                    color: 'var(--va-text)',
                  }}
                >
                  {walkMinutes}
                </span>
                <span
                  className="text-center text-[8.5px] font-bold uppercase leading-tight tracking-[0.1em]"
                  style={{ color: 'var(--va-text2)' }}
                >
                  min to venue
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onDirections}
          className="mt-4 flex h-[54px] w-full cursor-pointer items-center justify-center gap-2 rounded-[15px] border text-[16.5px] font-bold"
          style={{
            background: 'var(--va-btn-bg)',
            color: 'var(--va-btn-text)',
            borderColor: 'var(--va-btn-border)',
            fontFamily: 'var(--va-body)',
            boxShadow: '0 12px 26px -10px var(--va-btn-glow)',
          }}
        >
          <NavIcon className="h-5 w-5" />
          Get directions
        </button>
      </div>
    </div>
  );
}
