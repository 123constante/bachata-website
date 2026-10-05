import type { SeriesLevel } from '@/hooks/useSeriesLevelRating';
import { cn } from '@/lib/utils';

// Dancer-rated series level on /search (search_public_v6, flags.searchV6).
// The labels mirror LEVEL_OPTIONS in the rating hook, but are declared here on
// purpose: a VALUE import of the hook makes it a module shared by /search and
// /event/:id, which splits it into its own chunk and adds a first-load request
// to every event view. `satisfies` keeps the values locked to SeriesLevel.
const LEVEL_OPTIONS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'improver', label: 'Improver' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'open_level', label: 'Open level' },
] as const satisfies ReadonlyArray<{ value: SeriesLevel; label: string }>;

const LEVEL_VALUES = new Set<string>(LEVEL_OPTIONS.map((o) => o.value));

export const isSeriesLevel = (v: string): v is SeriesLevel => LEVEL_VALUES.has(v);

/** Parse the `level` URL param (CSV) into known level tokens, deduped, in canonical order. */
export const parseLevelParam = (raw: string | null): SeriesLevel[] => {
  const picked = new Set((raw ?? '').split(',').filter(isSeriesLevel));
  return LEVEL_OPTIONS.map((o) => o.value).filter((v) => picked.has(v));
};

export const levelLabel = (v: string | null | undefined): string | null =>
  LEVEL_OPTIONS.find((o) => o.value === v)?.label ?? null;

/** "N events not rated yet. Help rate them." / singular for 1; null when nothing to say. */
export const unratedLineText = (count: number | null | undefined): string | null => {
  if (!count || count <= 0) return null;
  return count === 1
    ? '1 event not rated yet. Help rate it.'
    : `${count} events not rated yet. Help rate them.`;
};

// Same chip language as the facet/filter chips on the page, with a 44px tap
// target and a visible keyboard focus ring.
const chip =
  'inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const chipOn = 'bg-primary text-primary-foreground border-primary';
const chipOff = 'bg-transparent text-foreground border-primary/20 hover:border-primary/40';

type LevelFilterChipsProps = {
  selected: SeriesLevel[];
  onChange: (next: SeriesLevel[]) => void;
};

/** Multi-select level chips. "All levels" clears the selection. */
export const LevelFilterChips = ({ selected, onChange }: LevelFilterChipsProps) => {
  const toggle = (v: SeriesLevel) => {
    const next = selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v];
    onChange(LEVEL_OPTIONS.map((o) => o.value).filter((x) => next.includes(x)));
  };
  return (
    <div role="group" aria-label="Level" className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]">
      <button
        type="button"
        aria-pressed={selected.length === 0}
        onClick={() => onChange([])}
        className={cn(chip, selected.length === 0 ? chipOn : chipOff)}
      >
        All levels
      </button>
      {LEVEL_OPTIONS.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.value)}
            className={cn(chip, on ? chipOn : chipOff)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

/** One plain line under the chips; renders nothing unless a level is selected and events were hidden. */
export const UnratedLine = ({ levelSelected, count }: { levelSelected: boolean; count: number | null | undefined }) => {
  const text = levelSelected ? unratedLineText(count) : null;
  if (!text) return null;
  return <p className="mt-2 text-sm text-muted-foreground">{text}</p>;
};

/** Small badge for an event result; nothing when the series is not rated yet. */
export const LevelBadge = ({ level }: { level: string | null | undefined }) => {
  const label = levelLabel(level);
  if (!label) return null;
  return (
    <span className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
      {label}
    </span>
  );
};
