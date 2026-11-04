// Slice 2 (foundations-web), PART 1: required jobs (drills A17 and A17b). The checker table, the
// merge lane's fact, a run() of THE merge call site against a fake GitHub (the pinned-head
// re-read immediately before the PUT), a mutant that skips that re-read, the A17b phantom check
// over the real workflows, and the ruleset comparison over the fact-1 fixture.
// Doc: docs/automation-foundations.md.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { parseRequiredJobs, checkRequiredJobs, OK_CONCLUSIONS } from '../scripts/lib/required-jobs.mjs';
import { mergeVerdict } from '../scripts/lib/autopilot-merge.mjs';
import { run } from '../scripts/autopilot-step.mjs';
import { main as requiredJobsMain, jobCheckRunNames, resolveRequiredJobs } from '../scripts/check-required-jobs.mjs';
import { main as rulesetMain, compareRuleset, rulesetContexts } from '../scripts/check-ruleset-vs-required-jobs.mjs';
import { NOT_PAUSED, FOUNDATIONS_OK } from './autopilotTable';
import { fakeGitHub, green, ENV, NOW, sha, type CheckRun } from './automationFakeGitHub';

const ROOT = path.resolve(__dirname, '..');
const FILE_TEXT = readFileSync(path.join(ROOT, '.github/automation/required-jobs.json'), 'utf8');
const REQ = JSON.parse(FILE_TEXT);
const H = 'c'.repeat(40);
const OTHER = 'd'.repeat(40);

// ---------------------------------------------------------------- the file
describe('required-jobs.json (PART 1.1)', () => {
  it('parses, and pr_head is the seven ruleset contexts (fact 1)', () => {
    const r = parseRequiredJobs(FILE_TEXT);
    expect(r.pr_head).toEqual(['integrity', 'bundle-budget', 'e2e-smoke', 'wallclock-brand', 'masking-check', 'bom-check', 'unit (Europe/London, full)']);
    expect(r.post_merge_audits).toEqual(['Owner approval audit']);
    expect(r.conditional.map((c: { name: string }) => c.name)).toEqual(['phone-qa', 'build-smoke', 'types-drift']);
  });
  it('owner-approval is NOT a PR-head job (it is a push-to-main audit: wrong contract premise, fact 2)', () => {
    expect(REQ.pr_head).not.toContain('owner-approval');
    expect(REQ.pr_head).not.toContain('audit');
  });
  it.each([
    ['not JSON', '{'],
    ['not an object', '[]'],
    ['wrong version', JSON.stringify({ ...REQ, version: 2 })],
    ['pr_head missing', JSON.stringify({ ...REQ, pr_head: undefined })],
    ['pr_head empty', JSON.stringify({ ...REQ, pr_head: [] })],
    ['pr_head has a non-string', JSON.stringify({ ...REQ, pr_head: ['a', 3] })],
    ['pr_head has an empty name', JSON.stringify({ ...REQ, pr_head: ['a', ' '] })],
    ['duplicate name', JSON.stringify({ ...REQ, pr_head: ['a', 'a'] })],
    ['conditional entry without when', JSON.stringify({ ...REQ, conditional: [{ name: 'x' }] })],
    ['conditional not a list', JSON.stringify({ ...REQ, conditional: {} })],
    ['post_merge_audits not a list', JSON.stringify({ ...REQ, post_merge_audits: 'x' })],
    ['unknown key', JSON.stringify({ ...REQ, extra: 1 })],
    ['not a string at all', null],
  ])('fails closed: %s', (_n, text) => {
    expect(() => parseRequiredJobs(text as string)).toThrow();
  });
});

// ---------------------------------------------------------------- the checker
const R = { version: 1, pr_head: ['a', 'b'], conditional: [{ name: 'c', when: 'paths' }], post_merge_audits: [] };
const run1 = (name: string, conclusion: string | null, extra: Partial<CheckRun> = {}): CheckRun => ({ id: 1, name, status: conclusion === null ? 'in_progress' : 'completed', conclusion, head_sha: H, ...extra });
const ROWS: [string, CheckRun[] | null, boolean, string[]][] = [
  ['both success', [run1('a', 'success'), run1('b', 'success')], true, []],
  ['skipped and neutral are OK (the lane set)', [run1('a', 'skipped'), run1('b', 'neutral')], true, []],
  ['one not yet reported (A17)', [run1('a', 'success')], false, ['required job missing: b']],
  ['none reported', [], false, ['required job missing: a', 'required job missing: b']],
  ['list unreadable', null, false, ['check-runs not read at the pinned head']],
  ['in_progress', [run1('a', 'success'), run1('b', null)], false, ['required job not green: b=in_progress']],
  ['queued', [run1('a', 'success'), { ...run1('b', null), status: 'queued' }], false, ['required job not green: b=queued']],
  ['cancelled', [run1('a', 'success'), run1('b', 'cancelled')], false, ['required job not green: b=cancelled']],
  ['failure', [run1('a', 'success'), run1('b', 'failure')], false, ['required job not green: b=failure']],
  ['timed_out', [run1('a', 'success'), run1('b', 'timed_out')], false, ['required job not green: b=timed_out']],
  ['action_required', [run1('a', 'success'), run1('b', 'action_required')], false, ['required job not green: b=action_required']],
  ['stale', [run1('a', 'success'), run1('b', 'stale')], false, ['required job not green: b=stale']],
  ['a run for another head does not count', [run1('a', 'success'), run1('b', 'success', { head_sha: OTHER })], false, ['required job missing: b']],
  ['a run without head_sha does not count', [run1('a', 'success'), run1('b', 'success', { head_sha: undefined })], false, ['required job missing: b']],
  ['latest (highest id) decides: older red, newer green', [run1('a', 'success'), run1('b', 'failure', { id: 5 }), run1('b', 'success', { id: 9 })], true, []],
  ['latest (highest id) decides: older green, newer red', [run1('a', 'success'), run1('b', 'success', { id: 5 }), run1('b', 'failure', { id: 9 })], false, ['required job not green: b=failure']],
  ['conditional absent is not demanded', [run1('a', 'success'), run1('b', 'success')], true, []],
  ['conditional present and red = refuse', [run1('a', 'success'), run1('b', 'success'), run1('c', 'failure')], false, ['required job not green: c=failure']],
  ['conditional present and pending = refuse', [run1('a', 'success'), run1('b', 'success'), run1('c', null)], false, ['required job not green: c=in_progress']],
  ['conditional present and skipped = fine', [run1('a', 'success'), run1('b', 'success'), run1('c', 'skipped')], true, []],
];
describe('checkRequiredJobs (PART 1.2): only the pinned head counts; refusal reasons verbatim', () => {
  it.each(ROWS)('%s', (_n, checkRuns, ok, reasons) => {
    const v = checkRequiredJobs({ required: R, checkRuns, headSha: H });
    expect(v.ok).toBe(ok);
    expect(v.reasons).toEqual(reasons);
    expect(v.reason).toBe(reasons[0] ?? '');
    if (!ok) expect(v.missing.length + v.notGreen.length > 0 || checkRuns === null).toBe(true);
  });
  it('the OK set is exactly what the lane already accepts', () => expect([...OK_CONCLUSIONS].sort()).toEqual(['neutral', 'skipped', 'success']));
  it('a missing or bad head sha refuses', () => {
    expect(checkRequiredJobs({ required: R, checkRuns: [run1('a', 'success'), run1('b', 'success')], headSha: '' }).ok).toBe(false);
  });
  it('an unreadable required list refuses', () => {
    expect(checkRequiredJobs({ required: null, checkRuns: [], headSha: H }).ok).toBe(false);
  });
});

// ---------------------------------------------------------------- the lane fact
describe('mergeVerdict takes facts.requiredJobs (PART 1.3)', () => {
  const base = () => ({ ...FOUNDATIONS_OK.facts });
  it('an absent fact refuses (fail closed)', () => {
    const f: Record<string, unknown> = base();
    delete f.requiredJobs;
    expect(mergeVerdict(f).reasons).toContain('required jobs not checked at the pinned head (fail closed)');
  });
  it('a refusal adds each reason verbatim', () => {
    const v = mergeVerdict({ ...base(), requiredJobs: checkRequiredJobs({ required: R, checkRuns: [run1('a', 'success')], headSha: H }) });
    expect(v.merge).toBe(false);
    expect(v.reasons).toContain('required job missing: b');
  });
  it('an OK fact adds no reason', () => {
    const v = mergeVerdict({ ...base() });
    expect(v.reasons.filter((r: string) => /required job/.test(r))).toEqual([]);
  });
});

// ---------------------------------------------------------------- run(): THE merge call site
const NAMES: string[] = REQ.pr_head;
const allGreen = (head: string) => green(head, NAMES);
const missingOne = (head: string) => green(head, NAMES.filter((n) => n !== 'e2e-smoke'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunFn = (env: any, opts: any) => Promise<number>;
async function scenario(runFn: RunFn, checkRuns: (head: string, read: number) => CheckRun[]) {
  const gh = fakeGitHub({ n: 81, checkRuns });
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { lines.push(a.map(String).join(' ')); });
  let code: number;
  try { code = await runFn(ENV, { pauseReader: NOT_PAUSED.pauseReader, now: NOW, fetch: gh.fetchImpl }); } finally { spy.mockRestore(); }
  return { code, merges: gh.merges().length, reads: gh.headReads(), out: lines.join('\n') };
}
// The REAL default readers (no foundations injection): the file comes from the checkout (main).
const SCENARIOS: [string, (head: string, read: number) => CheckRun[], (r: Awaited<ReturnType<typeof scenario>>) => boolean][] = [
  ['every required job green at every read: ONE merge, the head re-read immediately before it', (h) => allGreen(h), (r) => r.code === 0 && r.merges === 1 && r.reads >= 3],
  ['A17: e2e-smoke not yet reported at the merge-time re-read: NO merge, logged', (h, n) => (n >= 3 ? missingOne(h) : allGreen(h)), (r) => r.merges === 0 && r.out.includes('required job missing: e2e-smoke')],
  ['A17: e2e-smoke not reported at all: NO merge', (h) => missingOne(h), (r) => r.merges === 0 && r.out.includes('required job missing: e2e-smoke')],
  ['a required job in progress at the re-read: NO merge', (h, n) => (n >= 3 ? allGreen(h).map((x) => (x.name === 'integrity' ? { ...x, status: 'in_progress', conclusion: null } : x)) : allGreen(h)), (r) => r.merges === 0 && r.out.includes('required job not green: integrity=in_progress')],
  ['runs reported for another sha do not count: NO merge', (h) => allGreen(h).map((x) => ({ ...x, head_sha: sha(99) })), (r) => r.merges === 0 && r.out.includes('required job missing: integrity')],
];
describe('run(): mergePr re-reads the pinned head check-runs immediately before the PUT (A17)', () => {
  for (const [name, cr, ok] of SCENARIOS) it(name, async () => expect(ok(await scenario(run as RunFn, cr))).toBe(true));
});

const STEP = path.join(ROOT, 'scripts/autopilot-step.mjs');
const lf = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
let seq = 0;
async function loadStep(src: string) {
  const f = path.join(path.dirname(STEP), `.foundations-mutant-${process.pid}-${seq++}.mjs`);
  writeFileSync(f, src);
  try { return (await import(/* @vite-ignore */ pathToFileURL(f).href)).run as RunFn; } finally { rmSync(f, { force: true }); }
}
const REREAD = '  const rj = await requiredCheck(f.head);\n  if (!rj || rj.ok !== true) return';
describe('MUTANT: a mergePr that skips the re-read merges at an A17 head (the run-level test catches it)', () => {
  it('the re-read is in mergePr after the pause re-read and before the PUT', () => {
    const src = lf(STEP);
    const body = src.slice(src.indexOf('async function mergePr('), src.indexOf('async function ensureLabels('));
    const iPause = body.indexOf('await pauseCheck()');
    const iRe = body.indexOf(REREAD);
    const iPut = body.indexOf("mergeApi.call('PUT'");
    expect(iPause).toBeGreaterThan(-1);
    expect(iRe).toBeGreaterThan(iPause);
    expect(iPut).toBeGreaterThan(iRe);
  });
  it('the unmutated step refuses and the mutant merges', async () => {
    const src = lf(STEP);
    expect(src.split(REREAD).length).toBe(2);
    const a17 = SCENARIOS[1];
    expect(a17[2](await scenario(run as RunFn, a17[1]))).toBe(true);
    const mutant = await loadStep(src.replace(REREAD, '  const rj = { ok: true };\n  if (false) return'));
    expect(a17[2](await scenario(mutant, a17[1]))).toBe(false);
  });
});

// ---------------------------------------------------------------- A17b: no phantom names
const WF = path.join(ROOT, '.github/workflows');
const readTree = () => {
  const workflows: Record<string, string> = {};
  for (const f of ['architecture-guard.yml', 'unit-tests.yml', 'workflow-lint.yml', 'typecheck.yml', 'perf-budget.yml', 'e2e-smoke.yml', 'phone-qa.yml', 'types-drift.yml', 'owner-approval.yml']) workflows[f] = readFileSync(path.join(WF, f), 'utf8');
  return workflows;
};
const drive = async (argv: string[], read: () => unknown) => {
  const said: string[] = [];
  const code = await requiredJobsMain(argv, { read, out: (l: string) => said.push(l), err: (l: string) => said.push(l) });
  return { code, said: said.join('\n') };
};
describe('check-required-jobs.mjs (A17b): every name resolves to a real check-run or workflow', () => {
  it('the real file over the real workflows: 0', async () => {
    const r = await drive([], undefined as unknown as () => unknown);
    expect(r.code).toBe(0);
  });
  it('matrix expansion: unit-tests.yml job unit gives the three legs', () => {
    const names = jobCheckRunNames('unit', { strategy: { matrix: { include: [{ tz: 'Europe/London', scope: 'full' }, { tz: 'America/New_York', scope: 'tz-sensitive' }] } } });
    expect(names).toEqual(['unit (Europe/London, full)', 'unit (America/New_York, tz-sensitive)']);
    expect(jobCheckRunNames('a', {})).toEqual(['a']);
    expect(jobCheckRunNames('a', { name: 'Lint ${{ matrix.os }}', strategy: { matrix: { os: ['x', 'y'] } } })).toEqual(['Lint x', 'Lint y']);
    expect(jobCheckRunNames('a', { strategy: { matrix: { os: ['x', 'y'], n: [1, 2] } } })).toEqual(['a (x, 1)', 'a (x, 2)', 'a (y, 1)', 'a (y, 2)']);
  });
  it.each([
    ['a phantom pr_head job', { ...REQ, pr_head: [...REQ.pr_head, 'ghost-job'] }, 'ghost-job'],
    ['a phantom matrix leg', { ...REQ, pr_head: [...REQ.pr_head, 'unit (Europe/London, tz-sensitive)'] }, 'unit (Europe/London, tz-sensitive)'],
    ['a phantom conditional job', { ...REQ, conditional: [...REQ.conditional, { name: 'phantom-qa', when: 'x' }] }, 'phantom-qa'],
    ['a phantom post-merge audit workflow', { ...REQ, post_merge_audits: ['Owner approval audit (renamed)'] }, 'Owner approval audit (renamed)'],
    ['a pr_head name that only exists on a non-PR workflow', { ...REQ, pr_head: [...REQ.pr_head, 'audit'] }, 'audit'],
  ])('%s -> exit 1, named', async (_n, file, name) => {
    const r = await drive([], () => ({ requiredText: JSON.stringify(file), workflows: readTree() }));
    expect(r.code).toBe(1);
    expect(r.said).toContain(`phantom required job: ${name}`);
  });
  it('the real file over the subset tree: 0 (the fixture tree is enough)', async () => {
    expect((await drive([], () => ({ requiredText: FILE_TEXT, workflows: readTree() }))).code).toBe(0);
  });
  it('unreadable file -> 2; bad JSON -> 2; unknown flag -> 2', async () => {
    expect((await drive([], () => { throw new Error('ENOENT'); })).code).toBe(2);
    expect((await drive([], () => ({ requiredText: '{', workflows: readTree() }))).code).toBe(2);
    expect((await drive(['--bogus'], () => ({ requiredText: FILE_TEXT, workflows: readTree() }))).code).toBe(2);
  });
  it('resolveRequiredJobs lists every name it checked', () => {
    const r = resolveRequiredJobs(parseRequiredJobs(FILE_TEXT), readTree());
    expect(r.phantoms).toEqual([]);
    expect(r.checked).toBe(REQ.pr_head.length + REQ.conditional.length + REQ.post_merge_audits.length);
  });
  it('--self-test passes (the canary)', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try { expect(await requiredJobsMain(['--self-test'])).toBe(0); } finally { spy.mockRestore(); }
  });
});

// ---------------------------------------------------------------- ruleset vs file (PART 1.4)
const RULESET_TEXT = readFileSync(path.join(ROOT, 'tests/fixtures/ruleset-main-checks.json'), 'utf8');
describe('check-ruleset-vs-required-jobs.mjs: the ruleset list equals pr_head', () => {
  it('fact-1 ruleset vs the file: no difference', () => {
    const c = compareRuleset(JSON.parse(RULESET_TEXT), parseRequiredJobs(FILE_TEXT));
    expect(c).toEqual({ ok: true, notInRuleset: [], notInFile: [] });
  });
  it('rules array form (GET /rules/branches/main) is read too', () => {
    expect(rulesetContexts(JSON.parse(RULESET_TEXT).rules)).toHaveLength(7);
  });
  it('a mutated ruleset: every difference both ways', () => {
    const rs = JSON.parse(RULESET_TEXT);
    const checks = rs.rules[2].parameters.required_status_checks;
    rs.rules[2].parameters.required_status_checks = [...checks.filter((c: { context: string }) => c.context !== 'e2e-smoke'), { context: 'owner-approval' }];
    expect(compareRuleset(rs, parseRequiredJobs(FILE_TEXT))).toEqual({ ok: false, notInRuleset: ['e2e-smoke'], notInFile: ['owner-approval'] });
  });
  it('a ruleset with no required_status_checks rule refuses (it would enforce nothing)', () => {
    expect(() => rulesetContexts({ rules: [{ type: 'deletion' }] })).toThrow();
  });
  const cli = async (argv: string[]) => {
    const said: string[] = [];
    const code = await rulesetMain(argv, { out: (l: string) => said.push(l), err: (l: string) => said.push(l), requiredText: FILE_TEXT });
    return { code, said: said.join('\n') };
  };
  it('CLI: 0 on the fixture, 1 on the mutant, 2 without --ruleset-json', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'ruleset-'));
    const good = path.join(dir, 'good.json');
    const bad = path.join(dir, 'bad.json');
    writeFileSync(good, RULESET_TEXT);
    const rs = JSON.parse(RULESET_TEXT);
    rs.rules[2].parameters.required_status_checks.pop();
    writeFileSync(bad, JSON.stringify(rs));
    try {
      expect((await cli(['--ruleset-json', good])).code).toBe(0);
      const b = await cli(['--ruleset-json', bad]);
      expect(b.code).toBe(1);
      expect(b.said).toContain('in required-jobs.json pr_head but NOT in the ruleset: unit (Europe/London, full)');
      expect((await cli([])).code).toBe(2);
      expect((await cli(['--ruleset-json', path.join(dir, 'nope.json')])).code).toBe(2);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('--self-test passes (the canary)', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try { expect(await rulesetMain(['--self-test'])).toBe(0); } finally { spy.mockRestore(); }
  });
});

describe('package.json carries the new scripts; the lint chain has the A17b link', () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  it.each([
    ['check:required-jobs', 'node scripts/check-required-jobs.mjs'],
    ['check:required-jobs:self-test', 'node scripts/check-required-jobs.mjs --self-test'],
    ['check:ruleset-vs-required-jobs', 'node scripts/check-ruleset-vs-required-jobs.mjs'],
    ['check:ruleset-vs-required-jobs:self-test', 'node scripts/check-ruleset-vs-required-jobs.mjs --self-test'],
  ])('%s', (k, v) => expect(pkg.scripts[k]).toBe(v));
  it('run-lint-chain LINKS has check:required-jobs with its canary immediately ahead', async () => {
    const { LINKS } = await import('../scripts/run-lint-chain.mjs');
    expect(LINKS.indexOf('check:required-jobs')).toBe(LINKS.indexOf('check:required-jobs:self-test') + 1);
    expect(LINKS).toContain('check:required-jobs');
  });
});
