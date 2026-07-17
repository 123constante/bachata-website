// Festival Map -- shared discovery controls (tab bar, category chips, search).
// Prop-driven off useMapList state. There is one home shell at every viewport
// now (HomeMapShell), so these render identically on the server and the client:
// keep them free of any JS viewport branch.

import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { Search, Filter, X } from 'lucide-react';
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

// Lead with events: All Events is first AND the default tab (audit P1). Order is
// shared by mobile + desktop; the /city/:slug/calendar deep-link still opens Cal.
const TABS: { id: MapTab; label: string }[] = [
  { id: 'all', label: 'All Events' },
  { id: 'tonight', label: 'Tonight' },
  { id: 'news', label: "What's New" },
  { id: 'cal', label: 'Calendar' },
];

/** Tab control as a WAI-ARIA tablist: roving tabindex, Left/Right/Home/End move +
 *  activate, each tab drives the shared panel via aria-controls. A segmented pill
 *  control whose active tab is a filled primary pill -- one shell means one tab
 *  style now, so there is no viewport variant to choose. */
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
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn('relative flex items-stretch gap-1 rounded-full bg-muted/40 p-1', className)}
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
              'relative flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
              focusRing,
              on
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

const CHIPS: {
  id: MapFilter;
  label: string;
  icon: string;
  borderColor: string;
  activeTint: string;
  activeText: string;
  glow: string;
}[] = [
  { id: 'all',       label: 'All',       icon: '\u2605',  borderColor: 'hsl(var(--primary))', activeTint: 'rgba(183,154,255,.12)', activeText: 'hsl(var(--primary))', glow: 'rgba(183,154,255,.45)' },
  { id: 'parties',   label: 'Parties',   icon: '\u{1F389}', borderColor: CATEGORY_COLORS.party, activeTint: 'rgba(226,65,92,.12)',   activeText: CATEGORY_COLORS.party, glow: 'rgba(226,65,92,.45)'   },
  { id: 'classes',   label: 'Classes',   icon: '\u{1F3B5}', borderColor: CATEGORY_COLORS.class, activeTint: 'rgba(70,183,201,.12)',  activeText: CATEGORY_COLORS.class, glow: 'rgba(70,183,201,.45)'  },
  { id: 'festivals', label: 'Festivals', icon: '\u{1F3AA}',  borderColor: CATEGORY_COLORS.fest,  activeTint: 'rgba(197,123,44,.12)',  activeText: CATEGORY_COLORS.fest,  glow: 'rgba(197,123,44,.45)'  },
];

/** Category filter chips (All / Parties / Classes / Festivals). Folder-tab style:
 *  icon above label, coloured top border + upward glow when active. */
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
    <div className={cn('flex gap-px', className)}>
      {CHIPS.map((c) => {
        const on = filter === c.id;
        const style: CSSProperties = on
          ? {
              borderTopColor: c.borderColor,
              background: c.activeTint,
              color: c.activeText,
              boxShadow: `0 -4px 12px -4px ${c.glow}`,
            }
          : {};
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            onClick={() => setFilter(c.id)}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 rounded-t-lg border-t-[3px] border-t-transparent px-2 pb-2 pt-2 text-[10px] font-bold transition-all duration-200',
              focusRing,
              on ? '' : 'text-muted-foreground hover:text-foreground',
            )}
            style={Object.keys(style).length ? style : undefined}
          >
            <span className="text-sm leading-none">{c.icon}</span>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

/** Free-text matcher over title + venue + area. Two visual modes so it never
 *  reads like the navigating header search: default `search`, or `filter` (a
 *  funnel glyph + amber tint) for the in-place rail/map filter. */
export function SearchField({
  value,
  onChange,
  className,
  filter = false,
  placeholder,
  ariaLabel,
  matchCount,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  filter?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  /** When set + a value is typed, shows a live "N matches" count so it's clear
   *  the field narrowed the current list/map in place (vs the navigating search). */
  matchCount?: number | null;
}) {
  const Icon = filter ? Filter : Search;
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 focus-within:ring-2 focus-within:ring-primary',
        filter ? 'border-primary/35' : 'border-border',
        className,
      )}
      style={{ background: filter ? 'hsl(var(--primary) / 0.06)' : 'hsl(var(--muted) / 0.3)' }}
    >
      <Icon
        className={cn('h-4 w-4 shrink-0', filter ? 'text-primary/80' : 'text-muted-foreground')}
        aria-hidden="true"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search events, venues...'}
        aria-label={ariaLabel ?? 'Search events'}
        className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
      />
      {value && matchCount != null && (
        <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
          {matchCount} {matchCount === 1 ? 'match' : 'matches'}
        </span>
      )}
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={filter ? 'Clear filter' : 'Clear search'}
          className={cn('shrink-0 rounded text-muted-foreground hover:text-foreground', focusRing)}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
