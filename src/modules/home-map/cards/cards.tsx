// Festival Map -- shared presentational primitives for the map homepage list.
// Density-agnostic, prop-driven; the map shell's feed and its map preview both
// compose these so the markup + map<->list linking stay identical. Must render
// inside a `.home-map` ancestor so the scoped cover-scene CSS (.cv/.grain/.sc-*
// + the --hm-poster font var) from homeMap.css applies.
//
// These rows SERVER-RENDER now (the homepage feed is above the fold), so every
// time-of-day read below goes through the homeClock hooks -- the server's instant
// until the tree has hydrated, the live clock after. Calling Date.now() directly
// at render time here would make the first client render disagree with the (up to
// an hour old) edge-cached HTML and cost us the server tree.
//
// useHomeNowStatic() is the DEFAULT for ROWS; useHomeNow() subscribes to the tick
// and re-renders its component every time, which memo cannot prevent. Reserve it
// for LEAF cells whose text genuinely changes that often -- a subscribing leaf
// repaints itself; a subscribing row repaints everything under it. See
// ../homeClock.

import { memo, useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, MapPinOff, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { optimizedImageUrl } from '@/lib/imageCdn';
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
  todayLiveStatus,
  freshnessHeat,
  isTodayRow,
  rowHref,
} from '../mapTypes';
import type { FreshnessHeat } from '../mapTypes';
import { useHomeNow, useHomeNowStatic } from '../homeClock';
import { focusRing } from './controls';

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
  // A 404/expired cover falls back to the same gradient+monogram as a missing
  // one, rather than a broken-image icon. Reset when the src changes (this
  // component is reused across list rows as the event prop changes).
  const [imgError, setImgError] = useState(false);
  useEffect(() => setImgError(false), [event.cover_image_url]);
  const showImg = !!event.cover_image_url && !imgError;
  const scene = showImg ? '' : eventScene(event);
  return (
    <span className={cn('cv block', scene, className)}>
      {showImg ? (
        // 320w edge-resized variant (not the multi-MB R2 original): every
        // CoverThumb call site renders <=92px CSS, so 320 covers 3x DPR, and
        // one shared variant per cover keeps the edge cache hot across list
        // rows, preview sheets and pins. No width/height needed: .cv-fill is
        // absolutely positioned inside the caller's fixed-size span (no CLS).
        <img
          className="cv-fill"
          src={optimizedImageUrl(event.cover_image_url!, 320)}
          loading="lazy"
          decoding="async"
          alt={event.name}
          onError={() => setImgError(true)}
        />
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
      data-testid="distance-badge"
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
 *  teal (<8 hr), amber (<24 hr), purple blinking dot (cool/stale). */
const FRESHNESS_HEAT: Record<FreshnessHeat, { dot: string; text: string; verb: string; live: boolean; updated: boolean }> = {
  now:   { dot: '#5FBF7F', text: '#5FBF7F', verb: '#5FBF7F', live: true,  updated: false },
  fresh: { dot: '#46B7C9', text: '#46B7C9', verb: '#46B7C9', live: false, updated: true  },
  warm:  { dot: '#E8B450', text: '#E8B450', verb: '#E8B450', live: false, updated: true  },
  cool:  { dot: '#9B7FD4', text: '#9B7FD4', verb: '#9B7FD4', live: false, updated: true  },
  stale: { dot: '#9B7FD4', text: '#9B7FD4', verb: '#9B7FD4', live: false, updated: true  },
};

/** Right-aligned "Added/Updated  Xm  ago" freshness stamp. A heat dot + thermal
 *  text colour show how recently the event changed; the dot pulses while the
 *  change is fresh (<5 min). Must render inside a `.home-map` ancestor for the
 *  dot pulse animation (homeMap.css .hm-heatdot). */
function FreshnessClockBody({
  event,
  now,
  className,
}: {
  event: MapEvent;
  now: number;
  className?: string;
}) {
  const { verb, iso } = freshnessDisplay(event);
  const rel = relativeShort(iso, now);
  if (!rel) return null;
  const justNow = rel === 'just now';
  const heat = FRESHNESS_HEAT[freshnessHeat(iso, now)];
  return (
    <div className={cn('flex shrink-0 items-start gap-1.5', className)}>
      <span className={cn('mt-0.5 hm-heatdot', heat.live && 'is-live', heat.updated && 'is-updated')} style={{ background: heat.dot }} />
      <span className="flex flex-col items-end gap-0.5 text-right">
        <span
          className="text-[8px] font-extrabold uppercase tracking-[0.1em]"
          style={{ color: heat.verb || undefined }}
        >
          {verb}
        </span>
        <span className="text-xs font-bold tabular-nums" style={{ color: heat.text }}>{rel}</span>
        {!justNow && <span className="text-[9px] text-muted-foreground">ago</span>}
      </span>
    </div>
  );
}

/** Freshness stamp. Subscribes to the one clock tier, so it refreshes on its
 *  own from "just now" through "3d 4h". Affordable because it is a LEAF: the row
 *  around it reads the static clock and stays memoised, so a tick repaints this
 *  span and nothing above it. An earlier revision split this by age across two
 *  tick rates to save the day-old stamps some wake-ups; it cost four rounds of
 *  defects and saved nothing measurable. See homeClock's note. */
export function FreshnessClock({ event, className }: { event: MapEvent; className?: string }) {
  const now = useHomeNow();
  return <FreshnessClockBody event={event} now={now} className={className} />;
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

/** Real-time "On now" / "Soon" badge for a today row. Renders nothing for past,
 *  future-day, or cancelled events, so the bulk of the list stays quiet. */
function LiveBadge({ event, today }: { event: MapEvent; today: string }) {
  const status = todayLiveStatus(event, new Date(useHomeNow()), today);
  if (!status) return null;
  return status === 'on-now' ? (
    <span className="shrink-0 rounded bg-[#5FBF7F] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#0c1a12]">
      On now
    </span>
  ) : (
    <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary">
      Soon
    </span>
  );
}

/** Muted right-edge distance chip (events list, when the user has shared their
 *  location): informs "can I get there" without competing with the title. */
function DistanceChip({ mi }: { mi: number }) {
  return (
    <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
      {mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi
    </span>
  );
}

/** Grouped-list / day-detail row (cover + title + times + venue). When
 *  `showFreshness` is set, a recently added/updated row carries the "Added/Updated
 *  Xm ago" stamp (gated by isRecentlyChanged). A row with no stamp falls back to
 *  the distance chip, from the caller-supplied `distanceMi`.
 *
 *  Memoised (perf, homepage TBT): the homepage feed renders up to ~380 of these,
 *  and hover/selection state on ONE row otherwise re-renders every sibling row
 *  through the shared AllEventsList/EventMap render. Props are plain
 *  values/callbacks from that parent, so a shallow-equal skip is safe here. */
export const EventRow = memo(function EventRow({
  event,
  selected,
  onSelect,
  onHover,
  showFreshness,
  today,
  distanceMi,
  className,
}: RowProps & {
  showFreshness?: boolean;
  /** The reader's pinned London day key. REQUIRED: the LiveBadge mount below
   *  gates on it, so an omitted prop would silently drop the On now / Soon badge
   *  from an entire surface. isTodayRow made the same parameter required for the
   *  same reason -- leaving it optional here just moved the fail-open out to the
   *  call sites, where no test can see it. */
  today: string;
  /** The row's distance from the reader, or null/absent for no chip. Always
   *  supplied by the caller: the feed has to derive distances anyway to sort by
   *  them, so deriving one here too just ran the same haversine twice. (There
   *  was a `user` prop that did that as a fallback; both call sites had stopped
   *  using it, leaving an untested branch in the hottest component in the feed
   *  and a signature that implied a convention nobody followed.) */
  distanceMi?: number | null;
}) {
  // Static, NOT subscribing: the only thing this feeds is isRecentlyChanged's
  // 14-day window below, which a TICK_MS-rate tick cannot usefully change. Subscribing
  // here would re-render every row in the feed twice a minute and make this
  // component's own React.memo pointless (see homeClock's SUBSCRIBE SPARINGLY).
  const now = useHomeNowStatic();
  const cancelled = event.is_cancelled;
  const offMap = event.lat == null || event.lng == null;
  const mi = distanceMi ?? null;
  return (
    <a
      href={rowHref(event)}
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
        <span className="flex items-center gap-2">
          <span className={cn('min-w-0 truncate text-sm font-bold', cancelled && 'line-through')}>{event.name}</span>
          {/* Mounted only when this row IS today: LiveBadge subscribes to the
              clock, and a badge per row would put every row back on the tick.
              It renders null for any other day anyway. Gate and badge share one
              predicate (mapTypes.isTodayRow) so they cannot drift apart. */}
          {isTodayRow(event, today) && <LiveBadge event={event} today={today} />}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <TimePills event={event} />
          {offMap && <OffMapTag />}
        </span>
        {event.festivalDateRange && (
          <span className="mt-1 block text-xs font-semibold text-primary">
            {event.festivalDateRange}
          </span>
        )}
        {event.venue_name && (
          <span className="mt-1 block truncate text-xs text-muted-foreground">
            {event.venue_name}
            {event.area ? `, ${event.area}` : ''}
          </span>
        )}
      </span>
      {cancelled ? (
        <CancelPill />
      ) : showFreshness && isRecentlyChanged(event, 14, now) ? (
        <FreshnessClock event={event} />
      ) : mi != null ? (
        <DistanceChip mi={mi} />
      ) : null}
    </a>
  );
});


/** Row for a festival outside the current city. Links directly to the festival
 *  page and shows a pin icon + city name so users know they'd be travelling. */
export const RemoteFestivalRow = memo(function RemoteFestivalRow({ event }: { event: MapEvent }) {
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
});

/** Tonight distance card (wide cover + title/times + distance chip).
 *
 *  Memoised (perf, homepage TBT): same rationale as EventRow -- the Tonight
 *  rail re-renders on hover/selection of any sibling card. */
export const TonightCard = memo(function TonightCard({
  event,
  user,
  selected,
  onSelect,
  onHover,
  today,
}: RowProps & { user: Coords; today: string }) {
  const cancelled = event.is_cancelled;
  return (
    <a
      href={rowHref(event)}
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
        <span className="flex items-center gap-2">
          <span className={cn('min-w-0 truncate text-sm font-bold', cancelled && 'line-through')}>{event.name}</span>
          {!cancelled && isTodayRow(event, today) && <LiveBadge event={event} today={today} />}
        </span>
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
});

/** News row (portrait flyer + title/venue + freshness stamp + New badge).
 *
 *  Memoised (perf, homepage TBT): same rationale as EventRow. */
export const NewsRow = memo(function NewsRow({ event, selected, onSelect, onHover }: RowProps) {
  // Static, like EventRow: the only consumer is isFreshNew's THIRTY-day window
  // below. FreshnessClock, rendered underneath, decides its own subscription.
  const now = useHomeNowStatic();
  const cancelled = event.is_cancelled;
  return (
    <a
      href={rowHref(event)}
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
          {!cancelled && isFreshNew(event, 30, now) && (
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
});
