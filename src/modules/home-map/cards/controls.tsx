// Festival Map -- shared discovery controls (tab bar, category filter, search).
// Prop-driven off useMapList state so mobile + desktop share one implementation.

import type { CSSProperties } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapTab, MapFilter } from '../mapTypes';
import { CATEGORY_COLORS } from '../mapTypes';

const TABS: { id: MapTab; label: string }[] = [
  { id: 'news', label: "What's New" },
  { id: 'tonight', label: 'Tonight' },
  { id: 'cal', label: 'Calendar' },
  { id: 'all', label: 'All Events' },
];

/** Underline tab control (What's New / Tonight / Calendar / All Events). The
 *  active tab is marked by an orange underline + orange text so it reads as
 *  navigation, not a filled CTA button. */
export function TabBar({
  tab,
  setTab,
  className,
}: {
  tab: MapTab;
  setTab: (t: MapTab) => void;
  className?: string;
}) {
  return (
    <div
      className={cn('relative flex items-stretch gap-1 border-b border-border', className)}
      role="tablist"
    >
      {TABS.map((t) => {
        const on = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => setTab(t.id)}
            className={cn(
              'relative flex-1 whitespace-nowrap px-1.5 py-2 text-xs font-bold transition-colors',
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
 *  fills with its own category colour; Classes keeps a persistent cyan glow so
 *  it draws the eye even when another filter is active. */
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
        const isClasses = c.id === 'classes';
        const style: CSSProperties = {};
        if (isClasses) {
          style.boxShadow = `0 0 8px 1px ${CATEGORY_COLORS.class}66, 0 0 16px 3px ${CATEGORY_COLORS.class}33`;
        }
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
              on
                ? 'border-transparent'
                : isClasses
                  ? 'border-[#46B7C9] text-[#46B7C9]'
                  : 'border-border text-muted-foreground hover:text-foreground',
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
 *  category filter is a consistent, orthogonal axis (Tonight + Classes, What's
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
      className={cn('flex items-center gap-2 rounded-xl border border-border px-3', className)}
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
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
