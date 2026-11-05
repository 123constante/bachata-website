// r4b of the hourly autopilot (brief docs/briefs/autopilot-loop-r4b.md; review docs/review/1215-r1.md
// N1/N2/N3): the merge lane refuses agent-instruction paths at every depth, keeps the tests class
// out, treats placeholder Verified values as unfilled and compares labels case-insensitively.
// Rows: tests/autopilotTable.ts (R4B_*), shared with the r4b mutants in tests/autopilotMutants.test.ts.
// Handover: docs/handover/autopilot-loop-r4b.md.
import { describe, it, expect } from 'vitest';
import { laneClass, bodyFilled, mergeVerdict } from '../scripts/lib/autopilot-merge.mjs';
import { R4B_PATHS, R4B_BODIES, R4B_LABELS } from './autopilotTable';

const NOT = '\nNot verified: the phone walk';

describe('r4b N1 + N3b: laneClass', () => {
  it.each(R4B_PATHS)('%s -> %s', (p, want) => {
    const c = laneClass(p);
    if (typeof want === 'string') expect(c).toEqual({ cls: want });
    else {
      expect(c.cls).toBeUndefined();
      expect(c.no).toMatch(want);
    }
  });
  // Every path the review 1215-r1 probed: NO (SECURITY.md and docs/prompt.md are plain docs files;
  // they are not agent-instruction paths and stay class docs, see the handover).
  it.each([
    'docs/AGENTS.md', 'docs/sub/CLAUDE.md', 'docs/.claude/x.md', 'docs/skills/x/SKILL.md', 'CLAUDE.md', 'AGENTS.md',
    'tests/gateway.test.ts', 'lib/useFoo.ts', 'lib/sub/x.ts', 'lib/x.tsx', 'lib/auth.ts', 'package.json', 'vercel.json',
    'middleware.ts', 'docs/x.sql', '.GitHub/workflows/a.yml', 'Scripts/a.mjs', 'docs/../scripts/a.mjs',
  ])('review probe %s -> NO', (p) => expect(laneClass(p).no).toBeTruthy());
  it('a tests file is NO in soft and in docs-canary', () => {
    for (const mode of ['soft', 'docs-canary']) {
      const v = mergeVerdict({ mode, files: ['docs/a.md', 'tests/a.test.ts'], pr: { changedFiles: 2 } });
      expect(v.merge).toBe(false);
      expect(v.reasons).toContain('tests path tests/a.test.ts: content is not read, owner-merged');
    }
  });
});

describe('r4b N2: bodyFilled', () => {
  it.each(R4B_BODIES)('%j filled=%s', (b, filled) => {
    expect(bodyFilled(b + NOT)).toMatchObject({ verified: filled, notVerified: true });
    const v = mergeVerdict({ body: b + NOT });
    expect(v.reasons.includes('Verified line not filled')).toBe(!filled);
  });
  it('a placeholder Not verified is unfilled too', () => {
    expect(bodyFilled('Verified: unit green\nNot verified: -').notVerified).toBe(false);
  });
});

describe('r4b N3a: labels compare lower-cased', () => {
  it.each(R4B_LABELS)('%j', (labels, want) => {
    const v = mergeVerdict({ labels });
    if (typeof want === 'string') expect(v.reasons).not.toContain(want);
    else expect(v.reasons.some((r: string) => want.test(r))).toBe(true);
  });
  it('a Review-Passed label event by the bot after the push counts', () => {
    const v = mergeVerdict({
      labels: ['Review-Passed'], pushAnchorMs: 1000,
      labelEvents: [{ event: 'labeled', label: { name: 'REVIEW-PASSED' }, actor: { login: 'kiki-claude-bot' }, created_at: new Date(5000).toISOString() }],
    });
    expect(v.reasons.filter((r: string) => /review-passed/.test(r))).toEqual([]);
  });
});
