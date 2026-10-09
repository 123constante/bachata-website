import { LEVEL_OPTIONS, type SeriesLevel, type SeriesLevelSummary } from '@/hooks/useSeriesLevelRating';

export const levelLabel = (level: SeriesLevel): string =>
  LEVEL_OPTIONS.find((o) => o.value === level)?.label ?? level;

export type LevelBar = { value: SeriesLevel; label: string; emoji: string; count: number; heightPct: number };

export type LevelResult = {
  winner: SeriesLevel;
  total: number;
  /** One line under the winner word: "5 of 9 dancers agree" or the tie sentence. */
  line: string | null;
  /** Highlighted bar, only when one level clearly leads. */
  soleLeader: SeriesLevel | null;
  bars: LevelBar[];
};

const joinLabels = (levels: SeriesLevel[]): string => {
  const labels = levels.map(levelLabel);
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
};

/**
 * The shown result, or null while the server has not derived one (fewer than 7
 * votes, where it also withholds the counts: nothing here may reveal them).
 */
export const buildLevelResult = (summary: SeriesLevelSummary | null): LevelResult | null => {
  if (!summary || !summary.derived_level) return null;
  const counts = summary.counts;
  const total = summary.vote_count;
  const base = { winner: summary.derived_level, total };
  if (!counts) return { ...base, line: null, soleLeader: null, bars: [] };

  const n = (v: SeriesLevel) => Math.max(0, counts[v] ?? 0);
  const top = Math.max(...LEVEL_OPTIONS.map((o) => n(o.value)));
  const leaders = LEVEL_OPTIONS.filter((o) => top > 0 && n(o.value) === top).map((o) => o.value);
  const soleLeader = leaders.length === 1 ? leaders[0] : null;

  let line: string | null = null;
  if (leaders.length > 1) line = `Dancers were split between ${joinLabels(leaders)}`;
  else if (soleLeader) line = `${top} of ${total} dancers agree`;

  const bars = LEVEL_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
    emoji: o.emoji,
    count: n(o.value),
    heightPct: top > 0 ? Math.round((n(o.value) / top) * 68) : 0,
  }));
  return { ...base, line, soleLeader, bars };
};
