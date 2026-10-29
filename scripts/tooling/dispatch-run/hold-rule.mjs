#!/usr/bin/env node
// hold-rule.mjs -- the branch-hold rule for dispatching a worker, as a PURE
// function. No file, network or clock access: the caller hands in the ledger
// entries and `now`. The orchestrator wires holdDecision() into its local gate.
//
//   holdDecision(entries, { repo, branch }, now) -> { allow, reason, blockedBy? }
//
// Rules (1-3, 5 keep the gate's existing behaviour; 4 is the change):
//   1. At most one live worker per repo+branch. kind 'routine' is ignored, and
//      so is status 'finished'.
//   2. An entry that was NEVER observed blocks, always.
//   3. An entry observed TERMINAL (ROUTINE_RUN_STATUS_SUCCEEDED / FAILED /
//      CANCELLED ...) releases 30 minutes after terminal_since -- or at once
//      when it carries done_marker_at.
//   4. done_marker_at set AND observed.worker_status 'idle' (a list_runs view of
//      a worker that finished its turn; its status stays 'active') releases at
//      once. Before this, such a row held the branch until someone ran a `get`.
//   5. No done marker and observed active / running / idle still blocks. The
//      marker is per ticket (the entry's own field), so another ticket's marker
//      never releases this one.
//   6. Every reason says what to do next.
//
// Self-test: node hold-rule.mjs --self-test   (exit 0 all green, 1 otherwise)
// It prints a markdown table, then the mutant check (rule 4 forced `true`).

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const TERMINAL_GRACE_MS = 30 * 60 * 1000;

const TERMINAL_STATUS =
  /^ROUTINE_RUN_STATUS_(SUCCEEDED|FAILED|CANCELL?ED|TIMED_OUT|EXPIRED)$/;

const isTerminal = (status) => typeof status === 'string' && TERMINAL_STATUS.test(status);

/** ms since epoch, or NaN when the value is not a usable time. */
function toMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value !== '') return Date.parse(value);
  return NaN;
}

const hasMarker = (e) => Number.isFinite(toMs(e.done_marker_at));

/** Rule 4's condition, kept separate so the self-test can mutate it. */
const doneAndIdle = (e) => hasMarker(e) && e.observed?.worker_status === 'idle';

function describeObserved(o) {
  const ws = o.worker_status ? '/' + o.worker_status : '';
  return `${o.status ?? 'unknown'}${ws} via ${o.source ?? 'unknown'} at ${o.at ?? 'unknown time'}`;
}

/** One entry's verdict: null = it does not hold the branch, else a reason. */
function entryHold(e, nowMs, rule4) {
  const where = `${e.repo}#${e.branch}`;
  if (!e.observed || typeof e.observed !== 'object') {
    return `${e.ticket} on ${where} was never observed: observe it with RemoteTrigger get`;
  }
  const o = e.observed;
  if (isTerminal(o.status)) {
    if (hasMarker(e)) return null;
    const since = toMs(e.terminal_since ?? o.finished_at);
    if (!Number.isFinite(since)) {
      return `${e.ticket} on ${where} is terminal (${describeObserved(o)}) with no usable terminal_since: observe it with RemoteTrigger get`;
    }
    const until = since + TERMINAL_GRACE_MS;
    if (nowMs >= until) return null;
    return `${e.ticket} on ${where} is terminal (${describeObserved(o)}) without a done marker: wait until ${new Date(until).toISOString()}`;
  }
  if (rule4(e)) return null;
  const marker = hasMarker(e) ? 'done marker present but worker not idle' : 'no done marker';
  return `${e.ticket} on ${where} last observed ${describeObserved(o)}, ${marker}: observe it with RemoteTrigger get`;
}

export function makeHoldDecision({ rule4 = doneAndIdle } = {}) {
  return function holdDecision(entries, { repo, branch } = {}, now) {
    const nowMs = toMs(now);
    // Fail closed: an unreadable ledger or clock never frees a branch.
    if (!Array.isArray(entries)) {
      return { allow: false, reason: 'ledger entries are not an array: re-read the ledger before dispatching' };
    }
    if (!repo || !branch) {
      return { allow: false, reason: 'no repo/branch given: pass the target repo and branch' };
    }
    if (!Number.isFinite(nowMs)) {
      return { allow: false, reason: 'now is not a valid time: pass the current time' };
    }
    for (const e of entries) {
      if (!e || typeof e !== 'object') {
        return { allow: false, reason: 'ledger holds a malformed entry: re-read the ledger before dispatching' };
      }
      if (e.kind === 'routine') continue;
      if (e.repo !== repo || e.branch !== branch) continue;
      if (e.status === 'finished') continue;
      const reason = entryHold(e, nowMs, rule4);
      if (reason) return { allow: false, reason, blockedBy: e.ticket };
    }
    return { allow: true, reason: `branch free: ${repo}#${branch}` };
  };
}

export const holdDecision = makeHoldDecision();

// ---------------------------------------------------------------- self-test

const REPO = '123constante/bachata-website';
const BR = 'claude/x';
const NOW = '2026-10-29T12:00:00.000Z';
const w = (over) => ({ ticket: 'dt_a', kind: 'worker', repo: REPO, branch: BR, status: 'running', ...over });
const listIdle = { at: '2026-10-29T11:50:00Z', source: 'list_runs', status: 'active', worker_status: 'idle' };
const listRunning = { at: '2026-10-29T11:50:00Z', source: 'list_runs', status: 'active', worker_status: 'running' };
const getOk = { at: '2026-10-29T11:50:00Z', source: 'get', status: 'ROUTINE_RUN_STATUS_SUCCEEDED' };
const getFail = { at: '2026-10-29T11:50:00Z', source: 'get', status: 'ROUTINE_RUN_STATUS_FAILED' };
const MARK = '2026-10-29T11:45:00Z';

// Each case: entries, expected allow, a substring the reason must carry, and
// the expected blockedBy (undefined when allowed).
export const CASES = [
  ['R1 empty ledger: branch free', [], true, 'branch free'],
  ['R1 routine entry on the branch is ignored', [w({ kind: 'routine' })], true, 'branch free'],
  ['R1 other branch never holds this one', [w({ branch: 'claude/other' })], true, 'branch free'],
  ['R1 other repo never holds this one', [w({ repo: 'x/y' })], true, 'branch free'],
  ['R1 finished entry releases', [w({ status: 'finished', observed: listRunning })], true, 'branch free'],
  ['R1 live worker on the branch blocks', [w({ observed: listRunning })], false, 'RemoteTrigger get', 'dt_a'],
  ['R2 never observed (running) blocks', [w({})], false, 'never observed: observe it with RemoteTrigger get', 'dt_a'],
  ['R2 never observed (prepared) blocks', [w({ status: 'prepared' })], false, 'never observed', 'dt_a'],
  ['R2 never observed blocks even with a done marker', [w({ done_marker_at: MARK })], false, 'never observed', 'dt_a'],
  ['R3 terminal SUCCEEDED + marker releases at once', [w({ observed: getOk, done_marker_at: MARK, terminal_since: '2026-10-29T11:59:00Z' })], true, 'branch free'],
  ['R3 terminal no marker, 31 min ago releases', [w({ observed: getOk, terminal_since: '2026-10-29T11:29:00Z' })], true, 'branch free'],
  ['R3 terminal FAILED no marker, 31 min ago releases', [w({ observed: getFail, terminal_since: '2026-10-29T11:29:00Z' })], true, 'branch free'],
  ['R3 terminal no marker, 10 min ago blocks with wait time', [w({ observed: getOk, terminal_since: '2026-10-29T11:50:00Z' })], false, 'wait until 2026-10-29T12:20:00.000Z', 'dt_a'],
  ['R3 terminal no marker, no terminal_since blocks', [w({ observed: getOk })], false, 'observe it with RemoteTrigger get', 'dt_a'],
  ['R4 marker + list_runs idle releases at once', [w({ observed: listIdle, done_marker_at: MARK })], true, 'branch free'],
  ['R4 marker + idle releases even seconds after the marker', [w({ observed: { ...listIdle, at: NOW }, done_marker_at: '2026-10-29T11:59:59Z' })], true, 'branch free'],
  ['R4 marker but worker still running blocks', [w({ observed: listRunning, done_marker_at: MARK })], false, 'not idle: observe it with RemoteTrigger get', 'dt_a'],
  ['R4 marker that is not a date does not count', [w({ observed: listIdle, done_marker_at: 'yes' })], false, 'no done marker', 'dt_a'],
  ['R5 idle without marker blocks', [w({ observed: listIdle })], false, 'no done marker: observe it with RemoteTrigger get', 'dt_a'],
  ['R5 active/running without marker blocks', [w({ observed: listRunning })], false, 'no done marker', 'dt_a'],
  ['R5 different ticket: A done+idle, B idle no marker -> B blocks', [w({ observed: listIdle, done_marker_at: MARK }), w({ ticket: 'dt_b', observed: listIdle })], false, 'dt_b', 'dt_b'],
  ['R5 both tickets done+idle release', [w({ observed: listIdle, done_marker_at: MARK }), w({ ticket: 'dt_b', observed: listIdle, done_marker_at: MARK })], true, 'branch free'],
  ['R6 malformed ledger fails closed', 'not-an-array', false, 're-read the ledger'],
];

export function runCases(decide) {
  return CASES.map(([name, entries, allow, reasonHas, blockedBy]) => {
    const got = decide(entries, { repo: REPO, branch: BR }, NOW);
    const ok =
      got.allow === allow && got.reason.includes(reasonHas) && got.blockedBy === blockedBy;
    return { name, ok, got };
  });
}

export function selfTest(log = console.log) {
  const rows = runCases(holdDecision);
  log('| # | case | result | reason |');
  log('|---|---|---|---|');
  rows.forEach((r, i) =>
    log(`| ${i + 1} | ${r.name} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.got.reason.replace(/\|/g, '\\|')} |`),
  );
  const failed = rows.filter((r) => !r.ok).length;
  // Mutant: rule 4's condition replaced with `true`. It must turn >= 2 red,
  // or the table above does not actually pin rule 4.
  const mutantRed = runCases(makeHoldDecision({ rule4: () => true })).filter((r) => !r.ok);
  log('');
  log(`mutant (rule 4 condition -> true): ${mutantRed.length} case(s) red`);
  for (const r of mutantRed) log(`  red: ${r.name}`);
  const mutantOk = mutantRed.length >= 2;
  log('');
  log(`hold-rule self-test: ${rows.length - failed}/${rows.length} pass; mutant ${mutantOk ? 'KILLED' : 'SURVIVED'}`);
  return failed === 0 && mutantOk ? 0 : 1;
}

// Entry point: compare REALPATHS (a raw import.meta-vs-argv compare fails open
// through a symlink or junction). Kept inline so the file stays self-contained.
const invoked = process.argv.slice(1, 2)[0];
let isMain = false;
try {
  isMain = invoked !== undefined && realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
} catch (err) {
  process.stderr.write(`hold-rule: cannot resolve entry point (${err.message})\n`);
  process.exitCode = 2;
}
if (isMain) {
  if (process.argv.includes('--self-test')) process.exitCode = selfTest();
  else {
    process.stderr.write('usage: node hold-rule.mjs --self-test   (import holdDecision for real use)\n');
    process.exitCode = 2;
  }
}
