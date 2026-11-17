#!/usr/bin/env node
/**
 * check-ci-wallclock.mjs -- wall-clock budget for the PR checks people wait on.
 *
 * check-ci-budget.mjs guards what CI COSTS (minutes, artifact storage). This
 * guards how long a PR author WAITS: for each workflow in
 * ci-wallclock-budgets.json it reads the most recent completed pull_request
 * runs of that workflow in this repo and compares the p90 wall-clock
 * (run_started_at -> updated_at) with the budget. Owner decision 4 of
 * docs/briefs/ci-speed-profile-and-trim.md: a creeping suite (Phone QA's slow
 * shard, E2E Smoke's 1168 s outlier, the unit leg against its timeout) should
 * go red here, not be found in an audit months later.
 *
 * Runs in phone-qa.yml (job wallclock-budget: advisory on a PR, real exit code on
 * workflow_dispatch). Read-only: one GET per workflow.
 *
 * Exit codes (check-script-conventions R3):
 *   0  every workflow's p90 is inside its fail budget (warnings may print)
 *   1  a workflow's p90 is over its fail budget
 *   2  cannot measure: no token / repo, an HTTP failure, a malformed config,
 *      or fewer completed runs than minRuns (assertMeasured floor, R1)
 *
 *   node scripts/check-ci-wallclock.mjs              live (needs GITHUB_TOKEN, GITHUB_REPOSITORY)
 *   node scripts/check-ci-wallclock.mjs --self-test  fixture canary; drives main()
 */
import { readFileSync } from 'node:fs';
import { assertMeasured } from './lib/previewProbe.mjs';
import { isEntryPoint } from './lib/entry-point.mjs';

const CONFIG_PATH = new URL('../ci-wallclock-budgets.json', import.meta.url);

export function assertConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') throw new Error('config is not an object');
  if (!Number.isInteger(cfg.sampleRuns) || cfg.sampleRuns < 1) throw new Error('sampleRuns must be a positive integer');
  if (!Number.isInteger(cfg.minRuns) || cfg.minRuns < 1 || cfg.minRuns > cfg.sampleRuns) {
    throw new Error('minRuns must be an integer in 1..sampleRuns');
  }
  if (!Array.isArray(cfg.workflows) || cfg.workflows.length === 0) throw new Error('workflows must be a non-empty array');
  for (const w of cfg.workflows) {
    if (typeof w.file !== 'string' || !/^[\w.-]+\.ya?ml$/.test(w.file)) throw new Error(`bad workflow file: ${w.file}`);
    if (!(w.warnSeconds > 0) || !(w.failSeconds > w.warnSeconds)) {
      throw new Error(`${w.file}: need 0 < warnSeconds < failSeconds`);
    }
    if (!(w.ignoreBelowSeconds >= 0) || !(w.ignoreBelowSeconds < w.warnSeconds)) {
      throw new Error(`${w.file}: need 0 <= ignoreBelowSeconds < warnSeconds`);
    }
  }
  return cfg;
}

/** Nearest-rank percentile of a non-empty numeric list. */
export function percentile(values, p) {
  const s = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * s.length);
  return s[Math.min(s.length, Math.max(1, rank)) - 1];
}

/**
 * Wall-clock seconds of each completed, non-cancelled run of at least ignoreBelow seconds.
 * The floor drops the skip-mode runs (docs-only, e2e_skip, ci_light) that finish in well
 * under a minute with conclusion success: counted, they would drag the p90 down and hide a
 * slow full suite. updated_at is the run record's last touch, normally its completion; a
 * late metadata touch can only overstate a run, so the guard errs toward red, not green.
 */
export function runSeconds(runs, ignoreBelow = 0) {
  return runs
    .filter((r) => r.status === 'completed' && r.conclusion !== 'cancelled' && r.conclusion !== 'skipped')
    .map((r) => (Date.parse(r.updated_at) - Date.parse(r.run_started_at)) / 1000)
    .filter((s) => Number.isFinite(s) && s >= ignoreBelow);
}

export function verdict(p90, w) {
  if (p90 > w.failSeconds) return 'FAIL';
  if (p90 > w.warnSeconds) return 'WARN';
  return 'OK';
}

/** Live reader: GET .../actions/workflows/<file>/runs?event=pull_request&status=completed. */
export function makeGitHubFetch({ token, repo, fetchImpl = globalThis.fetch }) {
  return async (file, perPage) => {
    const url = `https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(file)}/runs` +
      `?event=pull_request&status=completed&per_page=${perPage}`;
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'ci-wallclock-guard' },
    });
    if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body.workflow_runs)) throw new Error(`GET ${url}: no workflow_runs array`);
    return body.workflow_runs;
  };
}

/** Returns the exit code; never calls process.exit (R5: the canary drives this). */
export async function main(argv = [], deps = {}) {
  const log = deps.log ?? console.log;
  const err = deps.err ?? console.error;
  let cfg;
  let fetchRuns;
  try {
    cfg = assertConfig(deps.cfg ?? JSON.parse(readFileSync(CONFIG_PATH, 'utf8')));
    if (deps.fetchRuns) {
      fetchRuns = deps.fetchRuns;
    } else {
      const env = deps.env ?? process.env;
      if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not set');
      if (!env.GITHUB_REPOSITORY) throw new Error('GITHUB_REPOSITORY is not set');
      fetchRuns = makeGitHubFetch({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPOSITORY });
    }
  } catch (e) {
    err(`CANNOT MEASURE -- ${e.message}`);
    return 2;
  }
  let worst = 0;
  let measured = 0;
  for (const w of cfg.workflows) {
    let secs;
    try {
      secs = runSeconds(await fetchRuns(w.file, cfg.sampleRuns), w.ignoreBelowSeconds).slice(0, cfg.sampleRuns);
      assertMeasured(secs.length, cfg.minRuns, `${w.file} completed PR runs`);
    } catch (e) {
      err(`CANNOT MEASURE ${w.file} -- ${e.message}`);
      return 2;
    }
    measured++;
    const p50 = percentile(secs, 50);
    const p90 = percentile(secs, 90);
    const v = verdict(p90, w);
    log(`${v.padEnd(4)} ${w.file}: p50 ${Math.round(p50)}s, p90 ${Math.round(p90)}s over ${secs.length} runs ` +
      `(warn > ${w.warnSeconds}s, fail > ${w.failSeconds}s)`);
    if (v === 'WARN') log(`::warning::${w.file} p90 wall-clock ${Math.round(p90)}s is over its ${w.warnSeconds}s warn budget`);
    if (v === 'FAIL') worst = 1;
  }
  try {
    assertMeasured(measured, cfg.workflows.length, 'workflows');
  } catch (e) {
    err(`CANNOT MEASURE -- ${e.message}`);
    return 2;
  }
  return worst;
}

// ---------------------------------------------------------------------------
// Canary: drives main() with fixtures and demands each exit code.
const run = (start, secs, conclusion = 'success') => ({
  status: 'completed', conclusion,
  run_started_at: new Date(start).toISOString(),
  updated_at: new Date(start + secs * 1000).toISOString(),
});
const FIX_CFG = { sampleRuns: 10, minRuns: 3, workflows: [{ file: 'a.yml', warnSeconds: 600, failSeconds: 900, ignoreBelowSeconds: 60 }] };
const runsOf = (...secs) => secs.map((s, i) => run(Date.UTC(2026, 10, 1, 0, i), s));
const quiet = { log: () => {}, err: () => {} };

export const CASES = [
  ['all fast -> 0', { cfg: FIX_CFG, fetchRuns: async () => runsOf(100, 200, 300, 400) }, 0],
  ['p90 between warn and fail -> 0', { cfg: FIX_CFG, fetchRuns: async () => runsOf(100, 200, 700, 700) }, 0],
  ['p90 over fail -> 1', { cfg: FIX_CFG, fetchRuns: async () => runsOf(100, 200, 950, 1000) }, 1],
  ['cancelled runs do not count', { cfg: FIX_CFG, fetchRuns: async () => [...runsOf(100, 200, 300), run(0, 5000, 'cancelled')] }, 0],
  // Counted: 100, 100, 950 -> p90 950, over fail. With the seven 30 s skip-mode runs
  // counted too, p90 of the ten would be 100 and the slow run would hide.
  ['skip-mode runs under the floor do not dilute p90 -> 1', { cfg: FIX_CFG, fetchRuns: async () => runsOf(100, 100, 950, 30, 30, 30, 30, 30, 30, 30) }, 1],
  ['only skip-mode runs -> 2 (floor)', { cfg: FIX_CFG, fetchRuns: async () => runsOf(30, 30, 30, 30) }, 2],
  ['ignoreBelow >= warn config -> 2', { cfg: { ...FIX_CFG, workflows: [{ file: 'a.yml', warnSeconds: 600, failSeconds: 900, ignoreBelowSeconds: 600 }] }, fetchRuns: async () => runsOf(700, 700, 700) }, 2],
  ['too few runs -> 2 (floor)', { cfg: FIX_CFG, fetchRuns: async () => runsOf(100, 200) }, 2],
  ['only cancelled runs -> 2', { cfg: FIX_CFG, fetchRuns: async () => [run(0, 50, 'cancelled'), run(0, 50, 'cancelled'), run(0, 50, 'cancelled')] }, 2],
  ['empty list -> 2', { cfg: FIX_CFG, fetchRuns: async () => [] }, 2],
  ['HTTP failure -> 2', { cfg: FIX_CFG, fetchRuns: async () => { throw new Error('HTTP 403'); } }, 2],
  ['no token -> 2', { cfg: FIX_CFG, env: { GITHUB_REPOSITORY: 'o/r' } }, 2],
  ['no repo -> 2', { cfg: FIX_CFG, env: { GITHUB_TOKEN: 'x' } }, 2],
  ['malformed config -> 2', { cfg: { sampleRuns: 10, minRuns: 3, workflows: [] }, fetchRuns: async () => runsOf(1, 2, 3) }, 2],
  ['warn >= fail config -> 2', { cfg: { ...FIX_CFG, workflows: [{ file: 'a.yml', warnSeconds: 900, failSeconds: 900 }] }, fetchRuns: async () => runsOf(1, 2, 3) }, 2],
  ['second workflow over fail -> 1', {
    cfg: { ...FIX_CFG, workflows: [...FIX_CFG.workflows, { file: 'b.yml', warnSeconds: 60, failSeconds: 120, ignoreBelowSeconds: 0 }] },
    fetchRuns: async (f) => (f === 'b.yml' ? runsOf(200, 200, 200) : runsOf(100, 100, 100)),
  }, 1],
  ['live fetch: HTTP 500 -> 2', {
    cfg: FIX_CFG,
    fetchRuns: makeGitHubFetch({ token: 't', repo: 'o/r', fetchImpl: async () => ({ ok: false, status: 500 }) }),
  }, 2],
  ['live fetch: no workflow_runs -> 2', {
    cfg: FIX_CFG,
    fetchRuns: makeGitHubFetch({ token: 't', repo: 'o/r', fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }),
  }, 2],
];

async function selfTest() {
  let bad = 0;
  for (const [name, deps, want] of CASES) {
    const got = await main([], { ...quiet, ...deps });
    if (got !== want) { console.error(`FAIL case: ${name} -- exit ${got}, want ${want}`); bad++; }
  }
  // The WARN band exits 0, so the exit code alone cannot prove the warning is printed.
  const lines = [];
  const warnExit = await main([], { cfg: FIX_CFG, fetchRuns: async () => runsOf(100, 200, 700, 700), log: (l) => lines.push(l), err: () => {} });
  if (warnExit !== 0 || !lines.some((l) => l.startsWith('::warning::a.yml'))) { console.error('FAIL warn band prints no ::warning::'); bad++; }
  const okLines = [];
  await main([], { cfg: FIX_CFG, fetchRuns: async () => runsOf(100, 200, 300), log: (l) => okLines.push(l), err: () => {} });
  if (okLines.some((l) => l.startsWith('::warning::'))) { console.error('FAIL OK band prints a ::warning::'); bad++; }
  if (percentile([5, 1, 3, 2, 4], 90) !== 5 || percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50) !== 5) {
    console.error('FAIL percentile'); bad++;
  }
  // The shipped config must parse, or the live run is a guaranteed exit 2.
  try { assertConfig(JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))); } catch (e) { console.error(`FAIL shipped config: ${e.message}`); bad++; }
  if (bad) { console.error(`FAIL self-test -- ${bad} problem(s).`); return 1; }
  console.log(`PASS self-test -- ${CASES.length} cases, exits 0/1/2 each driven through main().`);
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  const argv = process.argv.slice(2);
  process.exitCode = argv.includes('--self-test') ? await selfTest() : await main(argv);
}
