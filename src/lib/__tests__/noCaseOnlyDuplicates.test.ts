// Two tracked files under src/ that differ only by letter case break builds on
// case-insensitive filesystems (Windows, macOS): `import './WhichPage'` resolved the
// model .ts first and the New event flow died. Linux builds pass, so CI cannot see it.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/** Groups of tracked module paths that import the same specifier once case is ignored but are not spelled alike. */
export function caseOnlyCollisions(paths: readonly string[]): string[][] {
  const byStem = new Map<string, string[]>();
  for (const p of paths) {
    const stem = p.replace(/\.(tsx?|jsx?|mjs|cjs)$/, '').toLowerCase();
    byStem.set(stem, [...(byStem.get(stem) ?? []), p]);
  }
  const spelled = (g: string[]) => new Set(g.map((p) => p.replace(/\.(tsx?|jsx?|mjs|cjs)$/, ''))).size > 1;
  return [...byStem.values()].filter(spelled);
}

describe('no two tracked src/ files differ only by case', () => {
  it('flags a pair (self-check)', () => {
    expect(caseOnlyCollisions(['src/a/WhichPage.tsx', 'src/a/whichPage.ts', 'src/a/other.ts', 'src/a/x.ts', 'src/a/x.test.ts'])).toEqual([['src/a/WhichPage.tsx', 'src/a/whichPage.ts']]);
  });
  it('the repo has none', () => {
    const out = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' });
    expect(caseOnlyCollisions(out.split('\n').filter(Boolean))).toEqual([]);
  });
});
