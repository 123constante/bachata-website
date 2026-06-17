// Festival Map -- shared presentational primitives for the map homepage list.
// Density-agnostic, prop-driven; mobile sheets and the desktop rail both
// compose these so the markup + map<->list linking stay identical. Must render
// inside a `.home-map` ancestor so the scoped cover-scene CSS (.cv/.grain/.sc-*
// + the --hm-poster font var) from homeMap.css applies.

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, MapPinOff, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { eventHref } from '@/lib/seo/eventHref';
import type { MapEvent, MapCategory } from '../mapTypes';
import {
  deriveCategory,
  eventScene,
  monogram,
  CATEGORY_COLORS,
  CATEGORY_LABEL,
  formatTimeRange,
  formatSplitTimes,
  freshnessDisplay,
  relativeShort,
  isFreshNew,
  isRecentlyChanged,
  distanceMiles,
  freshnessHeat,
} from '../mapTypes';
import type { FreshnessHeat } from '../mapTypes';

type Coords = { lat: number; lng: number } | null;

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Cover thumbnail: real flyer when present, else a category gradient + monogram. */
export function CoverThumb({
  event,
  className,
  monoClassName,
}: {
  event: MapEvent;
  className?: string;
  monoClassName?: string;
}) {
  const scene = event.cover_image_url ? '' : eventScene(event);
  return (
    <span className={cn('cv block', scene, className)}>
      {event.cover_image_url ? (
        <img className="cv-fill" src={event.cover_image_url} loading="lazy" alt={event.name} />
      ) : (
        <span
          className={cn(
            'absolute inset-0 z-[2] grid place-items-center text-white',
            monoClassName ?? 'text-base',
          )}
          style={{ fontFamily: 'var(--hm-poster)', fontWeight: 900, textShadow: '0 1px 7px rgba(0,0,0,.5)' }}
        >
          {monogram(event.name)}
        </span>
      )}
      <span className="grain" />
    </span>
  );
}

/** Small filled dot in a category colour. */
export function CategoryDot({ category, className }: { category: MapCategory; className?: string }) {
  return (
    <span
      className={cn('inline-block shrink-0 rounded-full', className)}
      style={{ background: CATEGORY_COLORS[category] }}
    />
  );
}

/** Time row for a list/card. A "Class & Party" event with split times shows two
 *  coloured segments (Class teal, Party rose); everything else shows the single
 *  category dot + merged start/end range. Renders nothing if there are no times. */
export function TimePills({ event, className }: { event: MapEvent; className?: string }) {
  const split = formatSplitTimes(event);
  if (split) {
    return (
      <span className={cn('inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground', className)}>
        {split.map((seg) => (
          <span key={seg.label} className="inline-flex items-center gap-1.5">
            <CategoryDot category={seg.category} className="h-1.5 w-1.5" />
            <span className="font-bold" style={{ color: CATEGORY_COLORS[seg.category] }}>{seg.label}</span>
            <span>{seg.range}</span>
          </span>
        ))}
      </span>
    );
  }
  const range = formatTimeRange(event);
  if (!range) return null;
  // Single-category (or a mix event missing split times): show the coloured dot +
  // category word + range, mirroring the split segments so every row names its type.
  const cat = deriveCategory(event);
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <CategoryDot category={cat} className="h-1.5 w-1.5" />
      <span className="font-bold" style={{ color: CATEGORY_COLORS[cat] }}>{CATEGORY_LABEL[cat]}</span>
      <span>{range}</span>
    </span>
  );
}

/** Teal distance chip ("0.4 / MI"). Renders nothing without user coords + venue coords. */
export function DistanceBadge({
  event,
  user,
  className,
}: {
  event: MapEvent;
  user: Coords;
  className?: string;
}) {
  const mi = distanceMiles(event, user);
  if (mi == null) return null;
  return (
    <div
      className={cn('flex flex-col items-center justify-center rounded-xl', className)}
      style={{ background: 'rgba(70,183,201,.14)' }}
    >
      <span className="font-bold leading-none" style={{ color: '#46B7C9' }}>
        {mi.toFixed(1)}
      </span>
      <span className="text-[8px] font-bold tracking-[0.14em]" style={{ color: '#46B7C9' }}>
        MI
      </span>
    </div>
  );
}

/** Muted "Off map" tag for events with no venue coords: they can't be pinned,
 *  but the card still opens the event -- so flag why there's no pin rather than
 *  leaving it silent. */
function OffMapTag() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground/80">
      <MapPinOff className="h-3 w-3" aria-hidden="true" />
      Off map
    </span>
  );
}

/** Age-temperature palette for the freshness stamp: live green (<5 min, pulsing),
 *  teal (<2 hr), amber (<6 hr), muted (<24 hr), near-invisible (stale). An empty
 *  `verb` colour leaves the label on the default muted tone (cool / stale). */
const FRESHNESS_HEAT: Record<FreshnessHeat, { dot: string; text: string; verb: string; live: boolean }> = {
  now: { dot: '#5FBF7F', text: '#5FBF7F', verb: '#5FBF7F', live: true },
  fresh: { dot: '#46B7C9', text: '#46B7C9', verb: '#46B7C9', live: false },
  warm: { dot: '#E8B450', text: '#E8B450', verb: '#E8B450', live: false },
  cool: { dot: '#3e3c4e', text: '#7a7690', verb: '', live: false },
  stale: { dot: '#2a2836', text: '#3e3c4e', verb: '', live: false },
};

/** Right-aligned "Added/Updated  Xm  ago" freshness stamp. A heat dot + thermal
 *  text colour show how recently the event changed; the dot pulses while the
 *  change is fresh (<5 min). Must render inside a `.home-map` ancestor for the
 *  dot pulse animation (homeMap.css .hm-heatdot). */
export function FreshnessClock({ event, className }: { event: MapEvent; className?: string }) {
  const { verb, iso } = freshnessDisplay(event);
  const rel = relativeShort(iso);
  if (!rel) return null;
  const justNow = rel === 'just now';
  const heat = FRESHNESS_HEAT[freshnessHeat(iso)];
  return (
    <div className={cn('flex shrink-0 items-start gap-1.5', className)}>
      <span className={cn('mt-0.5 hm-heatdot', heat.live && 'is-live')} style={{ background: heat.dot }} />
      <span className="flex flex-col items-end gap-0.5 text-right">
        <span
          className={cn('text-[8px] font-extrabold uppercase tracking-[0.1em]', !heat.verb && 'text-muted-foreground')}
          style={heat.verb ? { color: heat.verb } : undefined}
        >
          {verb}
        </span>
        <span className="text-xs font-bold tabular-nums" style={{ color: heat.text }}>{rel}</span>
        {!justNow && <span className="text-[9px] text-muted-foreground">ago</span>}
      </span>
    </div>
  );
}

/** "Cancelled" pill. */
function CancelPill() {
  return (
    <span className="shrink-0 rounded bg-[#E2415C] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
      Cancelled
    </span>
  );
}

/** Compact centred empty/placeholder message. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-2 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Shimmer placeholder rows shown while the map query loads, so a loading list,
 *  an empty list, and a backend-down list are no longer indistinguishable. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl p-2">
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-muted/50" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted/50" />
            <div className="h-3 w-2/5 animate-pulse rounded bg-muted/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Error state with a retry action. Distinct from the empty state so a failed
 *  load reads as "something broke, try again", not "nothing on". */
export function RetryNotice({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <p className="text-sm text-muted-foreground">We couldn&rsquo;t load events just now.</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/20',
            focusRing,
          )}
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}

interface RowProps {
  event: MapEvent;
  selected: boolean;
  onSelect: (occId: string) => void;
  onHover?: (occId: string | null) => void;
  className?: string;
}

const rowBase = cn(
  'flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors',
  focusRing,
);
const rowState = (selected: boolean) =>
  selected ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-muted/40';

/** Grouped-list / day-detail row (cover + title + times + venue). When
 *  `showFreshness` is set, a recently added/updated row carries an "Added Xm ago"
 *  stamp (gated by isRecentlyChanged so the bulk of the list stays quiet). */
export function EventRow({
  event,
  selected,
  onSelect,
  onHover,
  showFreshness,
  className,
}: RowProps & { showFreshness?: boolean }) {
  const cancelled = event.is_cancelled;
  const offMap = event.lat == null || event.lng == null;
  return (
    <a
      href={eventHref(event, event.occurrence_id)}
      data-occ={event.occurrence_id}
      onClick={(e) => {
        e.preventDefault();
        onSelect(event.occurrence_id);
      }}
      onPointerEnter={() => onHover?.(event.occurrence_id)}
      onPointerLeave={() => onHover?.(null)}
      className={cn(rowBase, rowState(selected), cancelled && 'opacity-60', className)}
    >
      <CoverThumb event={event} className={cn('h-12 w-12 rounded-xl', cancelled && 'grayscale')} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm font-bold', cancelled && 'line-through')}>{event.name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <TimePills event={event} />
          {offMap && <OffMapTag />}
        </span>
        {event.venue_name && (
          <span className="mt-1 block truncate text-xs text-muted-foreground">
            {event.venue_name}
            {event.area ? `, ${event.area}` : ''}
          </span>
        )}
      </span>
      {cancelled ? (
        <CancelPill />
      ) : showFreshness && isRecentlyChanged(event) ? (
        <FreshnessClock event={event} />
      ) : null}
    </a>
  );
}


/** Row for a festival outside the current city. Links directly to the festival
 *  page and shows a pin icon + city name so users know they'd be travelling. */
export function RemoteFestivalRow({ event }: { event: MapEvent }) {
  const cancelled = event.is_cancelled;
  return (
    <Link
      to={`/festival/${event.event_id}`}
      data-occ={event.occurrence_id}
      className={cn(rowBase, 'hover:bg-muted/40', cancelled && 'opacity-60')}
    >
      <CoverThumb event={event} className={cn('h-12 w-12 rounded-xl', cancelled && 'grayscale')} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm font-bold', cancelled && 'line-through')}>{event.name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <TimePills event={event} />
        </span>
        {event.venue_name && (
          <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{event.venue_name}</span>
          </span>
        )}
      </span>
    </Link>
  );
}

/** Tonight distance card (wide cover + title/times + distance chip). */
export function TonightCard({
  event,
  user,
  selected,
  onSelect,
  onHover,
}: RowProps & { user: Coords }) {
  const cancelled = event.is_cancelled;
  return (
    <a
      href={eventHref(event, event.occurrence_id)}
      data-occ={event.occurrence_id}
      onClick={(e) => {
        e.preventDefault();
        onSelect(event.occurrence_id);
      }}
      onPointerEnter={() => onHover?.(event.occurrence_id)}
      onPointerLeave={() => onHover?.(null)}
      className={cn(
        'flex w-full items-stretch overflow-hidden rounded-2xl border text-left transition-colors',
        focusRing,
        selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40',
        cancelled && 'opacity-60',
      )}
    >
      <CoverThumb event={event} className={cn('w-[92px] shrink-0', cancelled && 'grayscale')} monoClassName="text-xl" />
      <span className="min-w-0 flex-1 p-3">
        <span className={cn('block truncate text-sm font-bold', cancelled && 'line-through')}>{event.name}</span>
        {cancelled ? (
          <span className="mt-2 inline-block">
            <CancelPill />
          </span>
        ) : (
          <TimePills event={event} className="mt-2" />
        )}
      </span>
      <DistanceBadge event={event} user={user} className="m-3 h-[54px] w-[54px] shrink-0" />
    </a>
  );
}

/** News row (portrait flyer + title/venue + freshness stamp + New badge). */
export function NewsRow({ event, selected, onSelect, onHover }: RowProps) {
  const cancelled = event.is_cancelled;
  return (
    <a
      href={eventHref(event, event.occurrence_id)}
      data-occ={event.occurrence_id}
      onClick={(e) => {
        e.preventDefault();
        onSelect(event.occurrence_id);
      }}
      onPointerEnter={() => onHover?.(event.occurrence_id)}
      onPointerLeave={() => onHover?.(null)}
      className={cn(rowBase, rowState(selected), cancelled && 'opacity-60')}
    >
      <CoverThumb event={event} className={cn('h-[68px] w-[52px] rounded-xl', cancelled && 'grayscale')} monoClassName="text-xl" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn('min-w-0 truncate text-sm font-bold', cancelled && 'line-through')}>{event.name}</span>
          {!cancelled && isFreshNew(event) && (
            <span className="shrink-0 rounded bg-[#5FBF7F] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-[#0c1a12]">
              New
            </span>
          )}
        </span>
        {event.venue_name && (
          <span className="mt-1 block truncate text-xs text-muted-foreground">
            {event.venue_name}
            {event.area ? `, ${event.area}` : ''}
          </span>
        )}
      </span>
      {cancelled ? <CancelPill /> : <FreshnessClock event={event} />}
    </a>
  );
}
