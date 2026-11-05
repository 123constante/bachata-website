// Role x surface: no edit control in the event screens compares the role to 'owner'.
// Managers have full edit (owner choice 2026-11-04). Team control and Hand over live
// outside this folder (teamRules.ts, handover/*) and stay owner-only on purpose.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, '..');
// programmeSeriesApi.ts derives the role label (owner if any owner seat, else manager); it gates nothing.
const ALLOWED: string[] = ['programmeSeriesApi.ts'];
const files = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f));

describe('managers have full edit on the event screens', () => {
  it('no non-test file in events/ gates an edit control on role === owner / isOwner', () => {
    const hits = files.flatMap((f) =>
      readFileSync(join(DIR, f), 'utf8').split('\n')
        .map((line, i) => ({ f, i: i + 1, line }))
        .filter(({ line }) => /role\s*===\s*'owner'(?!\s*\|\|\s*role\s*===\s*'manager')|isOwner\b|MANAGER_REASON/.test(line)),
    ).map(({ f, i }) => `${f}:${i}`).filter((h) => !ALLOWED.includes(h.split(':')[0]));
    expect(hits).toEqual([]);
  });
});
