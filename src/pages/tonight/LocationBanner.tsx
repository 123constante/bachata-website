import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserCoords, UserLocationStatus } from '@/hooks/useUserLocation';

type LocationBannerProps = {
  status: UserLocationStatus;
  onRequest: () => void;
  onClear: () => void;
  onManualCoords: (coords: UserCoords) => void;
};

const THUMB_SIZE = 56;
const TRACK_PADDING = 4;
const UNLOCK_RATIO = 0.85;

const PinIcon = ({ size = 26 }: { size?: number }) => (
  <svg
    width={size}
    height={size * (31.2 / 26)}
    viewBox="0 0 24 28"
    aria-hidden="true"
  >
    <path
      d="M12 1.5c-5.2 0-9.5 4.1-9.5 9.2 0 6.8 9.5 16 9.5 16s9.5-9.2 9.5-16c0-5.1-4.3-9.2-9.5-9.2z"
      fill="#FF6A1A"
    />
    <circle cx="12" cy="10.5" r="3.4" fill="#fff" />
  </svg>
);

const ShimmerSlide = ({
  onUnlock,
  loading,
}: {
  onUnlock: () => void;
  loading: boolean;
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [maxOffset, setMaxOffset] = useState(0);

  useEffect(() => {
    const measure = () => {
      const w = trackRef.current?.clientWidth ?? 0;
      setMaxOffset(Math.max(0, w - THUMB_SIZE - TRACK_PADDING * 2));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (loading) setOffset(0);
  }, [loading]);

  const finish = useCallback(
    (finalOffset: number) => {
      if (maxOffset > 0 && finalOffset >= maxOffset * UNLOCK_RATIO) {
        setOffset(maxOffset);
        onUnlock();
      } else {
        setOffset(0);
      }
    },
    [maxOffset, onUnlock],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (loading) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    startXRef.current = e.clientX;
    startOffsetRef.current = offset;
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const delta = e.clientX - startXRef.current;
    const next = Math.max(0, Math.min(maxOffset, startOffsetRef.current + delta));
    setOffset(next);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    finish(offset);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (loading) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOffset(maxOffset);
      onUnlock();
    }
  };

  const progress = maxOffset > 0 ? offset / maxOffset : 0;
  const fillWidth = THUMB_SIZE + offset;

  return (
    <div
      ref={trackRef}
      role="button"
      tabIndex={0}
      aria-label="Slide to see events near me"
      aria-disabled={loading}
      onKeyDown={onKeyDown}
      className="relative w-full select-none overflow-hidden rounded-full"
      style={{
        height: THUMB_SIZE + TRACK_PADDING * 2,
        backgroundColor: '#15171B',
      }}
    >
      <div
        aria-hidden="true"
        className="absolute rounded-full transition-[width] duration-150 ease-out"
        style={{
          top: TRACK_PADDING,
          left: TRACK_PADDING,
          height: THUMB_SIZE,
          width: fillWidth,
          background: 'linear-gradient(90deg, #E0540B, #FF6A1A)',
          opacity: 0.95,
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          color: '#8C8F95',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          opacity: 1 - progress * 0.9,
          transition: 'opacity 0.15s linear',
        }}
      >
        <span className="relative inline-block overflow-hidden px-6">
          {loading ? 'Finding you...' : 'Slide to see events near me'}
          {!loading && (
            <span
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(90deg, rgba(0,0,0,0), rgba(255,255,255,0.55), rgba(0,0,0,0))',
                animation: 'bcal-slide-shimmer 2.4s linear infinite',
              }}
            />
          )}
        </span>
      </div>

      <div
        role="presentation"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          'absolute grid place-items-center rounded-full bg-white',
          'shadow-[0_6px_18px_rgba(0,0,0,0.35)]',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        style={{
          top: TRACK_PADDING,
          left: TRACK_PADDING + offset,
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          touchAction: 'none',
          transition: dragging
            ? 'none'
            : 'left 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-[#FF6A1A]" aria-hidden="true" />
        ) : (
          <PinIcon />
        )}
      </div>

      <style>{`@keyframes bcal-slide-shimmer { 0% { transform: translateX(-120%); } 100% { transform: translateX(220%); } }`}</style>
    </div>
  );
};

const PostcodeFallback = ({
  onManualCoords,
  onRetry,
}: {
  onManualCoords: (coords: UserCoords) => void;
  onRetry: () => void;
}) => {
  const inputId = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Enter a UK postcode');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed)}`,
      );
      if (!res.ok) {
        setError("Couldn't find that postcode");
        return;
      }
      const body = (await res.json()) as {
        result?: { latitude?: number; longitude?: number };
      };
      const lat = body.result?.latitude;
      const lng = body.result?.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        setError("Couldn't find that postcode");
        return;
      }
      onManualCoords({ lat, lng });
    } catch {
      setError('Network error - try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className={cn(
        'rounded-2xl border px-4 py-3',
        'bg-white/5 border-white/10 text-gray-200',
      )}
    >
      <div className="flex items-center gap-2 mb-2 text-sm text-gray-300">
        <MapPin className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />
        <span>Location unavailable - enter a postcode to sort by distance.</span>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <label htmlFor={inputId} className="sr-only">
          UK postcode
        </label>
        <input
          id={inputId}
          type="text"
          inputMode="text"
          autoComplete="postal-code"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. SW1A 1AA"
          className={cn(
            'flex-1 rounded-full px-4 py-2 text-sm',
            'bg-black/40 border border-white/10 text-white placeholder:text-gray-500',
            'focus:outline-none focus:border-primary/60',
          )}
          aria-invalid={Boolean(error)}
        />
        <button
          type="submit"
          disabled={busy}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-semibold',
            'bg-primary text-white hover:bg-primary/90 disabled:opacity-70',
            'inline-flex items-center justify-center gap-2',
          )}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
          {busy ? 'Looking up...' : 'Use postcode'}
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={cn(error ? 'text-red-300' : 'text-gray-500')}>
          {error ?? 'We use postcodes.io - no account required.'}
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="text-gray-300 hover:text-white underline underline-offset-2"
        >
          Try location again
        </button>
      </div>
    </form>
  );
};

const LocationBanner = ({
  status,
  onRequest,
  onClear,
  onManualCoords,
}: LocationBannerProps) => {
  if (status === 'granted') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3',
          'rounded-full border px-4 py-3',
          'bg-emerald-500/10 border-emerald-500/30 text-emerald-200',
        )}
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Sorted by distance from you
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs uppercase tracking-wider font-bold text-emerald-300/80 hover:text-emerald-200"
        >
          Clear
        </button>
      </div>
    );
  }

  if (status === 'denied' || status === 'unavailable') {
    return (
      <PostcodeFallback onManualCoords={onManualCoords} onRetry={onRequest} />
    );
  }

  return (
    <ShimmerSlide onUnlock={onRequest} loading={status === 'loading'} />
  );
};

export default LocationBanner;
