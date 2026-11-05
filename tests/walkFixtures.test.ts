// Slice 10 Part A: survey-derived fixtures (counts only) and the coverage gap
// check (drills B3 and B4).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  API_ROW_CAP,
  shapeId,
  generateFixtures,
  assertNoPersonalData,
  coverageGaps,
  uncoveredUiFiles,
  validateCoverage,
  main,
} from '../scripts/lib/walk-fixtures.mjs';

const SURVEY = [
  { status: 'published', type: 'class', count: 40, empty: false, past: false, huge: false },
  { status: 'published', type: 'class', count: 3, empty: false, past: false, huge: false },
  { status: 'published', type: 'party', count: 2, empty: true, past: true, huge: false },
  { status: 'cancelled', type: 'festival', count: 1, empty: false, past: false, huge: true },
  { status: 'draft', type: 'class', count: 5, empty: false, past: true, huge: false },
];

describe('walk-fixtures: generateFixtures', () => {
  it('one fixture per distinct shape, counts summed, sorted', () => {
    const f = generateFixtures(SURVEY);
    expect(f.map((x: { shape: string }) => x.shape)).toEqual([
      'cancelled.festival.nonempty.upcoming.huge',
      'draft.class.nonempty.past.normal',
      'published.class.nonempty.upcoming.normal',
      'published.party.empty.past.normal',
    ]);
    expect(f.find((x: { shape: string }) => x.shape.startsWith('published.class')).surveyCount).toBe(43);
  });
  it('is deterministic and order-independent', () => {
    const a = JSON.stringify(generateFixtures(SURVEY));
    const b = JSON.stringify(generateFixtures([...SURVEY].reverse()));
    expect(a).toBe(b);
    expect(JSON.stringify(generateFixtures(SURVEY))).toBe(a);
  });
  it('empty -> no rows; huge -> over the 100-row API cap; placeholder names', () => {
    const f = generateFixtures(SURVEY);
    const empty = f.find((x: { empty: boolean }) => x.empty);
    const huge = f.find((x: { huge: boolean }) => x.huge);
    expect(API_ROW_CAP).toBe(100);
    expect(empty.items).toHaveLength(0);
    expect(huge.items.length).toBeGreaterThan(API_ROW_CAP);
    expect(huge.items[0]).toEqual({ id: 'fixture-001', name: 'Fixture event 001' });
    for (const x of f) {
      expect(Number.isInteger(x.surveyCount)).toBe(true);
      expect(() => assertNoPersonalData(x)).not.toThrow();
    }
  });
  it.each([
    ['not an array', { rows: [] }],
    ['negative count', [{ ...SURVEY[0], count: -1 }]],
    ['fractional count', [{ ...SURVEY[0], count: 1.5 }]],
    ['missing flag', [{ status: 'published', type: 'class', count: 1, empty: false, past: false }]],
    ['status with an email', [{ ...SURVEY[0], status: 'a@b.co' }]],
    ['type with spaces', [{ ...SURVEY[0], type: 'Jane Smith' }]],
    ['empty and huge at once', [{ ...SURVEY[0], empty: true, huge: true }]],
  ])('rejects %s', (_n, rows) => expect(() => generateFixtures(rows as never)).toThrow());
  it('shapeId spells every axis', () => {
    expect(shapeId(SURVEY[3])).toBe('cancelled.festival.nonempty.upcoming.huge');
  });
});

describe('walk-fixtures: assertNoPersonalData', () => {
  it.each([
    ['email', { name: 'jane.doe@example.com' }],
    ['phone', { note: '+44 7700 900123' }],
    ['plain phone', { note: '07700900123' }],
    ['url', { link: 'https://instagram.com/x' }],
    ['www url', { link: 'www.example.com' }],
    ['handle', { name: 'see @dancer_99' }],
    ['nested', { items: [{ name: 'ok' }, { name: 'x@y.io' }] }],
    ['in a key', { 'a@b.io': 1 }],
  ])('rejects %s', (_n, obj) => expect(() => assertNoPersonalData(obj)).toThrow(/personal/));
  it('accepts placeholders and counts', () => {
    expect(() => assertNoPersonalData({ id: 'fixture-001', name: 'Fixture event 001', n: 12345678 })).not.toThrow();
  });
});

describe('walk-fixtures: coverage', () => {
  const shapes = generateFixtures(SURVEY).map((x: { shape: string }) => x.shape);
  const doc = (screens: unknown[]) => ({ schemaVersion: 1, screens });
  it('full coverage -> no gaps', () => {
    expect(coverageGaps(doc([{ id: 's', uiFiles: ['src/a.tsx'], walk: 'w', shapes }]), shapes)).toEqual([]);
  });
  it('B4: an uncovered huge list is a gap (red)', () => {
    const gaps = coverageGaps(doc([{ id: 's', uiFiles: ['src/a.tsx'], walk: 'w', shapes: shapes.filter((s: string) => !s.endsWith('.huge')) }]), shapes);
    expect(gaps).toEqual([{ screen: 's', shape: 'cancelled.festival.nonempty.upcoming.huge', reason: 'uncovered-shape' }]);
  });
  it('a screen with no walk -> every shape is a gap, unless waived', () => {
    const d = doc([{ id: 's', uiFiles: ['src/a.tsx'], walk: null, shapes }]);
    expect(coverageGaps(d, shapes)).toHaveLength(shapes.length);
    expect(coverageGaps(d, shapes)[0].reason).toBe('no-walk');
    expect(coverageGaps(d, shapes, { waivedScreens: ['s'] })).toEqual([]);
  });
  it('B3: a UI file with no walk mapped is red unless waived', () => {
    const d = doc([{ id: 's', uiFiles: ['src/a.tsx'], walk: 'w', shapes }, { id: 't', uiFiles: ['src/c.tsx'], walk: null, shapes }]);
    expect(uncoveredUiFiles(d, ['src/a.tsx', 'src/b.tsx', 'src/c.tsx'])).toEqual(['src/b.tsx', 'src/c.tsx']);
    expect(uncoveredUiFiles(d, ['src/a.tsx', 'src/c.tsx'], { waivedFiles: ['src/c.tsx'] })).toEqual([]);
  });
  it('malformed coverage doc -> throws (fail closed, never "no gaps")', () => {
    expect(() => coverageGaps({} as never, shapes)).toThrow();
    expect(() => coverageGaps(doc([{ id: 's' }]), shapes)).toThrow();
  });
  it('the seeded docs/design/walk-coverage.json validates and has one example screen only', () => {
    const seeded = JSON.parse(readFileSync(path.resolve(__dirname, '../docs/design/walk-coverage.json'), 'utf8'));
    expect(validateCoverage(seeded).ok).toBe(true);
    expect(seeded.screens).toHaveLength(1);
    expect(seeded.screens[0].example).toBe(true);
    expect(() => assertNoPersonalData(seeded)).not.toThrow();
  });
});

describe('walk-fixtures: main', () => {
  const run = (argv: string[], files: Record<string, string>) => {
    const out: string[] = [];
    const code = main(argv, { readFile: (p: string) => { if (!(p in files)) throw new Error('ENOENT'); return files[p]; }, log: (s: string) => out.push(s), error: (s: string) => out.push(s) });
    return { code, out: out.join('\n') };
  };
  it('prints fixtures, exit 0', () => {
    const r = run(['--survey', 's.json'], { 's.json': JSON.stringify(SURVEY) });
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toHaveLength(4);
  });
  it('exit 1 on a bad survey', () => expect(run(['--survey', 's.json'], { 's.json': '[{"status":1}]' }).code).toBe(1));
  it('exit 2 on usage error', () => expect(run([], {}).code).toBe(2));
});
