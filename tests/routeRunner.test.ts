// scripts/ci/route-runner.mjs -- CI offload routing + fallback (docs/handover/ci-offload-stage3.md).
// Owner rule: a side machine that is off, busy or broken never reds a PR. Every row below
// that is not a real code failure must end on GitHub-hosted, never red, never pending.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  awaitDecision, classifyExit, FAIL_STEP, fallbackAction, gateVerdict, HOSTED, main, PASS_STEP, pickRunner, trustDecision,
} from '../scripts/ci/route-runner.mjs';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = { trusted: true, reason: 'test' };
const runner = (status: string, busy: boolean, label = 'acer-web') => ({ name: 'acer-web', status, busy, labels: [{ name: 'self-hosted' }, { name: label }] });

describe('pickRunner: online/idle is the ONLY way onto the side machine', () => {
  it.each([
    ['online + idle', { label: 'acer-web', trust: T, runners: [runner('online', false)] }, 'self'],
    ['online + busy', { label: 'acer-web', trust: T, runners: [runner('online', true)] }, 'hosted'],
    ['offline', { label: 'acer-web', trust: T, runners: [runner('offline', false)] }, 'hosted'],
    ['API error', { label: 'acer-web', trust: T, apiError: 'HTTP 500' }, 'hosted'],
    ['API returned no list', { label: 'acer-web', trust: T, runners: undefined }, 'hosted'],
    ['label unset', { label: '', trust: T, runners: [runner('online', false)] }, 'hosted'],
    ['label whitespace', { label: '  ', trust: T, runners: [runner('online', false)] }, 'hosted'],
    ['label is the hosted image', { label: 'ubuntu-latest', trust: T, runners: [] }, 'hosted'],
    ['label is an expression/garbage', { label: 'a b,c', trust: T, runners: [] }, 'hosted'],
    ['no runner carries the label', { label: 'acer-web', trust: T, runners: [runner('online', false, 'dell-web')] }, 'hosted'],
    ['untrusted event', { label: 'acer-web', trust: { trusted: false, reason: 'fork' }, runners: [runner('online', false)] }, 'hosted'],
    ['no trust decision', { label: 'acer-web', runners: [runner('online', false)] }, 'hosted'],
    ['acer busy, dell idle (list)', { label: 'acer-web,dell-web', trust: T, runners: [runner('online', true), runner('online', false, 'dell-web')] }, 'self:dell-web'],
    ['acer offline, dell busy (list)', { label: 'acer-web, dell-web', trust: T, runners: [runner('offline', false), runner('online', true, 'dell-web')] }, 'hosted'],
    ['one bad label in the list', { label: 'acer-web,ubuntu-latest', trust: T, runners: [runner('online', false)] }, 'hosted'],
    ['one busy, one idle with the label', { label: 'acer-web', trust: T, runners: [runner('online', true), runner('online', false)] }, 'self'],
  ])('%s -> %s', (_n, input, want) => {
    const d = pickRunner(input as Any);
    const [target, label] = String(want).split(':');
    expect(d.target).toBe(target);
    expect(d.runner).toBe(target === 'self' ? (label || 'acer-web') : HOSTED);
    expect(d.reason).toBeTruthy();
  });
});

describe('trustDecision: positive allowlist (item 2)', () => {
  const pr = (o: Any = {}) => ({ eventName: 'pull_request', headRepo: 'o/r', repo: 'o/r', author: 'kiki-claude-bot', files: ['src/a.ts'], ...o });
  it.each([
    ['push to main', { eventName: 'push', ref: 'refs/heads/main' }, true],
    ['push to another branch', { eventName: 'push', ref: 'refs/heads/dev' }, false],
    ['same-repo PR, bot author', pr(), true],
    ['same-repo PR, owner author', pr({ author: '123constante' }), true],
    ['same-repo PR, other author', pr({ author: 'someone' }), false],
    ['fork PR, bot author', pr({ headRepo: 'evil/r' }), false],
    ['PR with no head repo (deleted fork)', pr({ headRepo: undefined }), false],
    ['PR touches .github/', pr({ files: ['src/a.ts', '.github/workflows/x.yml'] }), false],
    ['PR touches scripts/ci/', pr({ files: ['scripts/ci/route-runner.mjs'] }), false],
    // fix round 2 item 2: route-runner imports scripts/lib/entry-point.mjs; npm manifests run code at install
    ['PR touches ONLY scripts/lib/entry-point.mjs', pr({ files: ['scripts/lib/entry-point.mjs'] }), false],
    ['PR touches package.json', pr({ files: ['src/a.ts', 'package.json'] }), false],
    ['PR touches package-lock.json', pr({ files: ['package-lock.json'] }), false],
    ['PR touches .github/automation/', pr({ files: ['.github/automation/secrets-register.json'] }), false],
    ['scripts/library.mjs is not scripts/lib/', pr({ files: ['scripts/library.mjs'] }), true],
    ['PR files unreadable', pr({ files: undefined, filesError: 'HTTP 403' }), false],
    ['pull_request_target', { ...pr(), eventName: 'pull_request_target' }, false],
    ['workflow_run', { eventName: 'workflow_run' }, false],
    ['schedule', { eventName: 'schedule' }, false],
  ])('%s -> trusted=%s', (_n, input, want) => {
    expect(trustDecision(input as Any).trusted).toBe(want);
  });
});

describe('fallback: anything but a real code failure ends green on hosted', () => {
  it.each([
    ['routed + passed', { target: 'self', routedResult: 'success', verdict: 'pass' }, 'skip-pass'],
    ['routed + code failure', { target: 'self', routedResult: 'failure', verdict: 'code-failure' }, 'fail-code'],
    ['routed + gate refused', { target: 'self', routedResult: 'success', verdict: '' }, 'run-hosted'],
    ['routed + busy timeout', { target: 'self', routedResult: 'success', verdict: 'busy-timeout' }, 'run-hosted'],
    ['routed + job timed out / runner died', { target: 'self', routedResult: 'failure', verdict: '' }, 'run-hosted'],
    ['routed + cancelled', { target: 'self', routedResult: 'cancelled', verdict: '' }, 'run-hosted'],
    ['routed + runner error', { target: 'self', routedResult: 'success', verdict: 'runner-error' }, 'run-hosted'],
    ['routed + skipped (YAML trust said no)', { target: 'self', routedResult: 'skipped', verdict: '' }, 'run-hosted'],
    ['hosted route', { target: 'hosted', routedResult: 'skipped', verdict: '' }, 'run-hosted'],
    ['route job failed (no output)', { target: '', routedResult: 'skipped', verdict: '' }, 'run-hosted'],
  ])('%s -> %s', (_n, input, want) => {
    expect(fallbackAction(input as Any)).toBe(want);
  });
});

describe('gate verdict + exit classification (items 1, 6)', () => {
  const ctx = { runId: '9', attempt: '1', job: 'bom-check-routed' };
  it.each([
    ['ok for this job', '9 1 bom-check-routed ok', true],
    ['refused', '9 1 bom-check-routed refused load1=5.0', false],
    ['stale (other run)', '8 1 bom-check-routed ok', false],
    ['stale (other attempt)', '9 2 bom-check-routed ok', false],
    ['empty / missing file', '', false],
  ])('%s -> proceed=%s', (_n, text, want) => {
    expect(gateVerdict(text, ctx).proceed).toBe(want);
  });
  // fix round 2 item 3: ONLY exit 1 from bom-check.sh is a code failure.
  it.each([
    [0, 'pass'], [1, 'code-failure'], [2, 'runner-error'], [124, 'busy-timeout'], [126, 'runner-error'],
    [127, 'runner-error'], [130, 'runner-error'], [137, 'busy-timeout'], [139, 'runner-error'], [143, 'runner-error'],
    ['', 'runner-error'], ['abc', 'runner-error'], [undefined, 'runner-error'], ['-1', 'runner-error'],
  ])('exit %s -> %s', (c, v) => {
    expect(classifyExit(c as Any)).toBe(v);
  });
});

describe('await (item 4): the required hosted job polls, never cancels; red ONLY on a routed code failure', () => {
  const st = (name: string, conclusion: string) => ({ name, conclusion });
  const done = (conclusion: string, steps: Any[]) => ({ status: 'completed', conclusion, steps });
  it.each([
    ['not listed yet', undefined, 10, 'wait'],
    ['not listed past pickup budget', undefined, 120, 'run-hosted'],
    ['queued', { status: 'queued' }, 60, 'wait'],
    ['queued past pickup budget (Acer never picked it up)', { status: 'queued' }, 121, 'run-hosted'],
    ['in_progress', { status: 'in_progress' }, 300, 'wait'],
    ['in_progress past total budget', { status: 'in_progress' }, 660, 'run-hosted'],
    ['passed', done('success', [st(PASS_STEP, 'success'), st(FAIL_STEP, 'skipped')]), 50, 'skip-pass'],
    ['code failure', done('failure', [st(PASS_STEP, 'skipped'), st(FAIL_STEP, 'failure')]), 50, 'fail-code'],
    ['gate refused (both markers skipped)', done('success', [st(PASS_STEP, 'skipped'), st(FAIL_STEP, 'skipped')]), 50, 'run-hosted'],
    ['hook refused (job failed, no steps)', done('failure', []), 50, 'run-hosted'],
    ['crash before markers (job failed, markers skipped)', done('failure', [st(PASS_STEP, 'skipped'), st(FAIL_STEP, 'skipped')]), 50, 'run-hosted'],
    ['timed out', done('cancelled', [st(PASS_STEP, 'skipped')]), 50, 'run-hosted'],
    ['job success but pass marker missing', done('success', []), 50, 'run-hosted'],
    ['fail marker failed but job success (impossible) ', done('success', [st(FAIL_STEP, 'failure')]), 50, 'run-hosted'],
    ['both markers claim (impossible)', done('failure', [st(PASS_STEP, 'success'), st(FAIL_STEP, 'failure')]), 50, 'run-hosted'],
  ])('%s -> %s', (_n, job, elapsedS, want) => {
    expect(awaitDecision({ job: job as Any, elapsedS: elapsedS as number, queueBudgetS: 120, totalBudgetS: 660 })).toBe(want);
  });
});

describe('main(): exit codes -- infrastructure never reds', () => {
  const quiet = { log() {}, error() {} };
  const out = () => { const lines: string[] = []; return { lines, log: { log: (s: string) => lines.push(s), error: (s: string) => lines.push(s) } }; };
  const env = { WEB_RUNNER_LABEL: 'acer-web', EVENT_NAME: 'pull_request', GITHUB_REPOSITORY: 'o/r', HEAD_REPO: 'o/r', PR_AUTHOR: 'kiki-claude-bot', PR_NUMBER: '1', GITHUB_TOKEN: 'g', RUNNER_READ_TOKEN: 'r' };
  const apiOk = async (_e: Any, p: string) => (p.includes('/files') ? [{ filename: 'src/a.ts' }] : { runners: [runner('online', false)] });
  it('route: trusted + idle -> self, exit 0', async () => {
    const o = out();
    expect(await main(['route'], env, o.log, { api: apiOk })).toBe(0);
    expect(o.lines).toContain('target=self');
  });
  it.each([
    ['runners API throws', async (_e: Any, p: string) => { if (p.includes('/files')) return []; throw new Error('HTTP 502'); }],
    ['files API throws', async () => { throw new Error('HTTP 403'); }],
  ])('route: %s -> hosted, exit 0', async (_n, api) => {
    const o = out();
    expect(await main(['route'], env, o.log, { api })).toBe(0);
    expect(o.lines).toContain('target=hosted');
  });
  it('route: no read token -> hosted', async () => {
    const o = out();
    expect(await main(['route'], { ...env, RUNNER_READ_TOKEN: '' }, o.log, { api: apiOk })).toBe(0);
    expect(o.lines).toContain('target=hosted');
  });
  it('gate: no verdict file -> proceed=false, exit 0', async () => {
    const o = out();
    expect(await main(['gate'], { WEB_RUNNER_GATE_FILE: '/nonexistent/x', GITHUB_RUN_ID: '1', GITHUB_RUN_ATTEMPT: '1', GITHUB_JOB: 'j' }, o.log)).toBe(0);
    expect(o.lines).toContain('proceed=false');
  });
  // The verdict reaches the hosted job as an OUTPUT + marker step, never as an exit code.
  it.each([['0', 'pass'], ['124', 'busy-timeout'], ['1', 'code-failure'], ['127', 'runner-error'], ['143', 'runner-error']])('verdict %s -> %s, exit 0', async (c, want) => {
    const o = out();
    expect(await main(['verdict', c], {}, o.log)).toBe(0);
    expect(o.lines).toContain(`verdict=${want}`);
  });
  const awaitEnv = { TARGET: 'self', GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '9', WATCH_JOB_NAME: 'bom-check-routed', QUEUE_BUDGET_S: '30' };
  const poll = (jobs: Any[]) => {
    let now = 0; const calls: string[] = []; let i = 0;
    const api = async (_e: Any, p: string, _t: string, init: Any = {}) => { calls.push(`${init.method || 'GET'} ${p}`); const j = jobs[Math.min(i++, jobs.length - 1)]; if (j instanceof Error) throw j; return { jobs: j ? [j] : [] }; };
    return { calls, deps: { api, sleep: async () => { now += 10000; }, now: () => now } };
  };
  it('await: queued past budget -> run-hosted, NO cancel, exit 0', async () => {
    const o = out(); const { calls, deps } = poll([{ name: 'bom-check-routed', status: 'queued' }]);
    expect(await main(['await'], awaitEnv, o.log, deps)).toBe(0);
    expect(o.lines).toContain('action=run-hosted');
    expect(calls.every((c) => c.startsWith('GET'))).toBe(true);
  });
  it('await: in_progress then passed -> skip-pass', async () => {
    const o = out();
    const { deps } = poll([{ name: 'bom-check-routed', status: 'in_progress' }, { name: 'bom-check-routed', status: 'completed', conclusion: 'success', steps: [{ name: PASS_STEP, conclusion: 'success' }] }]);
    expect(await main(['await'], awaitEnv, o.log, deps)).toBe(0);
    expect(o.lines).toContain('action=skip-pass');
  });
  it('await: API keeps failing -> run-hosted after the budget', async () => {
    const o = out(); const { deps } = poll([new Error('HTTP 502')]);
    expect(await main(['await'], awaitEnv, o.log, deps)).toBe(0);
    expect(o.lines).toContain('action=run-hosted');
  });
  it('await: target hosted -> run-hosted with no API call', async () => {
    const o = out(); const { calls, deps } = poll([]);
    expect(await main(['await'], { ...awaitEnv, TARGET: 'hosted' }, o.log, deps)).toBe(0);
    expect(o.lines).toContain('action=run-hosted');
    expect(calls).toEqual([]);
  });
  it('self-test passes; unknown subcommand exits 2', async () => {
    expect(await main(['--self-test'], {}, quiet)).toBe(0);
    expect(await main(['nope'], {}, quiet)).toBe(2);
  });
});

// fix round 1/2 item 1, 8, 9: the runner hooks, driven by their shell test against a local
// file:// remote. Identity mutant (altered workflow blob) must be refused; a hook mutant with
// the identity compare deleted must make the shell test FAIL (the test can see the bug).
describe('runner hooks (shell test)', () => {
  const dir = path.join(__dirname, '..', 'docs', 'ci-offload', 'acer-web');
  const tools = ['git', 'flock', 'setsid', 'timeout'].every((b) => spawnSync('sh', ['-c', `command -v ${b}`]).status === 0);
  it.skipIf(!tools || process.platform !== 'linux')('test-gate-hooks.sh passes on the real hooks', () => {
    const r = spawnSync('bash', [path.join(dir, 'test-gate-hooks.sh')], { encoding: 'utf8', timeout: 60000 });
    expect(r.stdout).toMatch(/PASS \d+ cases/);
    expect(r.status).toBe(0);
  }, 70000);
  it.skipIf(!tools || process.platform !== 'linux')('...and FAILS on a hook mutant without the identity compare', () => {
    const src = readFileSync(path.join(dir, 'gate-job-started.sh'), 'utf8');
    const mut = src.split('\n').filter((l) => !l.includes('refuse "IDENTITY')).join('\n');
    expect(mut).not.toBe(src);
    const f = path.join(mkdtempSync(path.join(tmpdir(), 'gate-mut-')), 'started.sh');
    writeFileSync(f, mut);
    const r = spawnSync('bash', [path.join(dir, 'test-gate-hooks.sh')], { encoding: 'utf8', timeout: 60000, env: { ...process.env, HOOK_STARTED: f } });
    expect(r.stdout).toMatch(/FAIL MUTANT altered workflow: refused/);
    expect(r.status).not.toBe(0);
  }, 70000);
});

// item 7: one copy of the workflow only (the docs duplicate drifted risk).
describe('bom-check.yml has a single source', () => {
  it('docs/ci-offload/bom-check.yml no longer exists', () => {
    expect(existsSync(path.join(__dirname, '..', 'docs', 'ci-offload', 'bom-check.yml'))).toBe(false);
  });
});
