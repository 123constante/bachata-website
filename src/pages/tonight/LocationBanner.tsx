import { useId, useState } from 'react';
import { ChevronRight, Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  UserCoords,
  UserLocationReason,
  UserLocationStatus,
} from '@/hooks/useUserLocation';

type LocationBannerProps = {
  status: UserLocationStatus;
  reason: UserLocationReason;
  onRequest: () => void;
  onClear: () => void;
  onManualCoords: (coords: UserCoords) => void;
};

const LocationCta = ({
  loading,
  onPress,
}: {
  loading: boolean;
  onPress: () => void;
}) => (
  <button
    type="button"
    onClick={onPress}
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
          {loading
            ? 'Waiting for your location'
            : 'Sort tonight by distance'}
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

const reasonCopy = (reason: UserLocationReason): string => {
  switch (reason) {
    case 'denied':
      return 'Location permission denied. Enter a postcode to sort by distance.';
    case 'timeout':
      return 'Location took too long. Enter a postcode or try again.';
    case 'insecure':
      return 'Location needs a secure connection. Enter a postcode to sort by distance.';
    case 'unavailable':
      return "Location isn't available in this browser. Enter a postcode to sort by distance.";
    default:
      return 'Location unavailable - enter a postcode to sort by distance.';
  }
};

const PostcodeFallback = ({
  reason,
  onManualCoords,
  onRetry,
}: {
  reason: UserLocationReason;
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
    let res: Response;
    try {
      res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed)}`,
        { headers: { Accept: 'application/json' } },
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[PostcodeFallback] network error', err);
      setError('Network error - try again');
      setBusy(false);
      return;
    }
    if (!res.ok) {
      // 404 is the common "not a valid postcode" response from postcodes.io.
      if (res.status === 404) {
        setError("Couldn't find that postcode");
      } else {
        // eslint-disable-next-line no-console
        console.warn('[PostcodeFallback] http error', res.status);
        setError('Postcode lookup failed - try again');
      }
      setBusy(false);
      return;
    }
    try {
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
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[PostcodeFallback] parse error', err);
      setError('Postcode lookup failed - try again');
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
      <div className="flex items-start gap-2 mb-2 text-sm text-gray-300">
        <MapPin
          className="w-4 h-4 mt-0.5 shrink-0 text-primary"
          aria-hidden="true"
        />
        <span>{reasonCopy(reason)}</span>
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
          autoCapitalize="characters"
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
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : null}
          {busy ? 'Looking up...' : 'Use postcode'}
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span
          role={error ? 'alert' : undefined}
          className={cn(error ? 'text-red-300' : 'text-gray-500')}
        >
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
  reason,
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

  if (status === 'denied' || status === 'unavailable') {
    return (
      <PostcodeFallback
        reason={reason}
        onManualCoords={onManualCoords}
        onRetry={onRequest}
      />
    );
  }

  return <LocationCta loading={status === 'loading'} onPress={onRequest} />;
};

export default LocationBanner;
