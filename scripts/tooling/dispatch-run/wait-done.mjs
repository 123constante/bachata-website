#!/usr/bin/env node
// wait-done.mjs -- wait for a cloud worker's done commit, by plain git.
//
//   node wait-done.mjs <owner/name> <branch> <ticket>
//        [--timeout-min 55] [--interval-s 60] [--repo-dir <path>]
//
// Every interval it runs `git fetch -q origin <branch>` in the repo dir and
// reads the newest 8 commit subjects of FETCH_HEAD. It prints exactly ONE line:
//
//   DONE <ticket> <sha> <subject>       exit 0   "[worker-done <ticket>]"
//   PARTIAL <ticket> <sha> <subject>    exit 10  "PARTIAL [worker-done <ticket>]"
//   TIMEOUT <ticket> last=<sha|none>    exit 11  no marker before the timeout
//   ERROR <reason>                      exit 2   bad args, wrong repo, git broken
//
// Why it exists: Monitor watchers expired after ~5 minutes, costing a turn each
// time. This ends on the worker's own final commit, with a bounded timeout.
// It never runs a shell string (execFileSync with an args array) and never
// loops past the timeout. A branch that does not exist on origin YET is not an
// error -- the worker may not have pushed -- it just keeps waiting.
//
// Self-test (no git, no sleep -- runner and clock are injected):
//   node wait-done.mjs --self-test

import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const EXIT = { DONE: 0, ERROR: 2, PARTIAL: 10, TIMEOUT: 11 };
const MAX_FETCH_FAILURES = 3;

const TICKET_RE = /^[A-Za-z0-9_-]+$/;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const BRANCH_RE = /^[A-Za-z0-9._/-]+$/;

export function parseArgs(argv) {
  const pos = [];
  const opt = { timeoutMin: 55, intervalS: 60, repoDir: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--timeout-min' || a === '--interval-s' || a === '--repo-dir') {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      if (a === '--repo-dir') opt.repoDir = v;
      else {
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0) throw new Error(`${a} must be a positive number`);
        if (a === '--timeout-min') opt.timeoutMin = n;
        else opt.intervalS = n;
      }
    } else if (a.startsWith('--')) throw new Error(`unknown flag ${a}`);
    else pos.push(a);
  }
  if (pos.length !== 3) throw new Error('usage: wait-done.mjs <owner/name> <branch> <ticket> [--timeout-min N] [--interval-s N] [--repo-dir P]');
  const [repo, branch, ticket] = pos;
  if (!REPO_RE.test(repo)) throw new Error(`bad repo "${repo}" (want owner/name)`);
  if (!BRANCH_RE.test(branch) || branch.startsWith('-') || branch.includes('..')) throw new Error(`bad branch "${branch}"`);
  if (!TICKET_RE.test(ticket)) throw new Error(`bad ticket "${ticket}"`);
  return { repo, branch, ticket, ...opt };
}

/** lines: "<sha>\t<subject>" newest first. First marker found wins. */
export function findMarker(lines, ticket) {
  const done = `[worker-done ${ticket}]`;
  const partial = `PARTIAL ${done}`;
  for (const line of lines) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const sha = line.slice(0, tab);
    const subject = line.slice(tab + 1);
    if (subject.includes(partial)) return { kind: 'PARTIAL', sha, subject };
    if (subject.includes(done)) return { kind: 'DONE', sha, subject };
  }
  return null;
}

const originMatches = (url, repo) =>
  url.trim().replace(/\.git$/, '').replace(/\/$/, '').toLowerCase().endsWith('/' + repo.toLowerCase()) ||
  url.trim().replace(/\.git$/, '').toLowerCase().endsWith(':' + repo.toLowerCase());

const isMissingRef = (msg) => /couldn't find remote ref|could not find remote ref/i.test(msg);

/**
 * deps: { git(args, cwd) -> stdout (throws on non-zero), now() -> ms, sleep(ms) }
 * Returns { line, code }; prints nothing itself.
 */
export async function waitDone(opts, deps) {
  const { repo, branch, ticket, timeoutMin, intervalS, repoDir } = opts;
  const err = (reason) => ({ line: `ERROR ${reason}`, code: EXIT.ERROR });
  let url;
  try {
    url = deps.git(['remote', 'get-url', 'origin'], repoDir);
  } catch (e) {
    return err(`no origin remote in ${repoDir}: ${firstLine(e)}`);
  }
  // Never echo credentials an origin URL may embed (https://user:token@host/...).
  if (!originMatches(url, repo)) return err(`origin is ${url.trim().replace(/\/\/[^/@]*@/, '//')}, not ${repo}`);

  const deadline = deps.now() + timeoutMin * 60_000;
  let last = 'none';
  let failures = 0;
  for (;;) {
    let fetched = false;
    try {
      deps.git(['fetch', '-q', 'origin', branch], repoDir);
      fetched = true;
      failures = 0;
    } catch (e) {
      if (!isMissingRef(firstLine(e, true))) {
        failures += 1;
        if (failures >= MAX_FETCH_FAILURES) return err(`git fetch failed ${failures}x: ${firstLine(e)}`);
      }
    }
    if (fetched) {
      let out;
      try {
        out = deps.git(['log', '-8', '--format=%H%x09%s', 'FETCH_HEAD'], repoDir);
      } catch (e) {
        return err(`git log FETCH_HEAD failed: ${firstLine(e)}`);
      }
      const lines = out.split('\n').filter(Boolean);
      if (lines.length > 0) last = lines[0].split('\t')[0];
      const hit = findMarker(lines, ticket);
      if (hit) return { line: `${hit.kind} ${ticket} ${hit.sha} ${hit.subject}`, code: EXIT[hit.kind] };
    }
    const left = deadline - deps.now();
    if (left <= 0) return { line: `TIMEOUT ${ticket} last=${last}`, code: EXIT.TIMEOUT };
    await deps.sleep(Math.min(intervalS * 1000, left));
  }
}

function firstLine(e, all = false) {
  const text = String(e?.stderr || e?.message || e).trim();
  return all ? text : text.split('\n')[0];
}

export const realDeps = {
  git: (args, cwd) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

export async function main(argv, deps = realDeps) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    return { line: `ERROR ${e.message}`, code: EXIT.ERROR };
  }
  return waitDone(opts, deps);
}

// ---------------------------------------------------------------- self-test

const T = 'dt_abc123';
const SHA1 = 'a'.repeat(40);
const SHA2 = 'b'.repeat(40);
const ORIGIN = 'http://proxy@127.0.0.1:1/git/123constante/bachata-website\n';

/** A fake git: `script` is a list of per-poll FETCH_HEAD logs, or Error objects. */
function fakeDeps({ origin = ORIGIN, polls, logFails = false }) {
  let t = 0;
  let poll = -1;
  const calls = [];
  return {
    calls,
    now: () => t,
    sleep: async (ms) => {
      calls.push(['sleep', ms]);
      t += ms;
    },
    git: (args) => {
      calls.push(args);
      if (args[0] === 'remote') {
        if (origin instanceof Error) throw origin;
        return origin;
      }
      if (args[0] === 'fetch') {
        poll = Math.min(poll + 1, polls.length - 1);
        if (polls[poll] instanceof Error) throw polls[poll];
        return '';
      }
      if (args[0] === 'log') {
        if (logFails) throw new Error('fatal: bad FETCH_HEAD');
        return polls[poll].map(([s, m]) => `${s}\t${m}`).join('\n') + '\n';
      }
      throw new Error('unexpected git ' + args.join(' '));
    },
  };
}

const missing = Object.assign(new Error('x'), { stderr: "fatal: couldn't find remote ref claude/x" });
const netErr = Object.assign(new Error('x'), { stderr: 'fatal: unable to access: Connection reset' });
const args = (...extra) => ['123constante/bachata-website', 'claude/x', T, '--timeout-min', '5', '--interval-s', '60', ...extra];

// [name, argv, fakeDeps opts, expected code, expected line prefix, extra check?]
export const CASES = [
  ['DONE on the first poll', args(), { polls: [[[SHA1, `feat: x [worker-done ${T}]`]]] }, 0, `DONE ${T} ${SHA1} feat: x [worker-done ${T}]`],
  ['PARTIAL is not reported as DONE', args(), { polls: [[[SHA1, `wip PARTIAL [worker-done ${T}]`]]] }, 10, `PARTIAL ${T} ${SHA1}`],
  ['marker found in the 8th newest commit', args(), { polls: [[...Array(7).fill([SHA2, 'chore: other']), [SHA1, `x [worker-done ${T}]`]]] }, 0, `DONE ${T} ${SHA1}`],
  ['another ticket\'s marker does not end the wait', args(), { polls: [[[SHA1, '[worker-done dt_abc1234]'], [SHA2, '[worker-done dt_other]']]] }, 11, `TIMEOUT ${T} last=${SHA1}`],
  ['marker appears on a later poll', args(), { polls: [[[SHA2, 'chore: start']], [[SHA1, `done [worker-done ${T}]`], [SHA2, 'chore: start']]] }, 0, `DONE ${T} ${SHA1}`],
  ['branch not on origin yet: waits, then TIMEOUT last=none', args(), { polls: [missing] }, 11, `TIMEOUT ${T} last=none`, (d) => d.calls.filter((c) => c[0] === 'fetch').length === 6],
  ['branch appears after missing-ref polls', args(), { polls: [missing, missing, [[SHA1, `[worker-done ${T}]`]]] }, 0, `DONE ${T} ${SHA1}`],
  ['3 real fetch failures in a row -> ERROR', args(), { polls: [netErr] }, 2, 'ERROR git fetch failed 3x'],
  ['one transient fetch failure is survived', args(), { polls: [netErr, [[SHA1, `[worker-done ${T}]`]]] }, 0, `DONE ${T} ${SHA1}`],
  ['git log failure -> ERROR', args(), { polls: [[[SHA1, 'x']]], logFails: true }, 2, 'ERROR git log FETCH_HEAD failed'],
  ['origin is another repo -> ERROR', args(), { origin: 'https://github.com/x/other.git\n', polls: [[]] }, 2, 'ERROR origin is'],
  ['origin URL credentials are never printed', args(), { origin: 'https://x-access-token:SECRET@github.com/x/other.git\n', polls: [[]] }, 2, 'ERROR origin is https://github.com/x/other'],
  ['no origin remote -> ERROR', args(), { origin: new Error('no such remote'), polls: [[]] }, 2, 'ERROR no origin remote'],
  ['timeout is bounded: sleeps never pass the deadline', args(), { polls: [[[SHA2, 'x']]] }, 11, `TIMEOUT ${T} last=${SHA2}`, (d) => d.calls.filter((c) => c[0] === 'sleep').reduce((s, c) => s + c[1], 0) === 5 * 60_000],
  ['missing args -> ERROR', ['a/b', 'br'], { polls: [[]] }, 2, 'ERROR usage'],
  ['ticket with shell metachars -> ERROR', ['a/b', 'br', 'x;rm'], { polls: [[]] }, 2, 'ERROR bad ticket'],
  ['branch starting with - -> ERROR', ['a/b', '--upload-pack=x'], { polls: [[]] }, 2, 'ERROR unknown flag'],
  ['negative timeout -> ERROR', args('--timeout-min', '-1'), { polls: [[]] }, 2, 'ERROR --timeout-min must be'],
  ['default timeout is 55 min', ['123constante/bachata-website', 'claude/x', T], { polls: [[[SHA2, 'x']]] }, 11, 'TIMEOUT', (d) => d.calls.filter((c) => c[0] === 'sleep').reduce((s, c) => s + c[1], 0) === 55 * 60_000],
  ['git is called with args arrays, fetch -q origin <branch>', args(), { polls: [[[SHA1, `[worker-done ${T}]`]]] }, 0, 'DONE', (d) => JSON.stringify(d.calls.find((c) => c[0] === 'fetch')) === JSON.stringify(['fetch', '-q', 'origin', 'claude/x'])],
];

export async function runCases(mainFn) {
  const rows = [];
  for (const [name, argv, fo, code, prefix, extra] of CASES) {
    const d = fakeDeps(fo);
    const got = await mainFn(argv, d);
    const ok = got.code === code && got.line.startsWith(prefix) && !got.line.includes('\n') && (!extra || extra(d));
    rows.push({ name, ok, got });
  }
  return rows;
}

export async function selfTest(log = console.log) {
  const rows = await runCases(main);
  log('| # | case | result | output line (exit) |');
  log('|---|---|---|---|');
  rows.forEach((r, i) => log(`| ${i + 1} | ${r.name.replace(/\|/g, '\\|')} | ${r.ok ? 'PASS' : 'FAIL'} | \`${r.got.line.replace(/\|/g, '\\|')}\` (${r.got.code}) |`));
  const failed = rows.filter((r) => !r.ok).length;
  // Mutants: each must turn >= 1 case red or the table does not pin it.
  const mutants = [
    ['PARTIAL reported as DONE', async (argv, d) => { const r = await main(argv, d); return r.code === 10 ? { line: r.line.replace(/^PARTIAL/, 'DONE'), code: 0 } : r; }],
    ['TIMEOUT exits 0', async (argv, d) => { const r = await main(argv, d); return r.code === 11 ? { ...r, code: 0 } : r; }],
    ['missing-ref treated as fatal', async (argv, d) => { const g = d.git; d.git = (a, c) => { try { return g(a, c); } catch (e) { if (a[0] === 'fetch') throw Object.assign(new Error('x'), { stderr: 'fatal: boom' }); throw e; } }; return main(argv, d); }],
  ];
  log('');
  let survived = 0;
  for (const [name, fn] of mutants) {
    const red = (await runCases(fn)).filter((r) => !r.ok).length;
    if (red < 1) survived += 1;
    log(`mutant (${name}): ${red} case(s) red -> ${red >= 1 ? 'KILLED' : 'SURVIVED'}`);
  }
  log('');
  log(`wait-done self-test: ${rows.length - failed}/${rows.length} pass; mutants survived: ${survived}`);
  return failed === 0 && survived === 0 ? 0 : 1;
}

// Entry point: compare REALPATHS (a raw import.meta-vs-argv compare fails open
// through a symlink or junction). Kept inline so the file stays self-contained.
const invoked = process.argv.slice(1, 2)[0];
let isMain = false;
try {
  isMain = invoked !== undefined && realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
} catch (err) {
  process.stdout.write(`ERROR cannot resolve entry point (${err.message})\n`);
  process.exitCode = EXIT.ERROR;
}
if (isMain) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--self-test') process.exitCode = await selfTest();
  else {
    const { line, code } = await main(argv);
    process.stdout.write(line + '\n');
    process.exitCode = code;
  }
}
