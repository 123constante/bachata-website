/** D22: no section labels and no status tags on Home or Switch (the Live chip is the one status mark). */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const DIRS = ['home', 'switch'];
const SKIP = new Set(['__tests__', 'onboarding']);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return SKIP.has(name) ? [] : files(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

describe('D22 under home/ and switch/', () => {
  it('no SectionLabel or StatusTag import', () => {
    const all = DIRS.flatMap((d) => files(join(ROOT, d)));
    expect(all.length).toBeGreaterThan(2);
    const offenders = all.filter((f) => /\b(SectionLabel|StatusTag)\b/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
