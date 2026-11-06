#!/usr/bin/env node
// route-runner.mjs -- CI offload: decide self-hosted vs GitHub-hosted for a routed job,
// and every fallback decision after that. Owner rule (2026-11-06): a side machine that is
// off, busy or broken must NEVER turn a PR red or block a merge. Every unknown -> hosted.
// Design + residual risk: docs/handover/ci-offload-stage3.md ("Fallback design", "Trust").
//
//   node scripts/ci/route-runner.mjs route      (route job, hosted)  -> target=self|hosted runner=<label> reason=
//   node scripts/ci/route-runner.mjs gate       (routed job, step 1) -> proceed=true|false
//   node scripts/ci/route-runner.mjs verdict <exit-code>  (routed job) -> verdict=pass|busy-timeout|code-failure
//   node scripts/ci/route-runner.mjs fallback   (required hosted job) -> action=skip-pass|fail-code|run-hosted
//   node scripts/ci/route-runner.mjs watch      (hosted watchdog)    -> cancels the run if the routed job sits queued
//   node scripts/ci/route-runner.mjs --self-test
// Outputs go to stdout and $GITHUB_OUTPUT. Every subcommand exits 0 except `verdict`
// (exit 1 on a real code failure) and a failing --self-test: infrastructure never reds a PR.
import { appendFileSync, readFileSync } from 'node:fs';
import { isEntryPoint } from '../lib/entry-point.mjs';

// Item 2 (trust): who may run on the side machine. Keep SHORT; widening it is a review item.
export const TRUSTED_AUTHORS = ['kiki-claude-bot', '123constante'];
// A PR touching these always runs hosted: it could change the routing or the workflow itself.
export const PROTECTED_PREFIXES = ['.github/', 'scripts/ci/'];
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

/** Exit code of the check, run under `timeout`. 124 = timeout(1), 137 = killed after grace. */
export function classifyExit(code) {
  const c = Number(code);
  if (c === 0) return 'pass';
  if (c === 124 || c === 137) return 'busy-timeout';
  return 'code-failure';
}

/** Required hosted job: -> 'skip-pass' | 'fail-code' | 'run-hosted'. Unknown -> run-hosted. */
export function fallbackAction({ target, routedResult, verdict } = {}) {
  if (target !== 'self') return 'run-hosted';
  if (verdict === 'pass' && routedResult === 'success') return 'skip-pass';
  if (verdict === 'code-failure') return 'fail-code';
  return 'run-hosted';
}

/** Watchdog: -> 'started' | 'wait' | 'stalled'. */
export function watchDecision({ status, elapsedS, budgetS }) {
  if (status === 'in_progress' || status === 'completed') return 'started';
  return elapsedS >= budgetS ? 'stalled' : 'wait';
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

export async function runWatch(env, log, deps = { api, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), now: () => Date.now() }) {
  const budgetS = Number(env.QUEUE_BUDGET_S || 120);
  const name = env.WATCH_JOB_NAME;
  const t0 = deps.now();
  for (;;) {
    let status = 'unknown';
    try {
      const j = await deps.api(env, `/repos/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}/attempts/${env.GITHUB_RUN_ATTEMPT || 1}/jobs?per_page=100`, env.GITHUB_TOKEN);
      const job = (j.jobs || []).find((x) => x.name === name);
      if (job) status = job.status;
    } catch (e) { log.log(`watch: API error (${e.message}), counting toward the budget`); }
    const elapsedS = Math.round((deps.now() - t0) / 1000);
    const d = watchDecision({ status, elapsedS, budgetS });
    if (d === 'started') return emit(env, { watch: 'started', reason: `${name} ${status} after ${elapsedS}s` }, log);
    if (d === 'stalled') {
      log.log(`::warning::RUNNER BUSY (not a code failure): ${name} still ${status} after ${elapsedS}s; cancelling the routed attempt so the required check re-runs hosted.`);
      try { await deps.api(env, `/repos/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}/cancel`, env.GITHUB_TOKEN, { method: 'POST' }); }
      catch (e) { log.log(`::warning::watch: cancel failed (${e.message}); a maintainer must cancel run ${env.GITHUB_RUN_ID}`); }
      return emit(env, { watch: 'stalled', reason: `${name} ${status} after ${elapsedS}s` }, log);
    }
    await deps.sleep(10000);
  }
}

export async function main(argv = [], env = process.env, log = console, deps) {
  const cmd = argv[0];
  try {
    if (cmd === '--self-test') return (await selfTest(log)) ? 0 : 1;
    if (cmd === 'route') { await runRoute(env, log, deps); return 0; }
    if (cmd === 'watch') { await runWatch(env, log, deps); return 0; }
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
      emit(env, { verdict: v }, log);
      return v === 'code-failure' ? 1 : 0;
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
    if (cmd === 'fallback') emit(env, { action: 'run-hosted' }, log);
    if (cmd === 'gate') emit(env, { proceed: false, reason: 'error' }, log);
    return 0;
  }
  log.error('usage: route-runner.mjs route|gate|verdict <code>|fallback|watch|--self-test');
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
