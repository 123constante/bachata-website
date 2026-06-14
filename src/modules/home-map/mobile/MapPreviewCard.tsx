// Festival Map mobile -- inline pin/cluster preview card. Replaces the Leaflet
// popup on mobile (EventMap popupMode='none'): a pin tap shows a single event,
// a cluster tap lists its 2-4 events. Docks flush to the map card edge and flips
// top/bottom so it never covers the tapped pin (MobileMapHome passes `dock`,
// captured from EventMap.pinHalf at tap time). Must render inside a `.home-map`
// ancestor so CoverThumb's scoped cover-scene CSS applies.

import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { X, ArrowRight, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapEvent } from '../mapTypes';
import { CoverThumb, TimePills } from '../cards/cards';
import { focusRing } from '../cards/controls';

const MAX_CLUSTER_ROWS = 4;
// Past this drag distance (px) in the dismiss direction, a swipe closes the card.
const SWIPE_DISMISS_PX = 56;

export function MapPreviewCard({
  events,
  dock,
  onClose,
  onOpen,
  className,
}: {
  /** length 1 = single pin; >1 = cluster. */
  events: MapEvent[];
  dock: 'top' | 'bottom';
  onClose: () => void;
  onOpen: (occId: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  // Read onClose through a ref so the mount-only effect below never re-runs (and
  // re-steals focus) when an unmemoised onClose identity changes on a parent
  // re-render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [shown, setShown] = useState(false);

  // Slide in on mount (MobileMapHome keys this by selection, so each new pick
  // re-animates). Reduced motion gets the resting position immediately.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  // Move focus in ONCE for keyboard/SR users, bind Escape, and on close return
  // focus to the opener (the tapped pin) so a keyboard user keeps their place.
  // Mount-only (empty deps): the Escape handler reads onClose via the ref above.
  useEffect(() => {
    const opener = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    };
  }, []);

  const onTouchStart = (e: TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStartY.current;
    touchStartY.current = null;
    if (start == null) return;
    const dy = (e.changedTouches[0]?.clientY ?? start) - start;
    // Swipe toward the docked edge (down for a bottom card, up for a top card).
    if (dock === 'bottom' && dy > SWIPE_DISMISS_PX) onClose();
    if (dock === 'top' && dy < -SWIPE_DISMISS_PX) onClose();
  };

  const isCluster = events.length > 1;
  const rows = events.slice(0, MAX_CLUSTER_ROWS);
  const extra = events.length - rows.length;
  const label = isCluster
    ? `${events.length} events at this location`
    : `Preview: ${events[0]?.name ?? 'event'}`;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={cn(
        'pointer-events-auto absolute inset-x-0 z-[600] border-border bg-background/95 shadow-2xl backdrop-blur outline-none',
        'transition-transform duration-200 motion-reduce:transition-none',
        dock === 'bottom'
          ? cn('bottom-0 rounded-t-2xl border-t', shown ? 'translate-y-0' : 'translate-y-full')
          : cn('top-0 rounded-b-2xl border-b', shown ? 'translate-y-0' : '-translate-y-full'),
        className,
      )}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className={cn(
          'absolute right-1 top-1 z-10 grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground',
          focusRing,
        )}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      {isCluster ? (
        <div className="p-3 pr-12">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {events.length} events here
          </p>
          <ul className="space-y-1">
            {rows.map((e) => (
              <li key={e.occurrence_id}>
                <button
                  type="button"
                  data-occ={e.occurrence_id}
                  onClick={() => onOpen(e.occurrence_id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors hover:bg-muted/50',
                    focusRing,
                  )}
                >
                  <CoverThumb event={e} className="h-10 w-10 shrink-0 rounded-lg" monoClassName="text-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{e.name}</span>
                    <TimePills event={e} className="mt-0.5" />
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {extra > 0 && (
            <p className="mt-1.5 px-1.5 text-xs text-muted-foreground">+{extra} more &middot; zoom in to see all</p>
          )}
        </div>
      ) : (
        <button
          type="button"
          data-occ={events[0]?.occurrence_id}
          onClick={() => events[0] && onOpen(events[0].occurrence_id)}
          className={cn('flex w-full items-center gap-3 p-3 pr-12 text-left', focusRing)}
        >
          <CoverThumb
            event={events[0]}
            className="h-16 w-16 shrink-0 rounded-xl"
            monoClassName="text-lg"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-bold">{events[0]?.name}</span>
            <TimePills event={events[0]} className="mt-1" />
            {events[0]?.venue_name && (
              <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {events[0].venue_name}
                  {events[0].area ? `, ${events[0].area}` : ''}
                </span>
              </span>
            )}
            <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-primary">
              View event <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
