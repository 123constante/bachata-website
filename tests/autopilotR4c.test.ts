// r4c of the hourly autopilot (brief docs/briefs/autopilot-loop-r4c.md; review docs/review/1217-r1.md
// N4): the merge lane refuses agent-instruction file NAMES (claude|agents|gemini|skill with a
// [.-]suffix, e.g. CLAUDE.local.md, AGENTS.override.md) and the .gemini folder at every depth.
// Rows: tests/autopilotTable.ts (R4C_PATHS), shared with the r4c mutants in tests/autopilotMutants.test.ts.
// Handover: docs/handover/autopilot-loop-r4c.md.
import { describe, it, expect } from 'vitest';
import { laneClass, mergeVerdict } from '../scripts/lib/autopilot-merge.mjs';
import { R4C_PATHS } from './autopilotTable';

describe('r4c N4: laneClass', () => {
  it.each(R4C_PATHS)('%s -> %s', (p, want) => {
    const c = laneClass(p);
    if (typeof want === 'string') expect(c).toEqual({ cls: want });
    else {
      expect(c.cls).toBeUndefined();
      expect(c.no).toMatch(want);
    }
  });
});

describe('r4c N4: mergeVerdict on a one-file PR', () => {
  it.each(['CLAUDE.local.md', 'docs/.gemini/x.md'])('%s is NO in soft and in docs-canary', (p) => {
    for (const mode of ['soft', 'docs-canary']) {
      const v = mergeVerdict({ mode, files: [p], pr: { changedFiles: 1 } });
      expect(v.merge).toBe(false);
      expect(v.reasons).toContain(`agent-instruction path ${p}`);
    }
  });
});
