// homePolish chip row: ONE row that replaces the old "See what's nearest" strip and the
// Time/Nearest sort pill. Nearest is a single sort toggle; Party/Class/Fest are multi filters
// whose dots are the map's category colours (so the row doubles as the legend).
// Tap areas are 44px via a before: box, in px (the phone root font is ~13.5px).

import { useEffect, useState } from 'react';
import { Navigation, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { focusRing } from '@/modules/home-map/cards/controls';
import { CHIP_CATS, type ChipCat } from './chips';
import type { GeolocationDenialReason, GeolocationStatus } from '@/hooks/useGeolocation';
import { flags } from '@/lib/featureFlags';
import { denialCopy, isIOSUserAgent, isStandaloneDisplay, showRetry } from '@/lib/geo/denialCopy';
import { isRoughFix } from '@/lib/geo/nearMeFix';

const chipBase =
  "relative inline-flex h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-bold transition-colors before:absolute before:inset-x-0 before:-inset-y-[6px] before:content-['']";

export interface ChipGeo {
  status: GeolocationStatus;
  reason?: GeolocationDenialReason;
  accuracy?: number | null;
  canRetry?: boolean;
  request: () => void;
  clear: () => void;
}

export function HomeChipRow({
  geo,
  nearest,
  onNearest,
  cats,
  onToggleCat,
}: {
  geo: ChipGeo;
  nearest: boolean;
  onNearest: (on: boolean) => void;
  cats: ReadonlySet<ChipCat>;
  onToggleCat: (c: ChipCat) => void;
}) {
  // "Still looking... Cancel" once a fix has taken over ~8s.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (geo.status !== 'loading') {
      setSlow(false);
      return;
    }
    const t = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(t);
  }, [geo.status]);

  const nm = flags.nearMe;
  const onIOS = nm && isIOSUserAgent();
  const dismissed = nm && geo.status === 'denied' && geo.reason === 'dismissed';
  const retryOk = !nm || (geo.canRetry !== false && showRetry(geo.reason ?? null, onIOS));
  let locChip: JSX.Element;
  if (nm && geo.status === 'denied' && !dismissed && !retryOk) {
    locChip = (
      <span className={cn(chipBase, 'border-dashed border-border text-muted-foreground')} role="status">
        <Navigation className="h-4 w-4" aria-hidden="true" />
        Location off
      </span>
    );
  } else if (geo.status === 'granted') {
    locChip = (
      <button
        type="button"
        aria-pressed={nearest}
        onClick={() => onNearest(!nearest)}
        className={cn(chipBase, focusRing, nearest ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground')}
      >
        <Navigation className="h-4 w-4" aria-hidden="true" />
        Nearest
      </button>
    );
  } else if (geo.status === 'loading') {
    locChip = (
      <span className={cn(chipBase, 'border-border text-muted-foreground')} role="status">
        {slow ? 'Still looking\u2026' : 'Finding you\u2026'}
        {slow && (
          <button
            type="button"
            onClick={() => {
              geo.clear();
              onNearest(false);
            }}
            className={cn(`relative -mr-1 inline-flex h-[24px] items-center gap-0.5 rounded-full px-1.5 text-foreground underline before:absolute before:-inset-x-2 before:-inset-y-[10px] before:content-['']`, focusRing)}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Cancel
          </button>
        )}
      </span>
    );
  } else if (geo.status === 'denied') {
    locChip = (
      <button
        type="button"
        onClick={() => {
          onNearest(true);
          geo.request();
        }}
        aria-label={dismissed ? 'Near me' : 'Location off. Tap to try again, or turn on location for this site in your browser settings.'}
        className={cn(chipBase, focusRing, 'border-dashed border-border text-muted-foreground')}
      >
        <Navigation className="h-4 w-4" aria-hidden="true" />
        {dismissed ? 'Near me' : 'Location off'}
      </button>
    );
  } else {
    locChip = (
      <button
        type="button"
        onClick={() => {
          onNearest(true);
          geo.request();
        }}
        className={cn(chipBase, focusRing, 'border-dashed border-primary/60 text-primary')}
      >
        <Navigation className="h-4 w-4" aria-hidden="true" />
        {nm ? 'Near me' : 'Use my location'}
      </button>
    );
  }

  const note =
    nm && geo.status === 'denied'
      ? denialCopy(geo.reason ?? null, onIOS, isStandaloneDisplay())
      : nm && geo.status === 'granted' && isRoughFix(geo.accuracy)
        ? 'Rough location, so distances are approximate.'
        : null;
  return (
    <>
    <div role="group" aria-label="Sort and filter events" className="-mx-3 flex items-center gap-2 overflow-x-auto px-3 py-[6px] [scrollbar-width:none] md:mx-0 md:px-0">
      {locChip}
      {CHIP_CATS.map((c) => {
        const on = cats.has(c.id);
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggleCat(c.id)}
            className={cn(chipBase, focusRing, on ? 'border-foreground/70 bg-foreground/10 text-foreground' : 'border-border text-foreground')}
          >
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
            {c.label}
          </button>
        );
      })}
    </div>
    {note && (
      <p role="status" className="px-1 text-[13px] text-muted-foreground">
        {note}
      </p>
    )}
    </>
  );
}
