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
  screensMissingFromCoverage,
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

describe('walk-fixtures r1: empties are errors, never "no gaps"', () => {
  const shapes = generateFixtures(SURVEY).map((x: { shape: string }) => x.shape);
  const doc = (screens: unknown[]) => ({ schemaVersion: 1, screens });
  it('coverageGaps with screens [] throws', () => expect(() => coverageGaps(doc([]), shapes)).toThrow(/screens/));
  it('coverageGaps with shapes [] throws', () => {
    expect(() => coverageGaps(doc([{ id: 's', uiFiles: ['src/a.tsx'], walk: 'w', shapes }]), [])).toThrow(/shapes/);
  });
  it('generateFixtures([]) throws', () => expect(() => generateFixtures([])).toThrow(/empty/));
  it('CLI on an empty survey exits non-zero', () => {
    const out: string[] = [];
    const code = main(['--survey', 's.json'], { readFile: () => '[]', log: (s: string) => out.push(s), error: (s: string) => out.push(s) });
    expect(code).toBe(1);
    expect(out.join('\n')).toMatch(/empty/);
  });
});

// ---- brief walk-judge-screens-tied-to-coverage: the lane's screen list is
// compared with docs/design/walk-coverage.json (cases C1 to C12).
describe('walk-fixtures: screensMissingFromCoverage', () => {
  const A = 'published.class.nonempty.upcoming.normal';
  const B = 'published.class.nonempty.upcoming.huge';
  const row = (id: string, shapes: string[], extra: Record<string, unknown> = {}) => ({ id, uiFiles: [`src/pages/${id}.tsx`], walk: `${id}-walk`, shapes, ...extra });
  const cov = (...screens: unknown[]) => ({ schemaVersion: 1, screens });
  const COV = cov(row('event-page', [A, B]), row('calendar', [A]), row('example-screen', [A], { example: true }));
  const cases: [string, unknown, unknown, RegExp[]][] = [
    ['C1 exact match', COV, [{ id: 'event-page', shapes: [A, B] }, { id: 'calendar', shapes: [A] }], []],
    ['C2 extra input shapes are fine', COV, [{ id: 'event-page', shapes: [B, A, 'x.y.empty.past.normal'] }, { id: 'calendar', shapes: [A] }], []],
    ['C3 coverage screen missing from input', COV, [{ id: 'event-page', shapes: [A, B] }], [/^screen calendar is required by walk-coverage\.json but not in input\.screens$/]],
    ['C4 extra input screen', COV, [{ id: 'event-page', shapes: [A, B] }, { id: 'calendar', shapes: [A] }, { id: 'stray', shapes: [A] }], [/^screen stray is in input\.screens but not in walk-coverage\.json$/]],
    ['C5 missing shape', COV, [{ id: 'event-page', shapes: [A] }, { id: 'calendar', shapes: [A] }], [new RegExp(`^screen event-page: shape ${B.replace(/\./g, '\\.')} is required by walk-coverage\\.json but not in input\\.screens$`)]],
    ['C6 example row ignored (not required)', COV, [{ id: 'event-page', shapes: [A, B] }, { id: 'calendar', shapes: [A] }], []],
    ['C7 example row ignored (not a real screen)', COV, [{ id: 'event-page', shapes: [A, B] }, { id: 'calendar', shapes: [A] }, { id: 'example-screen', shapes: [A] }], [/^screen example-screen is in input\.screens but is only an example row in walk-coverage\.json$/]],
    ['C8 empty coverage', cov(), [{ id: 'event-page', shapes: [A] }], [/no non-example screens/]],
    ['C9 only example rows', cov(row('example-screen', [A], { example: true })), [{ id: 'example-screen', shapes: [A] }], [/no non-example screens/]],
    ['C10 malformed coverage', { schemaVersion: 1, screens: 'nope' }, [{ id: 'event-page', shapes: [A] }], [/^walk-coverage is malformed: /]],
    ['C11 coverage not an object', null, [{ id: 'event-page', shapes: [A] }], [/^walk-coverage is malformed: /]],
    ['C12 input screens not a list', COV, 'event-page', [/^input\.screens is malformed/]],
    ['C13 input screen without shapes', COV, [{ id: 'event-page' }, { id: 'calendar', shapes: [A] }], [/^input\.screens is malformed/]],
    ['C15 required screen with no shapes is not "agrees"', cov(row('event-page', [])), [{ id: 'event-page', shapes: [A] }], [/^screen event-page lists no shapes/]],
    ['C16 repeated input screen id', COV, [{ id: 'calendar', shapes: [A] }, { id: 'calendar', shapes: [] }], [/^input\.screens is malformed/]],
    ['C17 non-string input shape', COV, [{ id: 'event-page', shapes: [A, 7] }, { id: 'calendar', shapes: [A] }], [/^input\.screens is malformed/]],
    ['C14 several problems, all reported', COV, [{ id: 'event-page', shapes: [A] }, { id: 'stray', shapes: [A] }], [/calendar is required/, /event-page: shape/, /stray is in input/]],
  ];
  it.each(cases)('%s', (_name, coverage, screens, want) => {
    const got = screensMissingFromCoverage(coverage, screens);
    expect(Array.isArray(got)).toBe(true);
    expect(got).toHaveLength(want.length);
    want.forEach((re) => expect(got.some((p: string) => re.test(p))).toBe(true));
  });
  it('malformed input of every kind returns ONE problem string and never throws', () => {
    for (const [c, s] of [[undefined, []], [42, []], [COV, undefined], [COV, [null]], [COV, [{ id: '', shapes: [A] }]], [{ schemaVersion: 2, screens: [] }, []]] as [unknown, unknown][]) {
      let got: unknown;
      expect(() => { got = screensMissingFromCoverage(c, s); }).not.toThrow();
      expect(got).toHaveLength(1);
      expect(typeof (got as string[])[0]).toBe('string');
    }
  });
  it('the seeded walk-coverage.json (example row only) is red against any screen list', () => {
    const seeded = JSON.parse(readFileSync(path.resolve(__dirname, '../docs/design/walk-coverage.json'), 'utf8'));
    expect(screensMissingFromCoverage(seeded, [{ id: 'example-screen', shapes: seeded.screens[0].shapes }]).length).toBeGreaterThan(0);
  });
});
