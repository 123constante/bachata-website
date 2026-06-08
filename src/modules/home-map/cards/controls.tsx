// Festival Map -- shared discovery controls (tab bar, category chips, search).
// Prop-driven off useMapList state so mobile + desktop share one implementation.

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapTab, MapFilter } from '../mapTypes';
import { CATEGORY_COLORS } from '../mapTypes';

const TABS: { id: MapTab; label: string }[] = [
  { id: 'news', label: 'News' },
  { id: 'tonight', label: 'Tonight' },
  { id: 'cal', label: 'Calendar' },
  { id: 'all', label: 'All Events' },
];

/** Segmented tab control (News / Tonight / Calendar / All Events). */
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
      className={cn('flex gap-1 rounded-xl p-1', className)}
      style={{ background: 'hsl(var(--muted) / 0.4)' }}
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
              'flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors',
              on ? 'text-white' : 'text-muted-foreground hover:text-foreground',
            )}
            style={on ? { background: 'hsl(var(--primary))' } : undefined}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

const CHIPS: { id: MapFilter; label: string; color?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'parties', label: 'Parties', color: CATEGORY_COLORS.party },
  { id: 'classes', label: 'Classes', color: CATEGORY_COLORS.class },
  { id: 'festivals', label: 'Festivals', color: CATEGORY_COLORS.fest },
];

/** Category filter chips (All / Parties / Classes / Festivals). */
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
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            onClick={() => setFilter(c.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-colors',
              on ? 'border-transparent bg-primary text-white' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {c.color && <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />}
            {c.label}
          </button>
        );
      })}
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
