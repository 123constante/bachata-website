// Festival Map location controls -- one source of truth (state.geo) drives both
// the Tonight-tab list pill (LocateControl) and the round map control
// (MapLocateButton). Approach B: a compass (Navigation) icon that fills solid
// blue once granted, with a full loading/granted/denied state machine so the
// control never silently vanishes on tap. Denial copy + retry visibility come
// from the shared @/lib/geo/denialCopy module (parity with /tonight NearMeCta).

import { Loader2, Navigation, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { useGeolocation } from '@/hooks/useGeolocation';
import { denialCopy, isIOSUserAgent, showRetry } from '@/lib/geo/denialCopy';

type Geo = ReturnType<typeof useGeolocation>;

const LOC = '#3B82F6';
const LOC_LT = '#60A5FA';

/** Tonight-tab pill. Renders for every status so a tap gives immediate feedback:
 *  idle -> prompt, loading -> spinner, granted -> confirmation + Clear,
 *  denied -> accurate reason + conditional Try again. */
export function LocateControl({ geo }: { geo: Geo }) {
  const { status, reason, coords, request, clear } = geo;

  if (status === 'loading') {
    return (
      <div
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#60A5FA]/40 bg-[#3B82F6]/10 py-2 text-sm font-bold text-[#60A5FA]"
        aria-live="polite"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Finding you...
      </div>
    );
  }

  if (status === 'granted' && coords) {
    return (
      <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#5FBF7F]/35 bg-[#5FBF7F]/10 px-3 py-2 text-sm font-bold text-[#5FBF7F]">
        <span className="inline-flex min-w-0 items-center gap-2">
          <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Sorted by distance from you</span>
        </span>
        <button
          type="button"
          onClick={clear}
          aria-label="Clear location and undo distance sort"
          className="shrink-0 rounded-full px-1 text-[10px] font-extrabold uppercase tracking-wider text-[#5FBF7F]/80 hover:text-[#5FBF7F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5FBF7F]/60"
        >
          Clear
        </button>
      </div>
    );
  }

  if (status === 'denied') {
    const onIOS = isIOSUserAgent();
    const retry = showRetry(reason, onIOS);
    return (
      <div className="rounded-xl border border-border bg-white/5 px-3 py-2">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{denialCopy(reason, onIOS)}</span>
        </div>
        {retry && (
          <div className="mt-1.5 flex justify-end">
            <button
              type="button"
              onClick={request}
              className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    );
  }

  // idle
  return (
    <button
      type="button"
      onClick={request}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 py-2 text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Navigation className="h-4 w-4" aria-hidden="true" />
      Use my location for distances
    </button>
  );
}

/** Round map control (Approach B compass). Sits in each surface's overlay
 *  control stack; `baseClassName` is the stack's button base (ctrlBtn / zoomBtn).
 *  idle -> blue compass, loading -> spinner, granted -> filled blue (tap =
 *  turn off location), denied -> rose compass (tap retries when it can
 *  help). Tap calls request() synchronously to preserve the iOS user gesture. */
export function MapLocateButton({
  geo,
  baseClassName,
  iconClassName = 'h-[18px] w-[18px]',
  onRecenter,
}: {
  geo: Geo;
  baseClassName: string;
  iconClassName?: string;
  onRecenter?: () => void;
}) {
  const { status, reason, request, clear } = geo;
  const onIOS = isIOSUserAgent();
  const loading = status === 'loading';
  const granted = status === 'granted';
  const denied = status === 'denied';

  const handleClick = () => {
    if (loading) return;
    if (granted) {
      clear();
      return;
    }
    // idle or denied: (re)request. A sticky iOS denial re-fails fast but still
    // gives loading->denied feedback rather than a dead tap.
    request();
  };

  const label = loading
    ? 'Finding your location'
    : granted
      ? 'Turn off location'
      : denied
        ? denialCopy(reason, onIOS)
        : 'Use my location';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading}
      aria-label={label}
      style={granted ? { background: LOC, color: '#0b1220' } : { color: denied ? '#E2415C' : LOC_LT }}
      className={cn(baseClassName)}
    >
      {loading ? (
        <Loader2 className={cn(iconClassName, 'animate-spin')} aria-hidden="true" />
      ) : (
        <Navigation
          className={iconClassName}
          fill={granted ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      )}
    </button>
  );
}
