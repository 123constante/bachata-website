import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isListedSeries } from '../homeModel';

describe('isListedSeries (R3-4: the ONE archived predicate)', () => {
  it.each([
    ['live', true], ['draft', true], ['paused', true], ['ended', true], ['archived', false],
  ])('%s -> %s', (lifecycle_status, listed) => {
    expect(isListedSeries({ lifecycle_status })).toBe(listed);
  });

  it('no other file in the module spells its own archived filter on a series', () => {
    const root = resolve(__dirname, '../..');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) return n === '__tests__' ? [] : walk(p);
      return /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
    const offenders = ['jobs/homeJobs.ts', 'shared/dateList.ts']
      .map((f) => join(root, f))
      .filter((f) => /lifecycle_status\s*!==?\s*'archived'/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
    expect(walk(root).length).toBeGreaterThan(0);
  });
});
