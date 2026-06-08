// Festival Map -- shared presentational primitives for the map homepage list.
// Density-agnostic, prop-driven; mobile sheets and (PR E) the desktop rail both
// compose these so the markup + map<->list linking stay identical. Must render
// inside a `.home-map` ancestor so the scoped cover-scene CSS (.cv/.grain/.sc-*
// + the --hm-poster font var) from homeMap.css applies.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { MapEvent, MapCategory } from '../mapTypes';
import {
  deriveCategory,
  eventScene,
  monogram,
  CATEGORY_COLORS,
  formatTimeRange,
  freshnessDisplay,
  relativeShort,
  isFreshNew,
  distanceMiles,
} from '../mapTypes';

type Coords = { lat: number; lng: number } | null;

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
        <img className="cv-fill" src={event.cover_image_url} loading="lazy" alt="" />
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

/** Category dot + start/end time range (en-dash). Renders nothing if no times. */
export function TimePills({ event, className }: { event: MapEvent; className?: string }) {
  const range = formatTimeRange(event);
  if (!range) return null;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <CategoryDot category={deriveCategory(event)} className="h-1.5 w-1.5" />
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

/** Right-aligned "Added/Updated  Xm  ago" freshness stamp. */
export function FreshnessClock({ event, className }: { event: MapEvent; className?: string }) {
  const { verb, iso } = freshnessDisplay(event);
  const rel = relativeShort(iso);
  if (!rel) return null;
  const justNow = rel === 'just now';
  return (
    <div className={cn('flex shrink-0 flex-col items-end gap-0.5 text-right', className)}>
      <span className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">{verb}</span>
      <span className="text-xs font-bold tabular-nums">{rel}</span>
      {!justNow && <span className="text-[9px] text-muted-foreground">ago</span>}
    </div>
  );
}

/** "Cancelled" pill. */
function CancelPill() {
  return (
    <span className="shrink-0 rounded bg-[#E2415C] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
      Cancelled
    </span>
  );
}

/** Compact centred empty/placeholder message. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-2 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

interface RowProps {
  event: MapEvent;
  selected: boolean;
  onSelect: (occId: string) => void;
  onHover?: (occId: string | null) => void;
  className?: string;
}

const rowBase =
  'flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors';
const rowState = (selected: boolean) =>
  selected ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-muted/40';

/** Grouped-list / day-detail row (cover + title + times + venue). */
export function EventRow({ event, selected, onSelect, onHover, className }: RowProps) {
  return (
    <button
      type="button"
      data-occ={event.occurrence_id}
      onClick={() => onSelect(event.occurrence_id)}
      onPointerEnter={() => onHover?.(event.occurrence_id)}
      onPointerLeave={() => onHover?.(null)}
      className={cn(rowBase, rowState(selected), className)}
    >
      <CoverThumb event={event} className="h-12 w-12 rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{event.name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <TimePills event={event} />
        </span>
        {event.venue_name && (
          <span className="mt-1 block truncate text-xs text-muted-foreground">
            {event.venue_name}
            {event.area ? `, ${event.area}` : ''}
          </span>
        )}
      </span>
      {event.is_cancelled && <CancelPill />}
    </button>
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
  return (
    <button
      type="button"
      data-occ={event.occurrence_id}
      onClick={() => onSelect(event.occurrence_id)}
      onPointerEnter={() => onHover?.(event.occurrence_id)}
      onPointerLeave={() => onHover?.(null)}
      className={cn(
        'flex w-full items-stretch overflow-hidden rounded-2xl border text-left transition-colors',
        selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40',
      )}
    >
      <CoverThumb event={event} className="w-[92px] shrink-0" monoClassName="text-xl" />
      <span className="min-w-0 flex-1 p-3">
        <span className="block truncate text-sm font-bold">{event.name}</span>
        {event.is_cancelled ? (
          <span className="mt-2 inline-block">
            <CancelPill />
          </span>
        ) : (
          <TimePills event={event} className="mt-2" />
        )}
      </span>
      <DistanceBadge event={event} user={user} className="m-3 h-[54px] w-[54px] shrink-0" />
    </button>
  );
}

/** News row (portrait flyer + title/venue + freshness stamp + New badge). */
export function NewsRow({ event, selected, onSelect, onHover }: RowProps) {
  return (
    <button
      type="button"
      data-occ={event.occurrence_id}
      onClick={() => onSelect(event.occurrence_id)}
      onPointerEnter={() => onHover?.(event.occurrence_id)}
      onPointerLeave={() => onHover?.(null)}
      className={cn(rowBase, rowState(selected))}
    >
      <CoverThumb event={event} className="h-[68px] w-[52px] rounded-xl" monoClassName="text-xl" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate text-sm font-bold">{event.name}</span>
          {isFreshNew(event) && (
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
      <FreshnessClock event={event} />
    </button>
  );
}
