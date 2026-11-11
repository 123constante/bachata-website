// Slice 10 Part A: the walk judge's fail-closed verdict. Every row here is a way
// a verdict could wrongly read `pass`; the suite is the contract the mutant
// table in the PR body was run against (M1-M7).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  JUDGE_CONFIG,
  RUBRIC,
  ENGINES,
  validateJudgeInput,
  judgeVerdict,
  verdictSchema,
  isPass,
  flattenConstants,
  VIEWPORT,
  MAX_PX,
  main,
  screensMissingFromCoverage,
} from '../scripts/lib/walk-judge.mjs';
import { screensMissingFromCoverage as fromFixtures } from '../scripts/lib/walk-fixtures.mjs';

const HEAD = 'a'.repeat(40);
const SHA = 'b'.repeat(64);
const SCREENS = [
  { id: 'event-page', shapes: ['published.class.nonempty.upcoming.normal'] },
  { id: 'calendar', shapes: ['published.party.empty.past.normal'] },
];

type Num = unknown;
const passing = (): Record<string, Num> =>
  Object.fromEntries(RUBRIC.map((r: { id: string; op: string; threshold: number }) => [r.id, r.op === '>=' ? r.threshold + 1 : 0]));

function makeInput(over: Record<string, unknown> = {}) {
  return {
    headSha: HEAD,
    engines: ['chromium', 'webkit'],
    screens: SCREENS.map((s) => ({ ...s, shapes: [...s.shapes] })),
    builderModelId: 'claude-opus-builder',
    judgeModelId: 'claude-sonnet-judge',
    builderSessionId: 'session-builder-1',
    judgeSessionId: 'session-judge-1',
    ...over,
  };
}

function makeReport(edit?: (m: Record<string, Num>, screen: string, shape: string, engine: string) => void) {
  const measurements: Record<string, Record<string, Record<string, Record<string, Num>>>> = {};
  const pictures: { name: string; sha256: string }[] = [];
  for (const s of SCREENS) {
    measurements[s.id] = {};
    for (const shape of s.shapes) {
      measurements[s.id][shape] = {};
      for (const engine of ['chromium', 'webkit']) {
        const m: Record<string, Num> = { ...passing(), viewport: { width: 390, height: 844 } };
        if (edit) edit(m, s.id, shape, engine);
        measurements[s.id][shape][engine] = m;
        pictures.push({ name: `${s.id}--${shape}--${engine}.png`, sha256: SHA });
      }
    }
  }
  return { headSha: HEAD, measurements, pictures, doubts: [] as string[] };
}

describe('walk-judge: happy path', () => {
  it('passes only when every check is cited on every screen x shape x engine', () => {
    const v = judgeVerdict(makeInput(), makeReport());
    expect(v.verdict).toBe('pass');
    expect(isPass(v, HEAD)).toBe(true);
    expect(v.cited).toHaveLength(RUBRIC.length * 2 * 2);
    expect(v.engines).toEqual(['chromium', 'webkit']);
    expect(v.invalidatedBy).toBe('any push');
    expect(v.headSha).toBe(HEAD);
  });
});

// One row per rubric check x {pass, boundary-fail, boundary-pass, missing, NaN} x engine.
const rows: [string, string, string, Num, 'pass' | 'red'][] = [];
for (const r of RUBRIC as { id: string; op: string; threshold: number }[]) {
  const boundaryFail = r.op === '>=' ? (r.threshold === 44 ? 43.9 : r.threshold === 4.5 ? 4.49 : r.threshold - 0.1) : r.threshold + 1;
  for (const engine of ENGINES as string[]) {
    rows.push([r.id, engine, 'pass', r.op === '>=' ? r.threshold + 1 : 0, 'pass']);
    rows.push([r.id, engine, 'boundary-pass', r.threshold, 'pass']);
    rows.push([r.id, engine, 'boundary-fail', boundaryFail, 'red']);
    rows.push([r.id, engine, 'missing', undefined, 'red']);
    rows.push([r.id, engine, 'NaN', Number.NaN, 'red']);
    rows.push([r.id, engine, 'string', '44', 'red']);
  }
}

describe('walk-judge: rubric table (check x case x engine)', () => {
  it.each(rows)('%s on %s, %s -> %s', (check, engine, _case, value, want) => {
    const report = makeReport((m, screen, _shape, eng) => {
      if (screen === 'calendar' && eng === engine) {
        if (value === undefined) delete m[check];
        else m[check] = value;
      }
    });
    const v = judgeVerdict(makeInput(), report);
    expect(v.verdict).toBe(want);
    expect(isPass(v, HEAD)).toBe(want === 'pass');
    if (want === 'red') expect(v.reasons.join(' ')).toContain(check);
  });

  it('a failure in only ONE engine is red (webkit-only clipping, chromium-only tap size)', () => {
    const w = makeReport((m, _s, _sh, eng) => { if (eng === 'webkit') m.noClipping = 1; });
    expect(judgeVerdict(makeInput(), w).verdict).toBe('red');
    const c = makeReport((m, _s, _sh, eng) => { if (eng === 'chromium') m.tapTargets = 40; });
    expect(judgeVerdict(makeInput(), c).verdict).toBe('red');
  });
});

describe('walk-judge: rubric is fixed and ordered', () => {
  it('has the exact ids in the exact order', () => {
    expect(RUBRIC.map((r: { id: string }) => r.id)).toEqual([
      'tapTargets', 'noSidewaysScroll', 'noClipping', 'contrast', 'emptyLoadingErrorHaveAction',
      'iosInputFontSize', 'iosNoRawVh', 'iosFixedBarsSafeArea',
    ]);
    expect(Object.isFrozen(RUBRIC)).toBe(true);
    expect(RUBRIC.find((r: { id: string }) => r.id === 'tapTargets').threshold).toBe(44);
    expect(RUBRIC.find((r: { id: string }) => r.id === 'contrast').threshold).toBe(4.5);
    expect(RUBRIC.find((r: { id: string }) => r.id === 'iosInputFontSize').threshold).toBe(16);
  });
});

describe('walk-judge: model and session separation (14.2)', () => {
  const cases: [string, Record<string, unknown>][] = [
    ['same model id', { judgeModelId: 'claude-opus-builder' }],
    ['same model id, different case', { judgeModelId: 'CLAUDE-OPUS-BUILDER' }],
    ['same session id', { judgeSessionId: 'session-builder-1' }],
    ['missing builder model', { builderModelId: undefined }],
    ['missing judge model', { judgeModelId: '' }],
    ['missing builder session', { builderSessionId: undefined }],
    ['missing judge session', { judgeSessionId: '   ' }],
    ['non-string judge model', { judgeModelId: 7 }],
  ];
  it.each(cases)('%s -> red', (_name, over) => {
    const v = judgeVerdict(makeInput(over), makeReport());
    expect(v.verdict).toBe('red');
    expect(isPass(v, HEAD)).toBe(false);
  });
});

describe('walk-judge: fail-closed on everything else', () => {
  it('stale head sha (report measured a different head) -> red', () => {
    const r = makeReport();
    r.headSha = 'c'.repeat(40);
    const v = judgeVerdict(makeInput(), r);
    expect(v.verdict).toBe('red');
    expect(v.reasons.join(' ')).toMatch(/head/i);
  });
  it('malformed head sha -> red', () => {
    expect(judgeVerdict(makeInput({ headSha: 'abc' }), { ...makeReport(), headSha: 'abc' }).verdict).toBe('red');
  });
  it('missing picture -> red', () => {
    const r = makeReport();
    r.pictures.pop();
    expect(judgeVerdict(makeInput(), r).verdict).toBe('red');
  });
  it('picture with a bad sha256 -> red', () => {
    const r = makeReport();
    r.pictures[0].sha256 = 'nope';
    expect(judgeVerdict(makeInput(), r).verdict).toBe('red');
  });
  it('unknown shape in the report -> red', () => {
    const r = makeReport();
    r.measurements['event-page']['ghost.shape.nonempty.upcoming.normal'] = { chromium: passing(), webkit: passing() };
    expect(judgeVerdict(makeInput(), r).verdict).toBe('red');
  });
  it('shape listed but not measured -> red', () => {
    const r = makeReport();
    delete r.measurements.calendar['published.party.empty.past.normal'];
    expect(judgeVerdict(makeInput(), r).verdict).toBe('red');
  });
  it('absent engine in input -> red', () => {
    expect(judgeVerdict(makeInput({ engines: ['chromium'] }), makeReport()).verdict).toBe('red');
  });
  it('absent engine in report -> red', () => {
    const r = makeReport();
    delete r.measurements.calendar['published.party.empty.past.normal'].webkit;
    expect(judgeVerdict(makeInput(), r).verdict).toBe('red');
  });
  it('unknown engine -> red', () => {
    expect(judgeVerdict(makeInput({ engines: ['chromium', 'webkit', 'firefox'] }), makeReport()).verdict).toBe('red');
  });
  it('a verdict with no numbers is red', () => {
    expect(judgeVerdict(makeInput(), { headSha: HEAD, measurements: {}, pictures: [], doubts: [] }).verdict).toBe('red');
    expect(judgeVerdict(makeInput({ screens: [] }), { headSha: HEAD, measurements: {}, pictures: [], doubts: [] }).verdict).toBe('red');
  });
  it('judge doubt with all numbers good -> doubt, and doubt is not pass', () => {
    const r = makeReport();
    r.doubts = ['picture 3 looks cropped but no number says so'];
    const v = judgeVerdict(makeInput(), r);
    expect(v.verdict).toBe('doubt');
    expect(isPass(v, HEAD)).toBe(false);
  });
  it('doubt plus a measured failure -> red', () => {
    const r = makeReport((m) => { m.contrast = 3; });
    r.doubts = ['also unsure'];
    expect(judgeVerdict(makeInput(), r).verdict).toBe('red');
  });
  it.each([
    ['empty input', {}],
    ['null input', null],
    ['undefined', undefined],
    ['a string', 'pass'],
    ['an array', []],
    ['a number', 1],
  ])('%s -> red', (_n, input) => {
    expect(judgeVerdict(input as never, makeReport()).verdict).toBe('red');
    expect(judgeVerdict(makeInput(), input as never).verdict).toBe('red');
  });
  it('a throwing getter in the report -> red, never pass', () => {
    const r = makeReport();
    Object.defineProperty(r, 'measurements', { get() { throw new Error('boom'); } });
    const v = judgeVerdict(makeInput(), r);
    expect(v.verdict).toBe('red');
    expect(v.reasons.join(' ')).toMatch(/threw/);
  });
  it('validateJudgeInput lists every problem', () => {
    expect(validateJudgeInput(makeInput()).ok).toBe(true);
    const bad = validateJudgeInput({ headSha: 'x', engines: [] });
    expect(bad.ok).toBe(false);
    expect(bad.errors.length).toBeGreaterThan(3);
  });
});

describe('walk-judge: isPass', () => {
  it.each([
    [{ verdict: 'pass' }, false],
    [{ verdict: 'doubt', headSha: HEAD, reasons: [], cited: [{}], engines: ENGINES, invalidatedBy: 'any push' }, false],
    [null, false],
    ['pass', false],
  ])('%j -> %s', (v, want) => expect(isPass(v, HEAD)).toBe(want));
  it('a pass with no cited numbers is not a pass', () => {
    const v = judgeVerdict(makeInput(), makeReport());
    expect(isPass({ ...v, cited: [] }, HEAD)).toBe(false);
  });
  it('the verdict schema names every output field', () => {
    expect(Object.keys(verdictSchema.properties).sort()).toEqual(
      ['cited', 'engines', 'headSha', 'invalidatedBy', 'reasons', 'verdict'],
    );
    expect(verdictSchema.properties.verdict.enum).toEqual(['pass', 'red', 'doubt']);
  });
});

describe('walk-judge: config', () => {
  it('budget, model and dispatcher constants', () => {
    expect(JUDGE_CONFIG.budget.walkWallLimitMinutes).toBe(15);
    expect(JUDGE_CONFIG.budget.judgeRuntimeHoursPerDay).toBe(3);
    expect(JUDGE_CONFIG.budget.judgeDispatchesPerDay).toBe(8);
    expect(JUDGE_CONFIG.model.defaultJudgeModel).toBe('sonnet');
    expect(JUDGE_CONFIG.dispatcher.liveWorkersPerBranch).toBe(1);
    expect(JUDGE_CONFIG.dispatcher.pauseModule).toBe('scripts/lib/automation-pause.mjs');
    expect(Object.isFrozen(JUDGE_CONFIG.budget)).toBe(true);
  });
});

describe('walk-judge: judge-worker.md cannot drift from the module', () => {
  const doc = readFileSync(path.resolve(__dirname, '../docs/automation/judge-worker.md'), 'utf8');
  const sections = ['Input', 'Rubric', 'Output', 'Model and budget', 'Dispatcher', 'Fail-closed rule', 'Residual risks'];
  it.each(sections)('has section %s', (s) => expect(doc).toMatch(new RegExp(`^## ${s}$`, 'm')));

  it('every constant row in the doc matches the module, and vice versa', () => {
    const docRows = new Map<string, string>();
    for (const m of doc.matchAll(/^\| `(JUDGE_CONFIG\.[\w.]+)` \| `([^`]*)` \|/gm)) docRows.set(m[1], m[2]);
    const mod = flattenConstants();
    expect(docRows.size).toBeGreaterThan(0);
    expect([...docRows.keys()].sort()).toEqual(Object.keys(mod).sort());
    for (const [k, v] of docRows) expect(v).toBe(mod[k]);
  });

  it('every rubric row in the doc matches the module, and vice versa', () => {
    const docRubric = [...doc.matchAll(/^\| \d+ \| `(\w+)` \| `(\w+)` \| `(>=|<=)` \| `([\d.]+)` \|/gm)].map((m) => ({
      id: m[1], metric: m[2], op: m[3], threshold: Number(m[4]),
    }));
    expect(docRubric).toEqual(RUBRIC.map((r: { id: string; metric: string; op: string; threshold: number }) => ({
      id: r.id, metric: r.metric, op: r.op, threshold: r.threshold,
    })));
  });
});

describe('walk-judge: main', () => {
  const files: Record<string, string> = {
    'in.json': JSON.stringify(makeInput()),
    'ok.json': JSON.stringify(makeReport()),
    'bad.json': JSON.stringify(makeReport((m) => { m.tapTargets = 10; })),
    'junk.json': '{not json',
  };
  const run = (argv: string[]) => {
    const out: string[] = [];
    const code = main(argv, { readFile: (p: string) => { if (!(p in files)) throw new Error('ENOENT'); return files[p]; }, log: (s: string) => out.push(s), error: (s: string) => out.push(s) });
    return { code, out: out.join('\n') };
  };
  it('exit 0 on pass', () => expect(run(['--input', 'in.json', '--report', 'ok.json']).code).toBe(0));
  it('exit 1 on red', () => {
    const r = run(['--input', 'in.json', '--report', 'bad.json']);
    expect(r.code).toBe(1);
    expect(JSON.parse(r.out).verdict).toBe('red');
  });
  it('exit 1 (red) on unparseable report', () => expect(run(['--input', 'in.json', '--report', 'junk.json']).code).toBe(1));
  it('exit 1 (red) on unreadable file', () => expect(run(['--input', 'in.json', '--report', 'nope.json']).code).toBe(1));
  it('exit 2 on usage error', () => expect(run([]).code).toBe(2));
});

// ---- fix round r1 (review of c79d9a07): F1 viewport, F2 ranges, F3 doubts, J8/J9/J10/J15/J23.
describe('walk-judge r1: F1 the 390x844 viewport is part of every measurement', () => {
  it('exports the phone viewport', () => expect(VIEWPORT).toEqual({ width: 390, height: 844 }));
  it.each([
    ['desktop 1280x800', { width: 1280, height: 800 }],
    ['width only right', { width: 390, height: 800 }],
    ['height only right', { width: 375, height: 844 }],
    ['strings', { width: '390', height: '844' }],
    ['null', null],
    ['an array', [390, 844]],
  ])('viewport %s on one engine -> red', (_n, vp) => {
    const r = makeReport((m, screen, _shape, eng) => { if (screen === 'calendar' && eng === 'webkit') m.viewport = vp; });
    const v = judgeVerdict(makeInput(), r);
    expect(v.verdict).toBe('red');
    expect(isPass(v, HEAD)).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/viewport/);
  });
  it('viewport missing on one engine -> red', () => {
    const r = makeReport((m, screen, _shape, eng) => { if (screen === 'event-page' && eng === 'chromium') delete m.viewport; });
    const v = judgeVerdict(makeInput(), r);
    expect(v.verdict).toBe('red');
    expect(v.reasons.join(' ')).toMatch(/viewport/);
  });
});

describe('walk-judge r1: F2 measured values have a sanity range', () => {
  const cases: [string, number][] = [
    ['noClipping', -5],
    ['noSidewaysScroll', -1],
    ['emptyLoadingErrorHaveAction', -0.5],
    ['iosNoRawVh', -1],
    ['iosFixedBarsSafeArea', -2],
    ['tapTargets', 1e9],
    ['tapTargets', -1],
    ['iosInputFontSize', 1e9],
    ['contrast', 1000],
    ['contrast', 21.01],
    ['contrast', 0.5],
  ];
  it.each(cases)('%s = %s -> red with an out-of-range reason', (check, n) => {
    const r = makeReport((m, screen) => { if (screen === 'calendar') m[check] = n; });
    const v = judgeVerdict(makeInput(), r);
    expect(v.verdict).toBe('red');
    expect(isPass(v, HEAD)).toBe(false);
    expect(v.reasons.join(' ')).toMatch(new RegExp(`${check} measured ${n} is out of range`));
  });
  it('the range edges pass: contrast 21, tap target and font at MAX_PX', () => {
    const r = makeReport((m) => { m.contrast = 21; m.tapTargets = MAX_PX; m.iosInputFontSize = MAX_PX; });
    expect(isPass(judgeVerdict(makeInput(), r), HEAD)).toBe(true);
    expect(Number.isFinite(MAX_PX)).toBe(true);
  });
  it('J9: Infinity via 1e999 in the report JSON -> red', () => {
    const text = JSON.stringify(makeReport()).replace('"tapTargets":45', '"tapTargets":1e999');
    expect(text).toContain('1e999');
    const v = judgeVerdict(makeInput(), JSON.parse(text));
    expect(v.verdict).toBe('red');
    expect(v.reasons.join(' ')).toMatch(/tapTargets has no measured number/);
  });
});

describe('walk-judge r1: F3 / J23 doubts are never silently dropped', () => {
  it.each([
    ['J23: a string doubts', 'looks cropped'],
    ['a non-string entry', [7]],
    ['a null entry', [null]],
    ['a blank entry', ['']],
    ['a whitespace entry', ['   ']],
    ['a good entry beside a blank one', ['looks cropped', '']],
    ['an object entry', [{ note: 'x' }]],
  ])('%s -> red', (_n, doubts) => {
    const r = { ...makeReport(), doubts: doubts as never };
    const v = judgeVerdict(makeInput(), r);
    expect(v.verdict).toBe('red');
    expect(isPass(v, HEAD)).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/doubts/);
  });
  it('every non-blank entry becomes a doubt', () => {
    const r = { ...makeReport(), doubts: ['one', 'two'] };
    const v = judgeVerdict(makeInput(), r);
    expect(v.verdict).toBe('doubt');
    expect(v.reasons).toEqual(['judge doubt: one', 'judge doubt: two']);
  });
});

describe('walk-judge r1: J8 unknown screen id', () => {
  it('a measured screen the input does not list -> red', () => {
    const r = makeReport();
    r.measurements.ghost = r.measurements.calendar;
    const v = judgeVerdict(makeInput(), r);
    expect(v.verdict).toBe('red');
    expect(v.reasons).toContain('unknown screen ghost');
  });
});

describe('walk-judge r1: J10 + head: isPass(v, expectedHeadSha)', () => {
  const v = judgeVerdict(makeInput(), makeReport());
  it('a pass for this head is a pass', () => expect(isPass(v, HEAD)).toBe(true));
  it('J10: a "pass" that still carries reasons is not a pass', () => {
    expect(isPass({ ...v, reasons: ['tapTargets measured 10'] }, HEAD)).toBe(false);
  });
  it('a pass for another head is not a pass', () => expect(isPass(v, 'c'.repeat(40))).toBe(false));
  it.each([[undefined], [''], ['abc'], [HEAD.toUpperCase()]])('no / malformed expected head %j -> not a pass', (h) => {
    expect(isPass(v, h as never)).toBe(false);
  });
});

describe('walk-judge r1: J15 CLI exit code on doubt', () => {
  it('exit 1 on doubt', () => {
    const report = { ...makeReport(), doubts: ['picture 3 looks cropped'] };
    const files: Record<string, string> = { 'in.json': JSON.stringify(makeInput()), 'd.json': JSON.stringify(report) };
    const out: string[] = [];
    const code = main(['--input', 'in.json', '--report', 'd.json'], { readFile: (p: string) => files[p], log: (s: string) => out.push(s), error: (s: string) => out.push(s) });
    expect(code).toBe(1);
    expect(JSON.parse(out.join('\n')).verdict).toBe('doubt');
  });
  it('exit 1 on a desktop viewport report', () => {
    const report = makeReport((m) => { m.viewport = { width: 1280, height: 800 }; });
    const files: Record<string, string> = { 'in.json': JSON.stringify(makeInput()), 'v.json': JSON.stringify(report) };
    const code = main(['--input', 'in.json', '--report', 'v.json'], { readFile: (p: string) => files[p], log: () => {}, error: () => {} });
    expect(code).toBe(1);
  });
});

describe('walk-judge r1: judge-worker.md states the r1 rules', () => {
  const doc = readFileSync(path.resolve(__dirname, '../docs/automation/judge-worker.md'), 'utf8');
  it('names the 390x844 viewport', () => expect(doc).toMatch(/390 ?x ?844/));
  it('an unparseable judge reply is red', () => expect(doc).toMatch(/unparseable judge reply is red/i));
  it('the head comparison is mandatory', () => expect(doc).toMatch(/head comparison is mandatory/i));
  it('the walk-coverage gap is closed: no longer under Parts left, and the spec says the tie', () => {
    const parts = doc.split(/^## Parts left$/m)[1] ?? '';
    expect(parts).not.toMatch(/input\.screens is not tied to walk-coverage\.json/);
    expect(doc).toMatch(/input\.screens is compared with walk-coverage\.json/);
    expect(doc).toMatch(/--coverage/);
    expect(doc).toMatch(/`coverage:`/);
  });
  it('the rubric range columns match the module', () => {
    const docRange = [...doc.matchAll(/^\| \d+ \| `(\w+)` \|.*\| `([\d.]+)` \| `([\d.]+|none)` \|$/gm)].map((m) => ({
      id: m[1], min: Number(m[2]), max: m[3] === 'none' ? null : Number(m[3]),
    }));
    expect(docRange).toEqual(RUBRIC.map((r: { id: string; min: number; max: number | null }) => ({ id: r.id, min: r.min, max: r.max })));
  });
});

// ---- brief walk-judge-screens-tied-to-coverage: judgeVerdict(input, report, coverage)
// and the CLI flag --coverage (cases K1 to K12).
describe('walk-judge: input.screens is compared with walk-coverage.json', () => {
  const A = 'published.class.nonempty.upcoming.normal';
  const P = 'published.party.empty.past.normal';
  const row = (id: string, shapes: string[], extra: Record<string, unknown> = {}) => ({ id, uiFiles: [`src/pages/${id}.tsx`], walk: `${id}-walk`, shapes, ...extra });
  const cov = (...screens: unknown[]) => ({ schemaVersion: 1, screens });
  const MATCH = cov(row('event-page', [A]), row('calendar', [P]), row('example-screen', [A], { example: true }));

  it('K0 re-exports the walk-fixtures check, not a copy', () => expect(screensMissingFromCoverage).toBe(fromFixtures));

  it('K1 coverage omitted: verdict is byte-for-byte the two-argument one, on every existing fixture', () => {
    const reports = [makeReport(), makeReport((m) => { m.tapTargets = 10; }), { ...makeReport(), doubts: ['hmm'] }, null];
    const inputs = [makeInput(), makeInput({ screens: [] }), 'junk'];
    for (const i of inputs) for (const r of reports) {
      expect(JSON.stringify(judgeVerdict(i, r, undefined))).toBe(JSON.stringify(judgeVerdict(i, r)));
    }
    expect(judgeVerdict(makeInput(), makeReport()).reasons.some((x: string) => x.startsWith('coverage:'))).toBe(false);
  });

  it('K2 matching coverage: still pass', () => {
    const v = judgeVerdict(makeInput(), makeReport(), MATCH);
    expect(v.verdict).toBe('pass');
    expect(isPass(v, HEAD)).toBe(true);
    expect(JSON.stringify(v)).toBe(JSON.stringify(judgeVerdict(makeInput(), makeReport())));
  });

  const red: [string, unknown, RegExp][] = [
    ['K3 coverage screen missing from input', cov(row('event-page', [A]), row('calendar', [P]), row('organiser', [A])), /^coverage: screen organiser is required by walk-coverage\.json but not in input\.screens$/],
    ['K4 extra input screen', cov(row('event-page', [A])), /^coverage: screen calendar is in input\.screens but not in walk-coverage\.json$/],
    ['K5 missing shape', cov(row('event-page', [A, P]), row('calendar', [P])), /^coverage: screen event-page: shape published\.party\.empty\.past\.normal is required/],
    ['K6 example row treated as example (not required)', cov(row('event-page', [A]), row('calendar', [P]), row('ghost', [A], { example: true })), /__never__/],
    ['K7 empty coverage', cov(), /^coverage: .*no non-example screens/],
    ['K8 malformed coverage', { schemaVersion: 1, screens: [{ id: 'event-page' }] }, /^coverage: walk-coverage is malformed: /],
    ['K9 null coverage is given, so it is red', null, /^coverage: walk-coverage is malformed: /],
  ];
  it.each(red)('%s', (name, coverage, re) => {
    const v = judgeVerdict(makeInput(), makeReport(), coverage);
    if (name.startsWith('K6')) { expect(v.verdict).toBe('pass'); return; }
    expect(v.verdict).toBe('red');
    expect(isPass(v, HEAD)).toBe(false);
    expect(v.reasons.some((x: string) => re.test(x))).toBe(true);
    // The measured numbers are still cited: the coverage reasons are added, nothing else is lost.
    expect(v.cited).toHaveLength(RUBRIC.length * 2 * 2);
  });

  it('K10 a coverage problem turns a doubt into red, and keeps the input/report reasons', () => {
    const d = judgeVerdict(makeInput(), { ...makeReport(), doubts: ['hmm'] }, cov(row('event-page', [A])));
    expect(d.verdict).toBe('red');
    const r = judgeVerdict(makeInput(), makeReport((m) => { m.tapTargets = 10; }), cov(row('event-page', [A])));
    expect(r.reasons.some((x: string) => /tapTargets measured 10/.test(x))).toBe(true);
    expect(r.reasons.some((x: string) => x.startsWith('coverage: '))).toBe(true);
    const bad = judgeVerdict(makeInput({ headSha: 'nope' }), makeReport(), cov(row('event-page', [A])));
    expect(bad.verdict).toBe('red');
    expect(bad.reasons[0]).toMatch(/^coverage: /);
    expect(bad.reasons.some((x: string) => x.startsWith('input: '))).toBe(true);
  });

  describe('K11 CLI --coverage', () => {
    const files: Record<string, string> = {
      'in.json': JSON.stringify(makeInput()),
      'ok.json': JSON.stringify(makeReport()),
      'match.json': JSON.stringify(MATCH),
      'short.json': JSON.stringify(cov(row('event-page', [A]), row('calendar', [P]), row('organiser', [A]))),
      'junk.json': '{not json',
    };
    const run = (argv: string[]) => {
      const out: string[] = [];
      const code = main(argv, { readFile: (p: string) => { if (!(p in files)) throw new Error('ENOENT'); return files[p]; }, log: (s: string) => out.push(s), error: (s: string) => out.push(s) });
      return { code, out: out.join('\n') };
    };
    const base = ['--input', 'in.json', '--report', 'ok.json'];
    it('matching coverage: exit 0', () => expect(run([...base, '--coverage', 'match.json']).code).toBe(0));
    it('no --coverage: exit 0, as before', () => expect(run(base).code).toBe(0));
    it('a screen left out: exit 1 with a coverage: reason', () => {
      const r = run([...base, '--coverage', 'short.json']);
      expect(r.code).toBe(1);
      expect(JSON.parse(r.out).reasons.some((x: string) => x.startsWith('coverage: screen organiser'))).toBe(true);
    });
    it('unreadable coverage file: red, not ignored', () => {
      const r = run([...base, '--coverage', 'missing.json']);
      expect(r.code).toBe(1);
      const v = JSON.parse(r.out);
      expect(v.verdict).toBe('red');
      expect(v.reasons.some((x: string) => /^coverage: could not read missing\.json/.test(x))).toBe(true);
    });
    it('unreadable coverage file still reports every other red reason, coverage first', () => {
      const f2 = { ...files, 'bad.json': JSON.stringify(makeReport((m) => { m.tapTargets = 10; })) };
      const out: string[] = [];
      main(['--input', 'in.json', '--report', 'bad.json', '--coverage', 'missing.json'], { readFile: (p: string) => { if (!(p in f2)) throw new Error('ENOENT'); return f2[p as keyof typeof f2]; }, log: (x: string) => out.push(x), error: () => {} });
      const v = JSON.parse(out.join('\n'));
      expect(v.reasons[0]).toMatch(/^coverage: could not read missing\.json/);
      expect(v.reasons.some((x: string) => /tapTargets measured 10/.test(x))).toBe(true);
    });
    it('unparseable coverage file: red', () => expect(run([...base, '--coverage', 'junk.json']).code).toBe(1));
    it('--coverage with no file: usage, exit 2', () => {
      expect(run([...base, '--coverage']).code).toBe(2);
      expect(run(['--coverage', '--input', 'in.json', '--report', 'ok.json']).code).toBe(2);
    });
  });

  it('K12 the seeded walk-coverage.json (example row only) is red against the fixtures', () => {
    const seeded = JSON.parse(readFileSync(path.resolve(__dirname, '../docs/design/walk-coverage.json'), 'utf8'));
    expect(judgeVerdict(makeInput(), makeReport(), seeded).verdict).toBe('red');
  });

  it('K13 duplicate input ids: one coverage: reason regardless of how many ids repeat, and the verdict is red', () => {
    const dupOnce = [...SCREENS, { ...SCREENS[0] }];
    const dupTwice = [...SCREENS, { ...SCREENS[0] }, { ...SCREENS[0] }];
    for (const screens of [dupOnce, dupTwice]) {
      const problems = screensMissingFromCoverage(MATCH, screens);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(/^input\.screens is malformed: .*unique ids$/);
      const v = judgeVerdict(makeInput({ screens }), makeReport(), MATCH);
      expect(v.verdict).toBe('red');
      expect(isPass(v, HEAD)).toBe(false);
      expect(v.reasons[0]).toMatch(/^coverage: input\.screens is malformed: .*unique ids$/);
      expect(v.reasons.filter((x: string) => x.startsWith('coverage: '))).toHaveLength(1);
      expect(v.reasons).toContain('input: screen event-page repeats');
    }
  });
});

// ---- brief walk-gate-judge-threw-test: a throw inside the coverage check is ONE
// red reason, coverage first, and every other red reason of the judge is kept.
describe('walk-judge: coverage check threw (red reason 10 of 10)', () => {
  const A = 'published.class.nonempty.upcoming.normal';
  const P = 'published.party.empty.past.normal';
  const row = (id: string, shapes: string[]) => ({ id, uiFiles: [`src/pages/${id}.tsx`], walk: `${id}-walk`, shapes });
  const MATCH = { schemaVersion: 1, screens: [row('event-page', [A]), row('calendar', [P])] };
  type Target = 'coverage getter' | 'input.screens getter, always' | 'input.screens getter, first read only';
  const thrownValues: [string, unknown, string][] = [
    ['Error', new Error('boom'), 'boom'],
    ['string', 'boom-string', 'boom-string'],
    ['null', null, 'null'],
  ];
  function hostile(target: Target, thrown: unknown) {
    const input = makeInput();
    let coverage: unknown = MATCH;
    if (target === 'coverage getter') {
      coverage = { schemaVersion: 1, get screens() { throw thrown; } };
    } else {
      const screens = input.screens;
      let reads = 0;
      const always = target === 'input.screens getter, always';
      Object.defineProperty(input, 'screens', {
        enumerable: true,
        get() { reads += 1; if (always || reads === 1) throw thrown; return screens; },
      });
    }
    return { input, coverage };
  }
  const targets: Target[] = ['coverage getter', 'input.screens getter, always', 'input.screens getter, first read only'];
  const rows: [string, Target, unknown, string, boolean][] = [];
  for (const t of targets) for (const [kind, thrown, msg] of thrownValues) for (const dirty of [false, true]) {
    rows.push([`${t} / thrown ${kind} / ${dirty ? 'with another red reason' : 'clean input'}`, t, thrown, msg, dirty]);
  }

  it.each(rows)('%s', (_name, target, thrown, msg, dirty) => {
    const { input, coverage } = hostile(target, thrown);
    const report = dirty ? makeReport((m) => { m.tapTargets = 10; }) : makeReport();
    const v = judgeVerdict(input, report, coverage);
    expect(v.verdict).toBe('red');
    expect(isPass(v, HEAD)).toBe(false);
    const reason = `coverage: coverage check threw: ${msg}`;
    expect(v.reasons[0]).toBe(reason);
    expect(v.reasons.filter((x: string) => x.includes('coverage check threw'))).toHaveLength(1);
    if (target === 'input.screens getter, always') {
      // judge(...) itself cannot read input.screens, so its own throw is kept AFTER the coverage reason.
      expect(v.reasons).toEqual([reason, `judge threw: ${msg}`]);
      return;
    }
    // The rest of judge(...) ran: its numbers are cited and its red reasons are kept.
    expect(v.cited).toHaveLength(RUBRIC.length * 2 * 2);
    if (dirty) {
      expect(v.reasons.length).toBeGreaterThan(1);
      expect(v.reasons.slice(1).some((x: string) => /tapTargets measured 10/.test(x))).toBe(true);
    } else {
      expect(v.reasons).toEqual([reason]);
    }
  });

  it('two-argument verdict is unchanged: a throwing input.screens is still only `judge threw:`', () => {
    const { input } = hostile('input.screens getter, always', new Error('boom'));
    const v = judgeVerdict(input, makeReport());
    expect(v.verdict).toBe('red');
    expect(v.headSha).toBe('');
    expect(v.reasons).toEqual(['judge threw: boom']);
  });
});
