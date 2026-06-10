// Festival Map -- shared discovery controls (rail header, tab bar, category
// filter, search). Prop-driven off useMapList state so mobile + desktop share
// one implementation.

import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapTab, MapFilter } from '../mapTypes';
import { CATEGORY_COLORS } from '../mapTypes';

/** Shared id for the single tab panel both surfaces render: every tab points its
 *  aria-controls here and the panel is labelled by the active tab. */
export const RAIL_PANEL_ID = 'hm-rail-panel';
export const railTabId = (t: MapTab) => `hm-tab-${t}`;

/** Reusable keyboard focus ring (no ring on pointer focus, clear ring on Tab). */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const TABS: { id: MapTab; label: string }[] = [
  { id: 'news', label: "What's New" },
  { id: 'tonight', label: 'Today' },
  { id: 'cal', label: 'Calendar' },
  { id: 'all', label: 'All Events' },
];

/** Compact rail header: the city the list is scoped to + a live "N this week"
 *  heartbeat. Makes the city visible on mobile (the header pill is desktop-only)
 *  and signals the scene is active on every tab, so leading with events doesn't
 *  cost the liveness cue. */
export function RailHeader({ cityName, count }: { cityName: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="min-w-0 truncate text-sm font-extrabold tracking-tight">
        What&rsquo;s on in {cityName}
      </h2>
      {count > 0 && (
        <span className="shrink-0 text-xs font-bold tabular-nums text-primary">
          {count} this week
        </span>
      )}
    </div>
  );
}

/** Underline tab control (What's New / Today / Calendar / All Events) as a
 *  WAI-ARIA tablist: roving tabindex, Left/Right/Home/End move + activate, each
 *  tab drives the shared panel via aria-controls. The active tab is an orange
 *  underline + orange text so it reads as navigation, not a filled CTA. */
export function TabBar({
  tab,
  setTab,
  className,
}: {
  tab: MapTab;
  setTab: (t: MapTab) => void;
  className?: string;
}) {
  const btns = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next === -1) return;
    e.preventDefault();
    setTab(TABS[next].id);
    btns.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Discover events"
      onKeyDown={onKeyDown}
      className={cn('relative flex items-stretch gap-1 border-b border-border', className)}
    >
      {TABS.map((t, idx) => {
        const on = tab === t.id;
        return (
          <button
            key={t.id}
            ref={(el) => {
              btns.current[idx] = el;
            }}
            id={railTabId(t.id)}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={RAIL_PANEL_ID}
            tabIndex={on ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={cn(
              'relative flex-1 whitespace-nowrap rounded-t px-1.5 py-2 text-xs font-bold transition-colors',
              focusRing,
              on ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            {on && (
              <span
                aria-hidden="true"
                className="absolute inset-x-1.5 -bottom-px h-[3px] rounded-t-full bg-primary"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

const CHIPS: {
  id: MapFilter;
  label: string;
  color?: string;
  activeBg: string;
  activeFg: string;
}[] = [
  { id: 'all', label: 'All', activeBg: 'hsl(var(--primary))', activeFg: '#1a1a1a' },
  { id: 'parties', label: 'Parties', color: CATEGORY_COLORS.party, activeBg: CATEGORY_COLORS.party, activeFg: '#ffffff' },
  { id: 'classes', label: 'Classes', color: CATEGORY_COLORS.class, activeBg: CATEGORY_COLORS.class, activeFg: '#04222a' },
  { id: 'festivals', label: 'Festivals', color: CATEGORY_COLORS.fest, activeBg: CATEGORY_COLORS.fest, activeFg: '#2a1e00' },
];

/** Category filter chips (All / Parties / Classes / Festivals). The active chip
 *  fills with its own category colour. */
export function CategoryChips({
  filter,
  setFilter,
  className,
}: {
  filter: MapFilter;
  setFilter: (f: MapFilter) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {CHIPS.map((c) => {
        const on = filter === c.id;
        const style: CSSProperties = {};
        if (on) {
          style.background = c.activeBg;
          style.color = c.activeFg;
          style.borderColor = 'transparent';
        }
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            onClick={() => setFilter(c.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-bold transition-all duration-200',
              focusRing,
              on ? 'border-transparent' : 'border-border text-muted-foreground hover:text-foreground',
            )}
            style={Object.keys(style).length ? style : undefined}
          >
            {!on && c.color && <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />}
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

/** "Filter by type" label + the category chips. Rendered on every tab so the
 *  category filter is a consistent, orthogonal axis (Today + Classes, What's
 *  New + Festivals, ...). */
export function CategoryFilterBar({
  filter,
  setFilter,
  className,
}: {
  filter: MapFilter;
  setFilter: (f: MapFilter) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <span>Filter by type</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <CategoryChips filter={filter} setFilter={setFilter} />
    </div>
  );
}

/** Free-text search over title + venue + area. */
export function SearchField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border border-border px-3 focus-within:ring-2 focus-within:ring-primary',
        className,
      )}
      style={{ background: 'hsl(var(--muted) / 0.3)' }}
    >
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search events, venues..."
        aria-label="Search events"
        className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className={cn('shrink-0 rounded text-muted-foreground hover:text-foreground', focusRing)}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
