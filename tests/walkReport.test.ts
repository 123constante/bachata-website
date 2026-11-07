// Slice 10 Part B glue: buildJudgeReport turns flat runner records into the
// report judgeVerdict reads. Every row is a way the builder could hand the judge
// a report that reads better than the walk did.
import { describe, it, expect } from 'vitest';
import { buildJudgeReport, pictureName, main } from '../scripts/lib/walk-report.mjs';
import { judgeVerdict, isPass, RUBRIC, ENGINES, VIEWPORT } from '../scripts/lib/walk-judge.mjs';
import { generateFixtures } from '../scripts/lib/walk-fixtures.mjs';

const HEAD = 'c'.repeat(40);
const SHA = 'd'.repeat(64);
type Rec = Record<string, unknown>;

const SURVEY = [
  { status: 'published', type: 'class', count: 40, empty: false, past: false, huge: false },
  { status: 'published', type: 'party', count: 2, empty: true, past: true, huge: false },
  { status: 'cancelled', type: 'festival', count: 1, empty: false, past: false, huge: true },
];
const SHAPES: string[] = generateFixtures(SURVEY).map((f: { shape: string }) => f.shape);
const SCREENS = [
  { id: 'event-page', shapes: SHAPES },
  { id: 'calendar', shapes: SHAPES.slice(0, 1) },
];

const passing = (): Rec =>
  Object.fromEntries((RUBRIC as { id: string; op: string; threshold: number }[]).map((r) => [r.id, r.op === '>=' ? r.threshold + 1 : 0]));

function goodRecords(): Rec[] {
  const out: Rec[] = [];
  for (const s of SCREENS) for (const shape of s.shapes) for (const engine of ENGINES as string[]) {
    out.push({ screen: s.id, shape, engine, viewport: { ...VIEWPORT }, ...passing() });
  }
  return out;
}
const picturesFor = (records: Rec[]) =>
  records.map((r) => ({ name: pictureName(r.screen, r.shape, r.engine), sha256: SHA }));

function makeInput() {
  return {
    headSha: HEAD,
    engines: ['chromium', 'webkit'],
    screens: SCREENS.map((s) => ({ ...s, shapes: [...s.shapes] })),
    builderModelId: 'claude-opus-builder',
    judgeModelId: 'claude-sonnet-judge',
    builderSessionId: 'session-builder-1',
    judgeSessionId: 'session-judge-1',
  };
}

describe('walk-report: round trip through the judge', () => {
  it('good fixtures -> no problems -> judge passes', () => {
    const records = goodRecords();
    const { report, problems } = buildJudgeReport({ headSha: HEAD, records, pictures: picturesFor(records) });
    expect(problems).toEqual([]);
    const v = judgeVerdict(makeInput(), report);
    expect(v.reasons).toEqual([]);
    expect(isPass(v, HEAD)).toBe(true);
    expect(v.cited).toHaveLength(RUBRIC.length * records.length);
  });
  it('one webkit record removed -> judge red on that engine, builder still reports no duplicate', () => {
    const all = goodRecords();
    const records = all.filter((r, i) => !(r.engine === 'webkit' && i === all.findIndex((x) => x.engine === 'webkit')));
    expect(records).toHaveLength(all.length - 1);
    const { report } = buildJudgeReport({ headSha: HEAD, records, pictures: picturesFor(all) });
    const v = judgeVerdict(makeInput(), report);
    expect(v.verdict).toBe('red');
    expect(isPass(v, HEAD)).toBe(false);
    expect(v.reasons.some((r: string) => r.endsWith('/ webkit: engine absent'))).toBe(true);
  });
});

describe('walk-report: problems table', () => {
  const base = () => goodRecords();
  const rows: [string, (r: Rec[]) => Rec[], RegExp, (rep: { measurements: Record<string, Record<string, Record<string, Rec>>> }) => void][] = [
    ['duplicate record: second dropped, never merged', (r) => [...r, { ...r[0], tapTargets: 10, extra: 1 }], /duplicate record/,
      (rep) => {
        const m = rep.measurements[r0().screen as string][r0().shape as string][r0().engine as string];
        expect(m.tapTargets).toBe(passing().tapTargets);
      }],
    ['unknown engine dropped', (r) => [...r, { ...r[0], engine: 'firefox' }], /engine firefox is unknown/,
      (rep) => { expect(Object.keys(rep.measurements[r0().screen as string][r0().shape as string])).toEqual(['chromium', 'webkit']); }],
    ['NaN drops the record', (r) => r.map((x, i) => (i === 0 ? { ...x, contrast: Number.NaN } : x)), /contrast not a finite number/,
      (rep) => { expect(rep.measurements[r0().screen as string][r0().shape as string][r0().engine as string]).toBeUndefined(); }],
    ['Infinity drops the record', (r) => r.map((x, i) => (i === 0 ? { ...x, tapTargets: Infinity } : x)), /tapTargets not a finite number/,
      (rep) => { expect(rep.measurements[r0().screen as string][r0().shape as string][r0().engine as string]).toBeUndefined(); }],
    ['string number drops the record', (r) => r.map((x, i) => (i === 0 ? { ...x, tapTargets: '44' } : x)), /tapTargets not a finite number/,
      (rep) => { expect(rep.measurements[r0().screen as string][r0().shape as string][r0().engine as string]).toBeUndefined(); }],
    ['missing field stays missing', (r) => r.map((x, i) => { if (i !== 0) return x; const { contrast: _c, ...rest } = x; return rest; }), /contrast missing/,
      (rep) => { expect('contrast' in rep.measurements[r0().screen as string][r0().shape as string][r0().engine as string]).toBe(false); }],
    ['missing viewport stays missing', (r) => r.map((x, i) => { if (i !== 0) return x; const { viewport: _v, ...rest } = x; return rest; }), /viewport missing/,
      (rep) => { expect('viewport' in rep.measurements[r0().screen as string][r0().shape as string][r0().engine as string]).toBe(false); }],
    ['record with no screen', (r) => [...r, { ...r[0], screen: '' }], /has no screen or shape/, () => {}],
    ['record not an object', (r) => [...r, 7 as unknown as Rec], /is not an object/, () => {}],
    ['reserved screen name', (r) => [...r, { ...r[0], screen: '__proto__' }], /reserved name/,
      (rep) => { expect(Object.getPrototypeOf(rep.measurements)).toBe(Object.prototype); }],
  ];
  const r0 = () => base()[0];
  it.each(rows)('%s', (_name, edit, want, check) => {
    const records = edit(base());
    const { report, problems } = buildJudgeReport({ headSha: HEAD, records, pictures: picturesFor(base()) });
    expect(problems.some((p: string) => want.test(p))).toBe(true);
    check(report);
  });

  it('a dropped bad record is not called kept, and its picture is not demanded', () => {
    const good = goodRecords();
    const records = [{ ...good[0], contrast: Number.NaN }, ...good];
    const { problems } = buildJudgeReport({ headSha: HEAD, records, pictures: picturesFor(good).slice(1) });
    expect(problems.some((p: string) => /duplicate record records\[1\] dropped \(an earlier record/.test(p))).toBe(true);
    expect(problems.some((p: string) => /picture .* missing/.test(p))).toBe(false);
  });
  it('extra unknown fields are stripped; only rubric ids and viewport survive', () => {
    const records = goodRecords().map((r) => ({ ...r, note: 'x', score: 99, viewport: { ...VIEWPORT, dpr: 3 } }));
    const { report, problems } = buildJudgeReport({ headSha: HEAD, records, pictures: picturesFor(records) });
    expect(problems).toEqual([]);
    const m = report.measurements.calendar[SHAPES[0]].webkit;
    expect(Object.keys(m).sort()).toEqual(['viewport', ...RUBRIC.map((r: { id: string }) => r.id)].sort());
    expect(m.viewport).toEqual({ width: 390, height: 844 });
  });
  it('empty records is a problem and the judge goes red', () => {
    const { report, problems } = buildJudgeReport({ headSha: HEAD, records: [], pictures: [] });
    expect(problems.join()).toMatch(/records is empty/);
    expect(report.measurements).toEqual({});
    expect(judgeVerdict(makeInput(), report).verdict).toBe('red');
  });
  it.each([['short', 'abc'], ['upper', 'C'.repeat(40)], ['missing', undefined], ['41 chars', 'c'.repeat(41)]])(
    'head %s is a problem, kept as given so the judge reds it', (_n, head) => {
      const records = goodRecords();
      const { report, problems } = buildJudgeReport({ headSha: head, records, pictures: picturesFor(records) });
      expect(problems).toContain('headSha is not a 40-hex sha');
      expect(report.headSha).toBe(head);
      expect(isPass(judgeVerdict(makeInput(), report), HEAD)).toBe(false);
    });
  it('a missing picture is a problem; pictures and doubts pass through as given', () => {
    const records = goodRecords();
    const pictures = picturesFor(records).slice(1);
    const { report, problems } = buildJudgeReport({ headSha: HEAD, records, pictures, doubts: ['looks off'] });
    expect(problems).toEqual([`picture ${pictureName(records[0].screen, records[0].shape, records[0].engine)} missing`]);
    expect(report.pictures).toBe(pictures);
    expect(report.doubts).toEqual(['looks off']);
  });
  it.each([null, undefined, 'x', 5])('never throws on garbage args (%s)', (args) => {
    const out = buildJudgeReport(args);
    expect(out.problems.length).toBeGreaterThan(0);
  });
});

describe('walk-report: pictureName', () => {
  it('matches the name the judge looks up', () => {
    expect(pictureName('event-page', 'published.class.nonempty.upcoming.normal', 'webkit'))
      .toBe('event-page--published.class.nonempty.upcoming.normal--webkit.png');
  });
  it('a picture renamed off the format makes the judge red', () => {
    const records = goodRecords();
    const pictures = picturesFor(records).map((p, i) => (i === 0 ? { ...p, name: p.name.replace('--', '__') } : p));
    const { report } = buildJudgeReport({ headSha: HEAD, records, pictures });
    expect(judgeVerdict(makeInput(), report).reasons.some((r: string) => r.endsWith('picture missing'))).toBe(true);
  });
});

describe('walk-report: main()', () => {
  const run = (argv: string[], files: Record<string, string>) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = main(argv, {
      readFile: (p: string) => { if (!(p in files)) throw new Error('ENOENT'); return files[p]; },
      log: (s: string) => out.push(s),
      error: (s: string) => err.push(s),
    });
    return { code, out, err };
  };
  const records = goodRecords();
  const files = { 'r.json': JSON.stringify(records), 'p.json': JSON.stringify(picturesFor(records)), 'd.json': '["hmm"]' };
  it('0 with no problems, prints the report', () => {
    const { code, out } = run(['--records', 'r.json', '--pictures', 'p.json', '--head', HEAD, '--doubts', 'd.json'], files);
    expect(code).toBe(0);
    expect(JSON.parse(out[0]).doubts).toEqual(['hmm']);
  });
  it('1 with problems, still prints the report', () => {
    const { code, out, err } = run(['--records', 'r.json', '--pictures', 'p.json', '--head', 'nope'], files);
    expect(code).toBe(1);
    expect(JSON.parse(out[0]).headSha).toBe('nope');
    expect(err.join()).toMatch(/40-hex/);
  });
  it('1 on an unreadable file', () => {
    expect(run(['--records', 'missing.json', '--pictures', 'p.json', '--head', HEAD], files).code).toBe(1);
  });
  it.each([[[]], [['--records', 'r.json', '--pictures', 'p.json']], [['--records', 'r.json', '--pictures', 'p.json', '--head', HEAD, '--doubts']]])(
    '2 on usage error %j', (argv) => {
      expect(run(argv as string[], files).code).toBe(2);
    });
});
