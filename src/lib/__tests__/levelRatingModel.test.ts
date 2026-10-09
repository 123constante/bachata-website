import { describe, expect, it, vi } from 'vitest';
import { buildLevelResult } from '@/lib/levelRatingModel';
// LEVEL_OPTIONS lives in the rating hook, which imports the supabase client.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));

import type { SeriesLevelSummary } from '@/hooks/useSeriesLevelRating';

const summary = (
  counts: SeriesLevelSummary['counts'],
  derived: SeriesLevelSummary['derived_level'],
  votes: number,
): SeriesLevelSummary => ({ series_id: 's1', vote_count: votes, threshold: 7, counts, derived_level: derived, my_level: null });

// One row per shape the server can return (mirrors _series_level_derived_p5_v1).
const CASES: Array<{
  name: string;
  input: SeriesLevelSummary | null;
  winner: string | null;
  line: string | null;
  sole: string | null;
  heights?: number[];
}> = [
  { name: 'no summary', input: null, winner: null, line: null, sole: null },
  { name: 'under 7 votes: server withholds counts and level', input: summary(null, null, 3), winner: null, line: null, sole: null },
  { name: 'zero votes', input: summary(null, null, 0), winner: null, line: null, sole: null },
  {
    name: 'clear winner',
    input: summary({ mostly_beginners: 1, mixed: 3, strong: 5 }, 'strong', 9),
    winner: 'strong', line: '5 of 9 dancers agree', sole: 'strong', heights: [14, 41, 68],
  },
  {
    name: 'mixed wins outright',
    input: summary({ mostly_beginners: 1, mixed: 5, strong: 3 }, 'mixed', 9),
    winner: 'mixed', line: '5 of 9 dancers agree', sole: 'mixed',
  },
  {
    name: 'two-way tie reads as Mixed with the split sentence',
    input: summary({ mostly_beginners: 3, mixed: 1, strong: 3 }, 'mixed', 7),
    winner: 'mixed', line: 'Dancers were split between Mostly beginners and Strong', sole: null,
  },
  {
    name: 'three-way tie',
    input: summary({ mostly_beginners: 3, mixed: 3, strong: 3 }, 'mixed', 9),
    winner: 'mixed', line: 'Dancers were split between Mostly beginners, Mixed and Strong', sole: null,
  },
  {
    name: 'a level with zero votes',
    input: summary({ mostly_beginners: 0, mixed: 0, strong: 7 }, 'strong', 7),
    winner: 'strong', line: '7 of 7 dancers agree', sole: 'strong', heights: [0, 0, 68],
  },
  {
    name: 'derived but counts missing: winner only, no chart',
    input: summary(null, 'strong', 8),
    winner: 'strong', line: null, sole: null,
  },
];

describe('buildLevelResult', () => {
  it.each(CASES)('$name', ({ input, winner, line, sole, heights }) => {
    const r = buildLevelResult(input);
    expect(r?.winner ?? null).toBe(winner);
    expect(r?.line ?? null).toBe(line);
    expect(r?.soleLeader ?? null).toBe(sole);
    if (heights) expect(r?.bars.map((b) => b.heightPct)).toEqual(heights);
  });

  it('never exposes counts below the threshold', () => {
    const r = buildLevelResult(summary({ mostly_beginners: 1, mixed: 0, strong: 2 }, null, 3));
    expect(r).toBeNull();
  });

  it('always lists the three answers in scale order', () => {
    const r = buildLevelResult(summary({ mostly_beginners: 1, mixed: 3, strong: 5 }, 'strong', 9));
    expect(r?.bars.map((b) => b.value)).toEqual(['mostly_beginners', 'mixed', 'strong']);
  });
});
