import { Copy as CopyIcon, Footprints as WalkIcon, Navigation as NavIcon } from 'lucide-react';
import { TubeLineChip } from './TubeLineChip';

interface VenueDirectionsCardProps {
  addressLine: string | null;
  nearestStation: string | null;
  nearestLines: string[];
  walkMinutes: number | null;
  onDirections: () => void;
  onCopy: () => void;
}

function MapGraphic() {
  return (
    <div
      className="relative h-[158px] w-full overflow-hidden md:h-[200px]"
      style={{
        background: 'linear-gradient(135deg,#15171d 0%,#1b1e26 100%)',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 320 160"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0"
      >
        <g fill="rgba(255,255,255,0.035)">
          <rect x="14" y="14" width="78" height="44" rx="4" />
          <rect x="104" y="10" width="60" height="38" rx="4" />
          <rect x="176" y="16" width="54" height="40" rx="4" />
          <rect x="244" y="12" width="64" height="46" rx="4" />
          <rect x="10" y="74" width="64" height="50" rx="4" />
          <rect x="86" y="100" width="70" height="52" rx="4" />
          <rect x="208" y="96" width="50" height="40" rx="4" />
          <rect x="270" y="100" width="46" height="56" rx="4" />
        </g>
        <g
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        >
          <path d="M-4 66h328" />
          <path d="M-4 88h328" />
          <path d="M170 -4v168" />
          <path d="M236 -4v168" />
        </g>
        <g stroke="rgba(255,255,255,0.06)" strokeWidth="3" fill="none">
          <path d="M96 -4v168" />
          <path d="M-4 130h328" />
        </g>
        <path
          d="M22 150 C 90 120, 120 96, 160 80"
          fill="none"
          stroke="var(--va-ink-gold)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="0.1 9"
          opacity="0.9"
        />
      </svg>
      <div
        className="absolute"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%,-100%)' }}
      >
        <div
          className="va-pin-pulse absolute"
          style={{
            left: '50%',
            bottom: -4,
            transform: 'translateX(-50%)',
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'var(--va-ink-gold)',
            opacity: 0.25,
            filter: 'blur(2px)',
          }}
        />
        <div className="relative" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}>
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="var(--va-ink-gold)"
            stroke="#fff"
            strokeWidth="1.4"
          >
            <path d="M12 22s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12Z" />
            <circle cx="12" cy="10" r="2.6" fill="#fff" stroke="none" />
          </svg>
        </div>
      </div>
      <style>{`
        @keyframes va-pinPulse {
          0% { transform: translateX(-50%) scale(0.6); opacity: 0.5; }
          70% { transform: translateX(-50%) scale(2.2); opacity: 0; }
          100% { opacity: 0; }
        }
        .va-pin-pulse { animation: va-pinPulse 2.4s ease-out infinite; }
      `}</style>
    </div>
  );
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
      <button
        type="button"
        onClick={onDirections}
        className="block w-full cursor-pointer border-0 p-0 text-left"
        aria-label="Open directions"
      >
        <MapGraphic />
      </button>

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
            <div className="min-w-0 flex-1">
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
            </div>
            <button
              type="button"
              onClick={onCopy}
              aria-label="Copy address"
              className="flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold"
              style={{
                background: 'transparent',
                borderColor: 'var(--va-line)',
                color: 'var(--va-text2)',
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
                  className="text-[8.5px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: 'var(--va-text2)' }}
                >
                  min walk
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
