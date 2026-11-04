// The hourly autopilot's pure core (scripts/lib/autopilot.mjs). Handover: docs/handover/autopilot-loop-r1.md.
import { describe, it, expect } from 'vitest';
import {
  decide, deriveFacts, labelPlan, jobIds, renderSummary, parseState, nextState, renderStatus,
  ACTIONS, WRITE_ACTIONS, CI_CAP, RUN_CI_GATED, deploymentEnabledFor, redAlsoOnMain,
} from '../scripts/lib/autopilot.mjs';

import { BASE, TABLE } from './autopilotTable';

describe('decide()', () => {
  for (const [name, o, action, label] of TABLE) {
    it(`${name} -> ${action}`, () => {
      const d = decide({ ...BASE, ...o });
      expect(d.action).toBe(action);
      expect(d.label).toBe(label);
      expect(ACTIONS).toContain(d.action);
    });
  }
  it('flags stop reasons the owner must see (conflict, cap, owner wait, queue-stopped)', () => {
    expect(decide({ ...BASE, merge: 'dirty' }).stop).toBe(true);
    expect(decide({ ...BASE, ranCi: false, ciRunsToday: 25 }).stop).toBe(true);
    expect(decide({ ...BASE, isMigration: true }).stop).toBe(true);
    expect(decide({ ...BASE, labels: ['queue-stopped'] }).stop).toBe(true);
    expect(decide({ ...BASE }).stop).toBe(false);
    expect(decide({ ...BASE, labels: ['migration-queued'] }).stop).toBe(false);
  });
  it('has no merge/approve/close action anywhere', () => {
    // r4: `merge` is the one decision value the executor sets after mergeVerdict(); it is never a WRITE_ACTION.
    for (const a of [...ACTIONS, ...WRITE_ACTIONS].filter((x) => x !== 'merge')) expect(a).not.toMatch(/merge$|approve|close|force/);
    expect(ACTIONS.filter((x) => x === 'merge')).toEqual(['merge']);
    expect(WRITE_ACTIONS).not.toContain('merge');
    expect(WRITE_ACTIONS.every((a) => ACTIONS.includes(a))).toBe(true);
    expect(CI_CAP).toBe(25); // r3 owner decision 2026-11-04
  });
});

describe('labelPlan', () => {
  it('adds the wanted label and removes other ap:* labels only', () => {
    expect(labelPlan(['ap:ready', 'run-ci'], 'ap:stopped')).toEqual({ add: ['ap:stopped'], remove: ['ap:ready'] });
    expect(labelPlan(['ap:stopped'], 'ap:stopped')).toEqual({ add: [], remove: [] });
    expect(labelPlan(['ap:stopped'], null)).toEqual({ add: [], remove: ['ap:stopped'] }); // r2 M1: null clears ours
  });
});

const NOW = Date.parse('2026-11-03T12:00:00Z');
const H = 'b'.repeat(40);
const pr = (o: object = {}) => ({ number: 5, state: 'open', draft: false, user: { login: 'kiki-claude-bot' }, created_at: '2026-11-01T00:00:00Z', mergeable_state: 'clean', labels: [{ name: 'run-ci' }], head: { sha: H, ref: 'claude/x', repo: { full_name: 'o/r' } }, base: { repo: { full_name: 'o/r' } }, ...o });
const job = (name: string, conclusion: string, run = 11, jobId = 21, extra: object = {}) => ({ name, status: 'completed', conclusion, details_url: `https://github.com/o/r/actions/runs/${run}/job/${jobId}`, completed_at: '2026-11-03T11:00:00Z', ...extra });
const rawBase = (o: object = {}) => ({
  pr: pr(), reviews: [], files: ['scripts/a.mjs'], checkRuns: [job('unit', 'success')], statuses: [], mainCheckRuns: [], mainStatuses: [],
  runsAtHead: [{ head_sha: H, event: 'pull_request', created_at: '2026-11-03T10:00:00Z' }, { head_sha: H, event: 'pull_request', created_at: '2026-11-03T10:30:00Z' }],
  labelEvents: [{ event: 'labeled', label: { name: 'run-ci' }, created_at: '2026-11-03T10:29:00Z' }], repoRunCiAddsToday: 3, jobLogs: {}, runAttempts: { 11: 1 }, workerDone: true, ...o,
});

describe('deriveFacts()', () => {
  it('a proof run = a pull_request run at head after the latest run-ci add', () => {
    const f = deriveFacts(rawBase(), NOW);
    expect(f.ranCi).toBe(true);
    expect(decide(f).action).toBe('ready');
  });
  // Website r5: the Website's PR workflows run on every pull_request push (no run-ci switch), so
  // the admin rows "label on an older head" / "relabel once" do not apply: a pull_request run at
  // the head IS the proof on every branch, and a push-only run is not.
  it('r5: a pull_request run at head is a proof on a worker branch, with no run-ci label', () => {
    const f = deriveFacts(rawBase({ labelEvents: [], runsAtHead: [{ head_sha: H, event: 'pull_request', created_at: '2026-11-03T07:00:00Z' }] }), NOW);
    expect(RUN_CI_GATED).toBe(false);
    expect(f.ranCi).toBe(true);
  });
  it('r5: a push-only run at head is not a proof', () => {
    const f = deriveFacts(rawBase({ labelEvents: [], runsAtHead: [{ head_sha: H, event: 'push', created_at: '2026-11-03T07:00:00Z' }] }), NOW);
    expect(f.ranCi).toBe(false);
  });
  it('r5: head subject comes from a run at THIS head; deployEnabled from vercel.json', () => {
    const runsAtHead = [
      { head_sha: 'c'.repeat(40), event: 'pull_request', created_at: '2026-11-03T06:00:00Z', head_commit: { message: 'old' } },
      { head_sha: H, event: 'pull_request', created_at: '2026-11-03T07:00:00Z', head_commit: { message: 'wip [skip preview]\r\n\nbody' } },
    ];
    const vercelConfig = { git: { deploymentEnabled: { 'claude/*': false, main: true } } };
    const f = deriveFacts(rawBase({ runsAtHead, vercelConfig }), NOW);
    expect(f.headSubject).toBe('wip [skip preview]');
    expect(f.deployEnabled).toBe(false);
    expect(deriveFacts(rawBase({ runsAtHead: [] }), NOW).headSubject).toBe(null);
    expect(deriveFacts(rawBase({}), NOW).deployEnabled).toBe(null);
  });
  it.each([
    ['claude/x', { 'claude/*': false, main: true }, false],
    ['main', { 'claude/*': false, main: true }, true],
    ['ccr-x', { 'claude/*': false }, null],
    ['claude/x', { 'claude/*': false, 'claude/x': true }, true],
    ['claude/x', null, null],
  ])('r5 deploymentEnabledFor(%s, %j) = %s', (ref, map, want) => {
    expect(deploymentEnabledFor(ref, map ? { git: { deploymentEnabled: map } } : null)).toBe(want);
  });
  it.each([
    [[{ name: 'unit', status: 'completed', conclusion: 'failure' }], ['unit'], 'yes'],
    [[{ name: 'unit', status: 'completed', conclusion: 'failure' }], ['lint'], 'no'],
    [[{ name: 'unit', status: 'completed', conclusion: 'success' }], ['unit'], 'no'],
    [null, ['unit'], 'not read'],
    [[{ name: 'unit', status: 'completed', conclusion: 'failure' }], null, 'not read'],
  ])('r5 redAlsoOnMain(%j, %j) = %s', (jobs, main, want) => {
    expect(redAlsoOnMain(jobs, main)).toBe(want);
  });
  it('a non-worker branch proof is any run at head', () => {
    const f = deriveFacts(rawBase({ pr: pr({ head: { sha: H, ref: 'feature/x', repo: { full_name: 'o/r' } } }), labelEvents: [] }), NOW);
    expect(f.workerBranch).toBe(false);
    expect(f.ranCi).toBe(true);
  });
  it('owner approval counts only at head and only from the owner', () => {
    const f1 = deriveFacts(rawBase({ reviews: [{ state: 'APPROVED', commit_id: H, user: { login: '123constante' } }] }), NOW);
    const f2 = deriveFacts(rawBase({ reviews: [{ state: 'APPROVED', commit_id: 'c'.repeat(40), user: { login: '123constante' } }] }), NOW);
    const f3 = deriveFacts(rawBase({ reviews: [{ state: 'APPROVED', commit_id: H, user: { login: 'someone' } }] }), NOW);
    expect([f1.approvedAtHead, f2.approvedAtHead, f3.approvedAtHead]).toEqual([true, false, false]);
  });
  it('a migration file makes it a migration PR', () => {
    expect(deriveFacts(rawBase({ files: ['supabase/migrations/9999_x.sql'] }), NOW).isMigration).toBe(true);
  });
  it('a fork head (or a deleted head repo) is a fork', () => {
    expect(deriveFacts(rawBase({ pr: pr({ head: { sha: H, ref: 'claude/x', repo: { full_name: 'evil/r' } } }) }), NOW).fork).toBe(true);
    expect(deriveFacts(rawBase({ pr: pr({ head: { sha: H, ref: 'claude/x', repo: null } }) }), NOW).fork).toBe(true);
  });
  it('a runner memory kill on attempt 1 is re-run, on attempt 2 it is red', () => {
    const log = { 21: 'x\nError: [vitest-pool]: Worker exited unexpectedly\n' };
    const f1 = deriveFacts(rawBase({ checkRuns: [job('unit', 'failure')], jobLogs: log }), NOW);
    expect(f1.rerunnable).toEqual([{ name: 'unit', jobId: 21, runId: 11, reason: 'runner memory kill' }]);
    expect(decide(f1).jobs).toEqual([21]);
    const f2 = deriveFacts(rawBase({ checkRuns: [job('unit', 'failure')], jobLogs: log, runAttempts: { 11: 2 } }), NOW);
    expect(f2.rerunnable).toEqual([]);
    expect(f2.redNew).toEqual(['unit']);
  });
  it('an ordinary failure is red, not re-run', () => {
    const f = deriveFacts(rawBase({ checkRuns: [job('unit', 'failure')], jobLogs: { 21: 'AssertionError: expected 1 to be 2' } }), NOW);
    expect(f.rerunnable).toEqual([]);
    expect(decide(f).action).toBe('stop');
  });
  it('cancelled beside a green duplicate is ignored; all-cancelled is re-run once', () => {
    const f1 = deriveFacts(rawBase({ checkRuns: [job('unit', 'cancelled', 11, 21), job('unit', 'success', 12, 22)] }), NOW);
    expect(f1.redNew).toEqual([]);
    expect(f1.rerunnable).toEqual([]);
    // r2 M2: a duplicate only when a newer run of the same workflow exists at head
    const f2 = deriveFacts(rawBase({ checkRuns: [job('unit', 'cancelled')], runsAtHead: [...rawBase().runsAtHead, { id: 11, workflow_id: 1, head_sha: H, event: 'pull_request', created_at: '2026-11-03T10:40:00Z' }, { id: 12, workflow_id: 1, head_sha: H, event: 'pull_request', created_at: '2026-11-03T10:45:00Z' }] }), NOW);
    expect(f2.rerunnable[0].reason).toBe('cancelled duplicate');
  });
  it('red also on main is redMain, not redNew; pending counts runs and statuses; version-fresh ignored', () => {
    const f = deriveFacts(rawBase({
      checkRuns: [job('lint', 'failure'), { name: 'build', status: 'in_progress' }],
      statuses: [{ context: 'migration-version-fresh', state: 'pending' }, { context: 'other', state: 'pending' }],
      mainCheckRuns: [{ name: 'lint', conclusion: 'failure' }],
    }), NOW);
    expect(f.redMain).toEqual(['lint']);
    expect(f.redNew).toEqual([]);
    expect(f.pending).toBe(2);
  });
  it('an external check (no actions job url) is never re-run', () => {
    const f = deriveFacts(rawBase({ checkRuns: [job('vercel', 'cancelled', 0, 0, { details_url: 'https://vercel.com/x' })] }), NOW);
    expect(f.rerunnable).toEqual([]);
    expect(f.redNew).toEqual(['vercel']);
  });
});

describe('helpers', () => {
  it('jobIds', () => {
    expect(jobIds('https://github.com/o/r/actions/runs/1/job/2')).toEqual({ runId: 1, jobId: 2 });
    expect(jobIds('https://x')).toBeNull();
  });
  it('renderSummary has one row per PR with all five columns, escapes pipes, and shows errors', () => {
    const md = renderSummary([{ repo: 'o/r', pr: 1, head: 'abc', decision: 'stop', why: 'a|b', did: 'nothing' }], { dryRun: true, errors: [{ where: 'o/r#2', message: 'HTTP 500' }] });
    expect(md).toContain('DRY RUN');
    expect(md).toContain('| pr | head | decision | why | did |');
    expect(md).toContain('| o/r#1 | abc | stop | a\\|b | nothing |');
    expect(md).toContain('ERROR');
  });
});

describe('stop streak (3 consecutive hours, said once)', () => {
  const s = { key: 'o/r#1', head: 'abc', why: 'merge conflict' };
  it('counts, announces once at 3, resets on a change, drops when unstopped', () => {
    let st = {};
    const seen: string[][] = [];
    for (let i = 0; i < 5; i++) { const n = nextState(st, [s]); seen.push(n.newlyStuck); st = n.state; }
    expect(seen).toEqual([[], [], ['o/r#1'], [], []]);
    expect(nextState(st, [{ ...s, head: 'def' }]).state['o/r#1'].streak).toBe(1);
    expect(nextState(st, [])).toEqual({ state: {}, newlyStuck: [] });
  });
  it('the state round-trips through the status comment; garbage reads empty', () => {
    const { state, newlyStuck } = nextState({}, [s]);
    const body = renderStatus([s], state, newlyStuck, 'https://run');
    expect(parseState(body)).toEqual(state);
    expect(parseState('<!-- autopilot-state {nope} -->')).toEqual({});
    expect(parseState(undefined)).toEqual({});
    expect(renderStatus([], {}, [], 'u')).toContain('Nothing is stopped');
  });
  it('marks the newly stuck row', () => {
    let st = {};
    for (let i = 0; i < 2; i++) st = nextState(st, [s]).state;
    const n = nextState(st, [s]);
    expect(renderStatus([s], n.state, n.newlyStuck, 'u')).toContain('STUCK 3h (new)');
  });
});
