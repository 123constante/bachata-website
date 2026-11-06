// scripts/ci/route-runner.mjs -- CI offload routing + fallback (docs/handover/ci-offload-stage3.md).
// Owner rule: a side machine that is off, busy or broken never reds a PR. Every row below
// that is not a real code failure must end on GitHub-hosted, never red, never pending.
import { describe, expect, it } from 'vitest';
import {
  classifyExit, fallbackAction, gateVerdict, HOSTED, main, pickRunner, trustDecision, watchDecision,
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
    ['routed + cancelled by watchdog', { target: 'self', routedResult: 'cancelled', verdict: '' }, 'run-hosted'],
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
  it.each([[0, 'pass'], [124, 'busy-timeout'], [137, 'busy-timeout'], [1, 'code-failure'], [2, 'code-failure']])('exit %s -> %s', (c, v) => {
    expect(classifyExit(c)).toBe(v);
  });
  it.each([
    ['queued', 10, 'wait'], ['queued', 120, 'stalled'], ['unknown', 130, 'stalled'],
    ['in_progress', 5, 'started'], ['completed', 500, 'started'],
  ])('watch %s at %ss -> %s', (status, elapsedS, want) => {
    expect(watchDecision({ status, elapsedS, budgetS: 120 })).toBe(want);
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
  it.each([['0', 0], ['124', 0], ['1', 1]])('verdict %s -> exit %s', async (c, want) => {
    expect(await main(['verdict', c], {}, quiet)).toBe(want);
  });
  it('watch: queued past budget -> cancels the run, exit 0', async () => {
    let now = 0; const calls: string[] = [];
    const api = async (_e: Any, p: string, _t: string, init: Any = {}) => { calls.push(`${init.method || 'GET'} ${p}`); return { jobs: [{ name: 'bom-check-routed', status: 'queued' }] }; };
    const deps = { api, sleep: async () => { now += 10000; }, now: () => now };
    expect(await main(['watch'], { GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '9', WATCH_JOB_NAME: 'bom-check-routed', QUEUE_BUDGET_S: '30' }, quiet, deps)).toBe(0);
    expect(calls.some((c) => c === 'POST /repos/o/r/actions/runs/9/cancel')).toBe(true);
  });
  it('watch: started -> no cancel', async () => {
    const calls: string[] = [];
    const api = async (_e: Any, p: string, _t: string, init: Any = {}) => { calls.push(`${init.method || 'GET'} ${p}`); return { jobs: [{ name: 'bom-check-routed', status: 'in_progress' }] }; };
    expect(await main(['watch'], { GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '9', WATCH_JOB_NAME: 'bom-check-routed' }, quiet, { api, sleep: async () => {}, now: () => 0 })).toBe(0);
    expect(calls.every((c) => c.startsWith('GET'))).toBe(true);
  });
  it('self-test passes; unknown subcommand exits 2', async () => {
    expect(await main(['--self-test'], {}, quiet)).toBe(0);
    expect(await main(['nope'], {}, quiet)).toBe(2);
  });
});
