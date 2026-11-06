#!/usr/bin/env node
// route-runner.mjs -- CI offload: decide self-hosted vs GitHub-hosted for a routed job,
// and every fallback decision after that. Owner rule (2026-11-06): a side machine that is
// off, busy or broken must NEVER turn a PR red or block a merge. Every unknown -> hosted.
// Design + residual risk: docs/handover/ci-offload-stage3.md ("Fallback design", "Trust").
//
//   node scripts/ci/route-runner.mjs route      (route job, hosted)  -> target=self|hosted runner=<label> reason=
//   node scripts/ci/route-runner.mjs gate       (routed job, step 1) -> proceed=true|false
//   node scripts/ci/route-runner.mjs verdict <exit-code>  (routed job) -> verdict=pass|busy-timeout|runner-error|code-failure
//   node scripts/ci/route-runner.mjs await      (required hosted job) -> action=skip-pass|fail-code|run-hosted
//   node scripts/ci/route-runner.mjs fallback   (compat, fix round 1 YAML) -> action=skip-pass|fail-code|run-hosted
//   node scripts/ci/route-runner.mjs --self-test
// Outputs go to stdout and $GITHUB_OUTPUT. Every subcommand exits 0 except a failing
// --self-test: infrastructure never reds a PR. A routed code failure is reported by the
// verdict OUTPUT plus a marker step (fix round 2 item 4), never by this script's exit code,
// so a crashed node (exit 1 from an import error) can never pass for a code failure.
// fix round 2: the watchdog that cancelled the WHOLE run is gone; `await` polls instead.
import { appendFileSync, readFileSync } from 'node:fs';
import { isEntryPoint } from '../lib/entry-point.mjs';

// Item 2 (trust): who may run on the side machine. Keep SHORT; widening it is a review item.
export const TRUSTED_AUTHORS = ['kiki-claude-bot', '123constante'];
// A PR touching these always runs hosted: it could change the routing or the workflow itself.
// scripts/lib/ (route-runner imports entry-point.mjs) and the npm manifests (install-time code)
// are as dangerous as scripts/ci/ (fix round 2 item 2).
export const PROTECTED_PREFIXES = ['.github/', 'scripts/ci/', 'scripts/lib/', 'package.json', 'package-lock.json'];
export const HOSTED = 'ubuntu-latest';
const LABEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;

/** Positive allowlist. -> { trusted, reason } */
export function trustDecision({ eventName, ref, headRepo, repo, author, files, filesError } = {}) {
  if (eventName === 'push') {
    return ref === 'refs/heads/main' ? { trusted: true, reason: 'push to main' } : { trusted: false, reason: `push to ${ref || '?'} (only main)` };
  }
  if (eventName !== 'pull_request') return { trusted: false, reason: `event ${eventName || '?'} is not push/pull_request` };
  if (!repo || headRepo !== repo) return { trusted: false, reason: `PR head ${headRepo || '?'} is not ${repo || '?'}` };
  if (!TRUSTED_AUTHORS.includes(String(author || '').toLowerCase())) return { trusted: false, reason: `PR author ${author || '?'} not on the allowlist` };
  if (filesError || !Array.isArray(files)) return { trusted: false, reason: `changed files unknown (${filesError || 'none read'})` };
  const hit = files.find((f) => PROTECTED_PREFIXES.some((p) => String(f).startsWith(p)));
  if (hit) return { trusted: false, reason: `PR touches ${hit} (protected paths always run hosted)` };
  return { trusted: true, reason: 'same-repo PR by an allowlisted author, no protected paths' };
}

/** `label` may list several hosts in preference order ("acer-web,dell-web"). -> { target: 'self'|'hosted', runner, reason } */
export function pickRunner({ label, trust, runners, apiError } = {}) {
  const hosted = (reason) => ({ target: 'hosted', runner: HOSTED, reason });
  const labels = String(label || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!labels.length) return hosted('WEB_RUNNER_LABEL unset');
  const bad = labels.find((l) => !LABEL_RE.test(l) || l === HOSTED);
  if (bad) return hosted(`label ${JSON.stringify(bad)} is not a self-hosted label`);
  if (!trust || !trust.trusted) return hosted(`untrusted: ${trust ? trust.reason : 'no trust decision'}`);
  if (apiError) return hosted(`runner API error: ${apiError}`);
  if (!Array.isArray(runners)) return hosted('runner API returned no list');
  const why = [];
  for (const l of labels) {
    const mine = runners.filter((r) => Array.isArray(r.labels) && r.labels.some((x) => (x && x.name) === l));
    const online = mine.filter((r) => r.status === 'online');
    const idle = online.find((r) => r.busy === false);
    if (idle) return { target: 'self', runner: l, reason: `runner ${idle.name || l} online and idle` };
    why.push(!mine.length ? `no runner has label ${l}` : !online.length ? `runner ${l} offline` : `runner ${l} online but busy`);
  }
  return hosted(why.join('; '));
}

/** The gate hook writes "<run_id> <attempt> <job> ok|refused <why>"; anything else = do not run here. */
export function gateVerdict(text, { runId, attempt, job } = {}) {
  const line = String(text || '').trim().split('\n').pop() || '';
  const [r, a, j, word, ...why] = line.split(' ');
  if (!line) return { proceed: false, reason: 'no gate verdict file (hook did not run?)' };
  if (r !== String(runId) || a !== String(attempt) || j !== String(job)) return { proceed: false, reason: `stale gate verdict (${r}/${a}/${j})` };
  if (word === 'ok') return { proceed: true, reason: 'gate ok' };
  return { proceed: false, reason: `gate refused: ${why.join(' ') || word || '?'}` };
}

/**
 * Exit code of scripts/ci/bom-check.sh, run under `timeout --kill-after`. bom-check.sh exits 1
 * on a finding and nothing else, so ONLY 1 is a code failure (fix round 2 item 3).
 * 124 = timeout(1), 137 = SIGKILL after the grace: the machine was too slow -> busy-timeout.
 * Everything else (2 usage, 126 not executable, 127 not found, 128+n signal e.g. 130/139/143,
 * empty / non-numeric) is the RUNNER's problem -> runner-error -> hosted re-runs the check.
 */
export function classifyExit(code) {
  const s = String(code ?? '').trim();
  if (!/^\d{1,3}$/.test(s)) return 'runner-error';
  const c = Number(s);
  if (c === 0) return 'pass';
  if (c === 1) return 'code-failure';
  if (c === 124 || c === 137) return 'busy-timeout';
  return 'runner-error';
}

/** Required hosted job: -> 'skip-pass' | 'fail-code' | 'run-hosted'. Unknown -> run-hosted. */
export function fallbackAction({ target, routedResult, verdict } = {}) {
  if (target !== 'self') return 'run-hosted';
  if (verdict === 'pass' && routedResult === 'success') return 'skip-pass';
  if (verdict === 'code-failure') return 'fail-code';
  return 'run-hosted';
}

// The routed job's marker steps (bom-check.yml, PATCH B). Each runs only for its verdict, so
// the step's conclusion is unambiguous: a crash anywhere leaves both 'skipped' or absent.
export const PASS_STEP = 'BOM verdict: pass';
export const FAIL_STEP = 'BOM verdict: code failure';
const QUEUED = new Set(['queued', 'waiting', 'pending', 'requested']);

/**
 * Required hosted job, polling the routed job (fix round 2 item 4: it does NOT need: the routed
 * job, so nothing waits on the side machine and nothing cancels the run).
 * job = the API job object or undefined. -> 'wait' | 'skip-pass' | 'fail-code' | 'run-hosted'.
 * Red ONLY when the routed job completed AND its code-failure marker step failed.
 */
export function awaitDecision({ job, elapsedS, queueBudgetS = 120, totalBudgetS = 660 } = {}) {
  if (!job || QUEUED.has(job.status)) return elapsedS >= queueBudgetS ? 'run-hosted' : 'wait';
  if (job.status !== 'completed') return elapsedS >= totalBudgetS ? 'run-hosted' : 'wait';
  const step = (n) => (Array.isArray(job.steps) ? job.steps : []).find((s) => s && s.name === n);
  const pass = step(PASS_STEP); const fail = step(FAIL_STEP);
  if (job.conclusion === 'success' && pass && pass.conclusion === 'success' && !(fail && fail.conclusion === 'failure')) return 'skip-pass';
  if (job.conclusion === 'failure' && fail && fail.conclusion === 'failure' && !(pass && pass.conclusion === 'success')) return 'fail-code';
  return 'run-hosted';
}

function emit(env, pairs, log) {
  for (const [k, v] of Object.entries(pairs)) {
    const s = String(v).replace(/[\r\n]+/g, ' ');
    log.log(`${k}=${s}`);
    if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `${k}=${s}\n`);
  }
}

async function api(env, path, token, init = {}) {
  const base = env.GITHUB_API_URL || 'https://api.github.com';
  const res = await fetch(base + path, {
    ...init,
    signal: AbortSignal.timeout(10000),
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28', 'user-agent': 'route-runner' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path.split('?')[0]}`);
  return res.status === 202 || res.status === 204 ? {} : res.json();
}

async function prFiles(env, deps) {
  const out = [];
  for (let page = 1; page <= 30; page++) {
    const batch = await deps.api(env, `/repos/${env.GITHUB_REPOSITORY}/pulls/${env.PR_NUMBER}/files?per_page=100&page=${page}`, env.GITHUB_TOKEN);
    out.push(...batch.map((f) => f.filename));
    if (!Array.isArray(batch) || batch.length < 100) return out;
  }
  throw new Error('more than 3000 changed files');
}

export async function runRoute(env, log, deps = { api }) {
  const label = String(env.WEB_RUNNER_LABEL || '').trim();
  if (!label) return emit(env, { target: 'hosted', runner: HOSTED, reason: 'WEB_RUNNER_LABEL unset' }, log);
  let files; let filesError = null;
  if (env.EVENT_NAME === 'pull_request') {
    try { files = await prFiles(env, deps); } catch (e) { filesError = e.message; }
  }
  const trust = trustDecision({ eventName: env.EVENT_NAME, ref: env.GITHUB_REF, headRepo: env.HEAD_REPO, repo: env.GITHUB_REPOSITORY, author: env.PR_AUTHOR, files, filesError });
  let runners; let apiError = null;
  if (trust.trusted) {
    if (!env.RUNNER_READ_TOKEN) apiError = 'RUNNER_READ_TOKEN not available';
    else {
      try { runners = (await deps.api(env, `/repos/${env.GITHUB_REPOSITORY}/actions/runners?per_page=100`, env.RUNNER_READ_TOKEN)).runners; } catch (e) { apiError = e.message; }
    }
  }
  const d = pickRunner({ label, trust, runners, apiError });
  emit(env, d, log);
}

export async function runAwait(env, log, deps = { api, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), now: () => Date.now() }) {
  if (env.TARGET !== 'self') return emit(env, { action: 'run-hosted', reason: `routed to ${env.TARGET || 'nothing'}` }, log);
  const queueBudgetS = Number(env.QUEUE_BUDGET_S) > 0 ? Number(env.QUEUE_BUDGET_S) : 120;
  const totalBudgetS = Number(env.TOTAL_BUDGET_S) > 0 ? Number(env.TOTAL_BUDGET_S) : 660;
  const name = env.WATCH_JOB_NAME || 'bom-check-routed';
  const t0 = deps.now();
  for (;;) {
    let job;
    try {
      const j = await deps.api(env, `/repos/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}/attempts/${env.GITHUB_RUN_ATTEMPT || 1}/jobs?per_page=100`, env.GITHUB_TOKEN);
      job = (j.jobs || []).find((x) => x.name === name);
    } catch (e) { log.log(`await: API error (${e.message}), counting toward the budget`); }
    const elapsedS = Math.round((deps.now() - t0) / 1000);
    const d = awaitDecision({ job, elapsedS, queueBudgetS, totalBudgetS });
    if (d !== 'wait') {
      const why = `${name} ${job ? `${job.status}/${job.conclusion || '-'}` : 'not listed'} after ${elapsedS}s`;
      if (d === 'fail-code') log.log(`::error::The check FAILED on the side machine (a code failure, not a runner problem); see ${name}.`);
      if (d === 'run-hosted') log.log(`::notice::RUNNER BUSY or broken (not a code failure): ${why}; running the check hosted.`);
      return emit(env, { action: d, reason: why }, log);
    }
    await deps.sleep(10000);
  }
}

export async function main(argv = [], env = process.env, log = console, deps) {
  const cmd = argv[0];
  try {
    if (cmd === '--self-test') return (await selfTest(log)) ? 0 : 1;
    if (cmd === 'route') { await runRoute(env, log, deps); return 0; }
    if (cmd === 'await') { await runAwait(env, log, deps); return 0; }
    if (cmd === 'gate') {
      let text = '';
      try { text = readFileSync(env.WEB_RUNNER_GATE_FILE || '/srv/ghrunner-web/state/gate-verdict', 'utf8'); } catch { /* no file = refused */ }
      const g = gateVerdict(text, { runId: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT, job: env.GITHUB_JOB });
      if (!g.proceed) log.log(`::notice::RUNNER BUSY (not a code failure): ${g.reason}; skipped here, the required check re-runs hosted.`);
      emit(env, { proceed: g.proceed, reason: g.reason }, log);
      return 0;
    }
    if (cmd === 'verdict') {
      const v = classifyExit(argv[1]);
      if (v === 'busy-timeout') log.log('::warning::RUNNER BUSY (not a code failure): the check hit its time budget on the side machine; the required check re-runs hosted.');
      if (v === 'runner-error') log.log(`::warning::RUNNER PROBLEM (not a code failure): the check exited ${JSON.stringify(String(argv[1] ?? ''))}; the required check re-runs hosted.`);
      emit(env, { verdict: v }, log);
      return 0;
    }
    if (cmd === 'fallback') {
      const a = fallbackAction({ target: env.TARGET, routedResult: env.ROUTED_RESULT, verdict: env.ROUTED_VERDICT });
      if (a === 'fail-code') log.log('::error::The check FAILED on the side machine (a code failure, not a runner problem); see the routed job log.');
      if (a === 'run-hosted' && env.TARGET === 'self') log.log(`::notice::Side machine did not finish (result=${env.ROUTED_RESULT || '?'}, verdict=${env.ROUTED_VERDICT || 'none'}): runner busy/offline, running hosted.`);
      emit(env, { action: a }, log);
      return 0;
    }
  } catch (e) {
    // Infrastructure error: never red. route -> hosted; others -> run hosted.
    log.log(`::warning::route-runner ${cmd}: ${e.message}; falling back to hosted`);
    if (cmd === 'route') emit(env, { target: 'hosted', runner: HOSTED, reason: `error: ${e.message}` }, log);
    if (cmd === 'fallback' || cmd === 'await') emit(env, { action: 'run-hosted' }, log);
    if (cmd === 'gate') emit(env, { proceed: false, reason: 'error' }, log);
    return 0;
  }
  log.error('usage: route-runner.mjs route|gate|verdict <code>|await|fallback|--self-test');
  return 2;
}

async function selfTest(log) {
  const T = { trusted: true, reason: 't' };
  const R = (status, busy) => [{ name: 'acer-web', status, busy, labels: [{ name: 'self-hosted' }, { name: 'acer-web' }] }];
  const pr = (o = {}) => ({ eventName: 'pull_request', headRepo: 'o/r', repo: 'o/r', author: 'kiki-claude-bot', files: ['src/a.ts'], ...o });
  const cases = [
    ['online/idle -> self', pickRunner({ label: 'acer-web', trust: T, runners: R('online', false) }).target, 'self'],
    ['online/busy -> hosted', pickRunner({ label: 'acer-web', trust: T, runners: R('online', true) }).target, 'hosted'],
    ['offline -> hosted', pickRunner({ label: 'acer-web', trust: T, runners: R('offline', false) }).target, 'hosted'],
    ['API error -> hosted', pickRunner({ label: 'acer-web', trust: T, apiError: 'HTTP 500' }).target, 'hosted'],
    ['label unset -> hosted', pickRunner({ label: '', trust: T, runners: R('online', false) }).target, 'hosted'],
    ['fork PR untrusted', trustDecision(pr({ headRepo: 'x/r' })).trusted, false],
    ['allowlisted same-repo PR trusted', trustDecision(pr()).trusted, true],
    ['.github PR untrusted', trustDecision(pr({ files: ['.github/workflows/a.yml'] })).trusted, false],
    ['scripts/lib PR untrusted', trustDecision(pr({ files: ['scripts/lib/entry-point.mjs'] })).trusted, false],
    ['exit 1 is the only code failure', classifyExit(1), 'code-failure'],
    ['exit 127 is a runner problem', classifyExit(127), 'runner-error'],
    ['await: queued past budget -> hosted', awaitDecision({ job: { status: 'queued' }, elapsedS: 121 }), 'run-hosted'],
    ['code-failure reds', fallbackAction({ target: 'self', routedResult: 'failure', verdict: 'code-failure' }), 'fail-code'],
    ['refused -> hosted', fallbackAction({ target: 'self', routedResult: 'success', verdict: '' }), 'run-hosted'],
  ];
  let failed = 0;
  for (const [n, got, want] of cases) if (got !== want) { failed++; log.error(`FAIL ${n}: expected ${want}, got ${got}`); }
  if (failed) { log.error(`FAIL self-test -- ${failed} of ${cases.length}`); return false; }
  log.log(`PASS self-test -- ${cases.length} cases`);
  return true;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
