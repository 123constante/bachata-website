import { ChevronRight, Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  GeolocationDenialReason,
  GeolocationStatus,
} from '@/hooks/useGeolocation';

type NearMeCtaProps = {
  status: GeolocationStatus;
  reason: GeolocationDenialReason;
  onRequest: () => void;
  onClear: () => void;
};

const isIOSUserAgent = () =>
  typeof navigator !== 'undefined' &&
  /iPhone|iPad|iPod/.test(navigator.userAgent || '');

const denialCopy = (
  reason: GeolocationDenialReason,
  onIOS: boolean,
): string => {
  if (reason === 'insecure') {
    return 'Location needs a secure connection.';
  }
  if (onIOS) {
    return "Location is off for this site. Open Settings > Apps > Safari > Location and set this site to Allow, then refresh.";
  }
  return "Couldn't get your location. Check your browser's site permissions.";
};

const NearMeCta = ({ status, reason, onRequest, onClear }: NearMeCtaProps) => {
  if (status === 'granted') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3',
          'rounded-full border px-4 py-3',
          'bg-emerald-500/10 border-emerald-500/30 text-emerald-200',
        )}
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium min-w-0">
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
          <span className="truncate">Sorted by distance from you</span>
        </span>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear location and undo distance sort"
          className={cn(
            'min-h-[44px] min-w-[44px] inline-flex items-center justify-center',
            'text-xs uppercase tracking-wider font-bold',
            'text-emerald-300/80 hover:text-emerald-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 rounded-full',
          )}
        >
          Clear
        </button>
      </div>
    );
  }

  if (status === 'denied') {
    const onIOS = isIOSUserAgent();
    // Hide "Try again" when retry provably can't help: PERMISSION_DENIED on
    // iOS Safari sticks per-site and re-issuing getCurrentPosition just
    // re-fails instantly. For timeout/unavailable, retry can succeed.
    const showRetry = !(reason === 'denied' && onIOS) && reason !== 'insecure';
    return (
      <div
        className={cn(
          'rounded-2xl border px-4 py-3',
          'bg-white/5 border-white/10 text-gray-200',
        )}
      >
        <div className="flex items-start gap-2 text-sm text-gray-300">
          <MapPin
            className="w-4 h-4 mt-0.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <span>{denialCopy(reason, onIOS)}</span>
        </div>
        {showRetry && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={onRequest}
              className="text-xs text-gray-300 hover:text-white underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    );
  }

  const loading = status === 'loading';
  return (
    <button
      type="button"
      onClick={onRequest}
      disabled={loading}
      aria-busy={loading}
      aria-label="Find events near me"
      className={cn(
        'group w-full flex items-center justify-between gap-3',
        'rounded-full px-5 py-4 text-left',
        'bg-[#15171B] hover:bg-[#1c1f24] active:bg-[#1c1f24]',
        'border border-white/10',
        'shadow-[0_6px_18px_rgba(0,0,0,0.35)]',
        'transition-colors duration-150',
        'disabled:opacity-70 disabled:cursor-wait',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
      )}
    >
      <span className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            'grid place-items-center w-10 h-10 shrink-0 rounded-full',
            'bg-primary/15 text-primary',
          )}
          aria-hidden="true"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <MapPin className="w-5 h-5" />
          )}
        </span>
        <span className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-white truncate">
            {loading ? 'Finding you...' : 'Find events near me'}
          </span>
          <span className="text-xs text-gray-400 truncate">
            {loading ? 'Waiting for your location' : 'Sort tonight by distance'}
          </span>
        </span>
      </span>
      <ChevronRight
        className={cn(
          'w-5 h-5 shrink-0 text-gray-500',
          'transition-transform duration-150 group-hover:translate-x-0.5',
        )}
        aria-hidden="true"
      />
    </button>
  );
};

export default NearMeCta;
