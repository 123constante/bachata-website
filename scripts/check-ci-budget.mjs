#!/usr/bin/env node
/**
 * CI SPEND GUARD -- the held GitHub Actions artifact pool and the minutes
 * meter, as a committed contract.
 *
 * WHY THIS EXISTS. This repo guards 66 DB contracts, source integrity, bundle
 * size, SEO, OG cards and PR mergeability, and until this file existed it
 * guarded nothing about what running all of that COSTS. A never-green nightly
 * in the sibling admin repo banked 858 MB of artifacts and ~630 min/month for
 * four months in full view of every gate; the first detector to fire was an
 * email from GitHub at 90% of the storage allowance. Deleting the artifacts was
 * the fix. This is the loop that was missing.
 *
 * THE LEADING INDICATOR. GitHub bills storage by hourly accrual (GB-hours ->
 * GB-months) and its alert fires on the ACCRUED figure, which is lagging: by
 * the time it reads 90% the allowance is already spent and deleting refunds
 * nothing. The HELD POOL is the leading indicator -- it crossed 500 MB days
 * before the email and is readable at any instant from one API call. This
 * guard is thresholded on the pool. A guard on accrued percentage would have
 * fired the same day the email did, which is worth nothing.
 *
 * THE LOAD-BEARING ASSERTION. An auth failure returns an empty repo list,
 * which sums to 0 bytes, which reads as wonderfully under budget. So the guard
 * blocks by INCLUSION: ci-budgets.json names the private repos that MUST be in
 * what the token returned, and assertMeasured() turns any shortfall into a
 * non-zero exit. It is not a filter -- every private repo the token can see is
 * measured, so a new repo with a runaway workflow is caught without editing the
 * config. The named list is the floor beneath which the guard refuses to report.
 *
 * WHERE IT LIVES. bachata-website is PUBLIC and therefore never metered, so
 * this guard keeps running when a zero-dollar Actions budget pauses the private
 * repos -- i.e. at exactly the moment it matters. The same guard living in
 * bachata-admin would be switched off by the overage it exists to catch.
 *
 * IT UPLOADS NOTHING. A guard that reads the artifact pool must not join it.
 * ci-budget-guard.yml has no upload-artifact step; the P3 workflow policy lint
 * asserts that from the outside.
 *
 * MINUTES ARE AN ESTIMATE, AND THAT IS DELIBERATE. The billing REST endpoints
 * need a token permission beyond Actions:read. The per-run /timing endpoint
 * needs only Actions:read -- and on 2026-08-12 it returned
 * billable.UBUNTU.total_ms = 0 on 6 of 6 completed private runs while
 * reporting a real run_duration_ms. A guard built on it would have reported
 * zero minutes used and called that under budget. So minutes are summed from
 * JOB wall clock the way GitHub bills them: completed_at - started_at per job,
 * rounded UP to the minute with a 1-minute floor, times the runner multiplier,
 * skipped jobs excluded. The pool stays the load-bearing meter; this is the
 * second one, sized so an estimate cannot cause a false red.
 *
 * Local:  CI_BUDGET_GITHUB_TOKEN=<a token> node scripts/check-ci-budget.mjs
 *         node scripts/check-ci-budget.mjs --self-test
 * CI:     .github/workflows/ci-budget-guard.yml (schedule + workflow_dispatch).
 *         NOT pull_request -- this is account state, not a diff.
 *
 * Exit: 0 pass (or warn), 1 a budget is exceeded, 2 the guard could not measure.
 * A missing or expired token is 2. It is never 0.
 */
import { readFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertMeasured } from './lib/previewProbe.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BUDGETS_PATH = path.join(ROOT, 'ci-budgets.json');
const GH_API = 'https://api.github.com';
const MB = 1000000;
const MS_PER_MINUTE = 60000;
const MS_PER_DAY = 86400000;

/**
 * A page cap exists so a pathological response cannot spin forever. Hitting it
 * is a MEASUREMENT FAILURE, never a truncated sum: an under-count of the pool
 * reads as under budget, which is the one direction this guard must never fail
 * in. 40 pages x 100 items is ~13x the busiest repo observed volume.
 */
const PAGE_CAP = 40;
const PER_PAGE = 100;

/** The guard could not measure what it promised. Exit 2, never 0. */
export class CannotMeasure extends Error {}

const cannot = (msg) => {
  throw new CannotMeasure(msg);
};

// ---------------------------------------------------------------------------
// Config. Every block is asserted present and well-formed, because a missing
// block would make the rule it drives vacuous -- and a vacuous rule prints
// "within budget" while checking nothing, which is rule R1 of
// check-script-conventions.mjs in its purest form.
// ---------------------------------------------------------------------------

/** A warn/fail pair must be two positive numbers with warn strictly below fail;
 *  equal or inverted values make one of the two rules unreachable. */
export function assertThresholdPair(label, block, warnKey, failKey) {
  if (!block || typeof block !== 'object') {
    cannot(
      'ci-budgets.json has no config block named ' + label + ', so that rule ' +
        'would check nothing while the guard still reported a verdict. Restore ' +
        'it, or delete the rule deliberately in a PR that says why.',
    );
  }
  for (const key of [warnKey, failKey]) {
    const value = block[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      cannot(
        'ci-budgets.json ' + label + '.' + key + ' is ' + JSON.stringify(value) +
          ', which is not a positive number. A non-numeric threshold compares ' +
          'false against every measurement and would never fire.',
      );
    }
  }
  if (block[warnKey] >= block[failKey]) {
    cannot(
      'ci-budgets.json ' + label + ': ' + warnKey + ' (' + block[warnKey] + ') is ' +
        'not below ' + failKey + ' (' + block[failKey] + '). One of the two rules ' +
        'is then unreachable.',
    );
  }
  return block;
}

export function assertConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') {
    cannot('ci-budgets.json did not parse to an object.');
  }
  const repos = cfg.requiredRepos;
  if (!Array.isArray(repos) || repos.length === 0) {
    cannot(
      'ci-budgets.json declares no requiredRepos. That list is the floor this ' +
        'guard refuses to report beneath: with it empty, a token that can see ' +
        'nothing would sum to 0 bytes and read as wonderfully under budget -- ' +
        'the exact inversion this guard exists to prevent. Name the private ' +
        'repos that must be measured.',
    );
  }
  for (const name of repos) {
    if (typeof name !== 'string' || !name.includes('/')) {
      cannot(
        'ci-budgets.json requiredRepos entry ' + JSON.stringify(name) + ' is not ' +
          'an owner-slash-name string, so it can never match a repo and would ' +
          'hold the guard at exit 2 forever.',
      );
    }
  }
  assertThresholdPair('artifactPool', cfg.artifactPool, 'warnMB', 'failMB');
  assertThresholdPair('minutes', cfg.minutes, 'usedWarn', 'usedFail');
  assertThresholdPair('minutes', cfg.minutes, 'projectedWarn', 'projectedFail');
  const minDays = cfg.minutes.projectionMinDays;
  if (typeof minDays !== 'number' || !Number.isFinite(minDays) || minDays < 0) {
    cannot(
      'ci-budgets.json minutes.projectionMinDays is ' + JSON.stringify(minDays) +
        '. It gates when the projection becomes enforceable and must be a ' +
        'non-negative number.',
    );
  }
  if (minDays <= 0) {
    cannot(
      'ci-budgets.json minutes.projectionMinDays is ' + JSON.stringify(minDays) +
        '. Zero switches the enforced projection on from the first minute of the ' +
        'cycle, where a single 10-minute run projects to thousands and would ' +
        'red-light the account every month -- the exact noise the floor exists ' +
        'to keep out.',
    );
  }
  const lookback = cfg.minutes.reRunLookbackDays;
  if (typeof lookback !== 'number' || !Number.isFinite(lookback) || lookback < 0) {
    cannot(
      'ci-budgets.json minutes.reRunLookbackDays is ' + JSON.stringify(lookback) +
        '. It is how far BEFORE the cycle the run list reaches to catch re-runs ' +
        'of older runs, which GitHub bills against the current cycle but does not ' +
        'return under a created>= filter. Zero means those minutes go uncounted.',
    );
  }
  const windowDays = cfg.minutes.rateWindowDays;
  if (typeof windowDays !== 'number' || !Number.isFinite(windowDays) || windowDays <= 0) {
    cannot(
      'ci-budgets.json minutes.rateWindowDays is ' + JSON.stringify(windowDays) +
        '. It is the trailing window the enforced projection charges the rest of ' +
        'the cycle at, and a zero or missing window would divide by nothing.',
    );
  }
  if (typeof cfg.escalateWarnToFailure !== 'boolean') {
    cannot(
      'ci-budgets.json escalateWarnToFailure is ' +
        JSON.stringify(cfg.escalateWarnToFailure) + ', which is not a boolean. It ' +
        'decides whether the warning tier gets a delivery channel at all (a green ' +
        'scheduled run notifies nobody), so it is declared explicitly rather than ' +
        'defaulted silently.',
    );
  }
  const multipliers = cfg.runnerMultipliers;
  if (!multipliers || typeof multipliers !== 'object' ||
      Object.keys(multipliers).length === 0) {
    cannot(
      'ci-budgets.json declares no runnerMultipliers, so every job would be ' +
        'priced by a default nobody chose. Declare at least the runners this ' +
        'account uses.',
    );
  }
  for (const [key, value] of Object.entries(multipliers)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      cannot(
        'ci-budgets.json runnerMultipliers.' + key + ' is ' + JSON.stringify(value) +
          ', which is not a positive number.',
      );
    }
  }
  return cfg;
}

// ---------------------------------------------------------------------------
// Pure measurement rules. Every one takes its data, so the canary drives them
// from fixtures with no network and no token.
// ---------------------------------------------------------------------------

/**
 * Threshold classification. Inclusive on both bounds: a reading that lands
 * EXACTLY on the fail threshold is a fail. An exclusive comparison would let
 * the boundary value pass, which is the mutation this rule canary exists to
 * catch -- flip the >= to > and the boundary cases must go red.
 */
export function classify(value, warnAt, failAt) {
  if (value >= failAt) return 'fail';
  if (value >= warnAt) return 'warn';
  return 'ok';
}

/** The worst of a set of verdicts. */
export function worstVerdict(verdicts) {
  if (verdicts.includes('fail')) return 'fail';
  if (verdicts.includes('warn')) return 'warn';
  return 'ok';
}

/** Held bytes: non-expired artifacts only. An expired artifact no longer
 *  occupies the allowance, and counting it would red-light an account that
 *  owes nothing. */
export function livePool(artifacts, repo = null) {
  let bytes = 0;
  const rows = [];
  for (const artifact of artifacts) {
    if (artifact.expired === true) continue;
    const size = artifact.size_in_bytes;
    if (typeof size !== 'number' || !Number.isFinite(size)) {
      cannot(
        'artifact ' + JSON.stringify(artifact.id ?? artifact.name) + ' has no ' +
          'readable size_in_bytes (' + JSON.stringify(size) + '). Treating it as ' +
          'zero would under-count the pool, and an under-count reads as under ' +
          'budget.',
      );
    }
    bytes += size;
    rows.push({ repo, name: artifact.name, bytes: size, runId: artifact.workflow_run?.id ?? null });
  }
  return { bytes, rows };
}

/** The sum alone, for the rules and the canary cases that only care about it.
 *  ONE walk and ONE spelling of "held" underneath: the sum and the row list are
 *  built together, so they cannot drift into disagreeing about which artifacts
 *  count -- which would have largestHeld naming a culprit absent from the total. */
export function livePoolBytes(artifacts) {
  return livePool(artifacts).bytes;
}

/**
 * How a repo may be NAMED in output. This guard runs in a PUBLIC repo, so its
 * Actions log and step summary are world-readable -- and it deliberately
 * measures every private repo the token can see, not just the configured ones,
 * so that a new repo with a runaway workflow is caught without a config edit.
 * Those two facts together would publish the names of private repos that were
 * never committed anywhere public.
 *
 * So: a repo named in ci-budgets.json requiredRepos is printed in full (that
 * file is already public), and any other private repo is counted, measured and
 * reported by size -- but referred to positionally. The runaway is still
 * caught; the operator adds it to requiredRepos to see which one it is. Nothing
 * is hidden from the NUMBERS, only from the log.
 */
export function repoLabel(full, declared, index) {
  if (declared.includes(full)) return full;
  return 'undeclared private repo #' + (index + 1);
}

/** The single biggest held artifact, so the failure message names the culprit
 *  rather than reporting a number nobody can act on. */
export function largestHeld(rows) {
  let best = null;
  for (const row of rows) {
    if (best === null || row.bytes > best.bytes) best = row;
  }
  return best;
}

/**
 * The price multiplier for a job runner. An UNKNOWN label is a hard failure
 * naming the label, not a default of 1: an unrecognised runner silently priced
 * at the cheapest rate is the fail-open shape this guard exists to close, and
 * the error is a factor of 2 (Windows) or 10 (macOS).
 */
export function runnerMultiplier(labels, multipliers) {
  const list = Array.isArray(labels) ? labels : [];
  const exact = Object.entries(multipliers).map(([k, v]) => [k.toLowerCase(), v]);
  for (const label of list) {
    const lowered = String(label).toLowerCase();
    // An EXACT entry wins before any heuristic, so the remedy the larger-runner
    // message prescribes (declare its real multiplier) actually works.
    const declared = exact.find(([key]) => key === lowered);
    if (declared) return declared[1];
    // A LARGER runner is worse than an unknown one, because substring matching
    // RECOGNISES it: ubuntu-latest-4-cores contains "ubuntu" and would be
    // billed 1x against a real 2x (16-core is 8x), and larger runners are not
    // covered by the included minutes at all. It is the same downward
    // mispricing the unknown-label branch below exists to stop, arriving by the
    // one path that branch cannot see -- so it is named and refused separately
    // rather than being priced at its cheap base.
    if (/-(?:[0-9]+-cores?|large|xlarge)$/.test(lowered)) {
      cannot(
        'a job ran on the larger runner ' + lowered + '. GitHub prices larger ' +
          'runners above their base image (4-core 2x, 16-core 8x) and does not ' +
          'cover them with included minutes at all, so matching it to its base ' +
          'entry in ci-budgets.json runnerMultipliers would under-price it. Add ' +
          'an exact multiplier for it in the PR that introduces it.',
      );
    }
    for (const [key, value] of Object.entries(multipliers)) {
      if (lowered.includes(key.toLowerCase())) return value;
    }
  }
  cannot(
    'a job ran on runner label(s) [' + list.join(', ') + '], which match no entry ' +
      'in ci-budgets.json runnerMultipliers. Pricing it at a default would ' +
      'under-count a Windows (2x) or macOS (10x) job. Add the runner in the PR ' +
      'that introduces it.',
  );
}

/**
 * Billable minutes for one job, the way GitHub bills: wall clock from start to
 * completion, rounded UP to the whole minute with a 1-minute floor, times the
 * runner multiplier.
 *
 * Returns null for a job that has not finished -- the caller COUNTS those and
 * says so, because silently dropping in-flight work is an under-count wearing
 * a complete-looking total. A skipped job is billed nothing by GitHub and so
 * scores 0 rather than the 1-minute floor.
 */
export function jobMinutes(job, multipliers) {
  if (job.conclusion === 'skipped') return 0;
  if (job.status !== 'completed' || !job.started_at || !job.completed_at) return null;
  const started = Date.parse(job.started_at);
  const completed = Date.parse(job.completed_at);
  if (!Number.isFinite(started) || !Number.isFinite(completed)) {
    cannot(
      'job ' + JSON.stringify(job.id ?? job.name) + ' has unparseable timestamps (' +
        JSON.stringify(job.started_at) + ' -> ' + JSON.stringify(job.completed_at) +
        '). Skipping it would under-count the minutes meter.',
    );
  }
  const wallMs = completed - started;
  const billableWall = wallMs > 0 ? wallMs : 0;
  return Math.max(1, Math.ceil(billableWall / MS_PER_MINUTE)) *
    runnerMultiplier(job.labels, multipliers);
}

/**
 * Minutes over a set of jobs: the cycle total, the subset inside the trailing
 * rate window, and how many jobs were still running.
 *
 * THE WINDOW IS WHAT MAKES THE PROJECTION RESPOND. A cycle-average projection
 * keeps charging the rest of the month at a rate a fix has already stopped, so
 * the guard stays red for weeks after the cause is gone -- which is how a
 * detector gets ignored. It is also, precisely, a LAGGING indicator, the thing
 * this arc exists not to build. Measured on the day this shipped: 293 of the
 * admin repo 545 cycle minutes belonged to a nightly that had just been
 * retired, and the cycle average would have kept projecting it forward until
 * 2026-09-01.
 *
 * A windowStartMs of null means count everything, used by the pure canary cases
 * that do not exercise the window.
 */
export function summariseJobs(jobs, multipliers, windowStartMs = null, cycleStartMs = null) {
  let minutes = 0;
  let windowMinutes = 0;
  let counted = 0;
  let unfinished = 0;
  for (const job of jobs) {
    // A job bills the cycle its START falls in. This matters because the run
    // list deliberately reaches BACK before the cycle to catch re-runs: without
    // this, an old run re-run today would drag its original July attempts into
    // the August total, trading an under-count for an over-count.
    if (cycleStartMs !== null && job.started_at && Date.parse(job.started_at) < cycleStartMs) {
      continue;
    }
    const value = jobMinutes(job, multipliers);
    if (value === null) {
      unfinished += 1;
      continue;
    }
    minutes += value;
    if (windowStartMs === null || Date.parse(job.started_at) >= windowStartMs) {
      windowMinutes += value;
    }
    counted += 1;
  }
  return { minutes, windowMinutes, counted, unfinished };
}

/**
 * The billing cycle. GitHub included minutes and storage reset on the first of
 * the month, UTC. Returned as ISO for the API filter and as day counts for the
 * projection.
 */
export function cycleWindow(now) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  const daysInCycle = (end.getTime() - start.getTime()) / MS_PER_DAY;
  const daysElapsed = (now.getTime() - start.getTime()) / MS_PER_DAY;
  if (!(daysElapsed >= 0)) {
    cannot('the clock reports a time before the start of its own billing cycle.');
  }
  return { startIso: start.toISOString().slice(0, 10), daysInCycle, daysElapsed };
}

/**
 * The CYCLE-AVERAGE projection: what the month costs if the whole cycle repeats
 * its average day. Reported, never enforced -- see projectAtCurrentRate for why.
 */
export function projectMinutes(used, daysElapsed, daysInCycle) {
  if (!(daysElapsed > 0)) {
    cannot('cannot project minutes from a cycle that has not started.');
  }
  return (used / daysElapsed) * daysInCycle;
}

/**
 * The ENFORCED projection: minutes already spent, plus the remaining days
 * charged at the burn rate of the trailing window. Spent minutes are a fact and
 * are never re-estimated; only the FUTURE is projected, and it is projected from
 * what the account is doing now rather than from what it did three weeks ago.
 *
 * Enforced only once projectionMinDays have elapsed: on day one a single
 * 10-minute run projects to thousands and would red-light the account every
 * month. That window is not a hole -- the caller prints the projection as NOT
 * ENFORCED with the reason, and the actual-minutes rule gates throughout it.
 */
export function projectAtCurrentRate(used, windowMinutes, windowSpanDays, daysRemaining) {
  if (!(windowSpanDays > 0)) {
    cannot('cannot compute a burn rate over a window of no days.');
  }
  const remaining = daysRemaining > 0 ? daysRemaining : 0;
  return used + (windowMinutes / windowSpanDays) * remaining;
}

export function projectionIsEnforceable(daysElapsed, minDays) {
  return daysElapsed >= minDays;
}

// ---------------------------------------------------------------------------
// GitHub API. Thin, and every non-2xx is a throw -- there is no response shape
// this guard is willing to read as "measured nothing, all good".
// ---------------------------------------------------------------------------

/**
 * Rate limiting answers 403, and so does a permission failure. Telling the
 * reader to rotate a working PAT is the wrong instruction -- and the sweep makes
 * one call per run, so its call volume scales with the very runaway it exists
 * to detect, which makes this the LIKELIER 403 of the two.
 */
export function describeHttpFailure(pathname, status, headers) {
  // Normalised to null: undici Headers.get() answers null for a missing header,
  // but a Map answers undefined, and `retryAfter !== null` then reads every
  // header-less 403 as rate limiting -- telling the operator not to rotate a
  // token that is genuinely the problem. Caught by the canary, not by reading.
  const get = (name) =>
    (headers && typeof headers.get === 'function' ? headers.get(name) : null) ?? null;
  const remaining = get('x-ratelimit-remaining');
  const retryAfter = get('retry-after');
  const rateLimited =
    status === 429 || (status === 403 && (remaining === '0' || retryAfter !== null));
  if (rateLimited) {
    return (
      'GitHub API ' + pathname + ' -> HTTP ' + status + ', RATE LIMITED (remaining ' +
      String(remaining) + ', retry-after ' + String(retryAfter) + '). The token is ' +
      'fine -- do not rotate it. This sweep makes one call per workflow run, so its ' +
      'volume grows with the runaway it is built to detect. Re-run later, or narrow ' +
      'ci-budgets.json.'
    );
  }
  if (status === 401 || status === 403 || status === 404) {
    return (
      'GitHub API ' + pathname + ' -> HTTP ' + status + '. The token is missing, ' +
      'expired, or lacks Actions:read on that repository. This is exit 2, not a ' +
      'green report over the repos it could see.'
    );
  }
  return 'GitHub API ' + pathname + ' -> HTTP ' + status + '.';
}

/**
 * A page count is not proof of completeness. GitHub caps /actions/runs at 1000
 * results when a filter is applied and serves the cap as an ordinary short page,
 * which paginate would read as the natural end of the list -- every run past the
 * cap then contributes 0 minutes, silently, in exactly the runaway case this
 * guard exists to catch. The bodies carry total_count; this compares against it,
 * the way check-pr-mergeable.mjs does for the same reason.
 */
export function assertPaginationComplete(pathname, seen, total) {
  if (typeof total !== 'number' || !Number.isFinite(total)) return seen;
  if (seen < total) {
    cannot(
      'GitHub API ' + pathname + ' reports ' + total + ' item(s) but served only ' +
        seen + '. Either the endpoint capped the result set (it caps /actions/runs ' +
        'at 1000 when filtered) or the list changed under the sweep. Reporting the ' +
        'short list would under-count, and an under-count reads as under budget.',
    );
  }
  return seen;
}

export function makeGitHubApi({
  token,
  fetchImpl = fetch,
  timeoutMs = 15000,
  // The WHOLE sweep, not one call. Per-request bounds cannot keep it inside the
  // job: ~170 sequential calls at 15s each is 42 minutes, so a merely SLOW (not
  // stalled) API walks past timeout-minutes and the runner kills the job with a
  // bare "The operation was canceled" naming no endpoint and no repo -- which is
  // indistinguishable from a dead token. This fails first, and names where it was.
  sweepBudgetMs = 8 * 60 * 1000,
  now = () => Date.now(),
}) {
  const deadline = now() + sweepBudgetMs;

  /** `display` is what the reader is allowed to SEE. It is not the request path:
   *  this guard runs in a public repo, and a raw path carries the private repo's
   *  real owner/name straight into a world-readable log -- which is what
   *  repoLabel() exists to prevent everywhere else. */
  async function ghJson(pathname, display) {
    if (now() > deadline) {
      cannot(
        'the sweep exhausted its ' + Math.round(sweepBudgetMs / 1000) + 's budget at ' +
          display + '. That is a named failure instead of an unnamed job ' +
          'cancellation. Re-run, or narrow ci-budgets.json requiredRepos.',
      );
    }
    // Bounded per request too. undici defaults to a 300s headers timeout, so one
    // stalled connection would otherwise eat the whole sweep budget on its own.
    // Same lesson as CI check #65.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(GH_API + pathname, {
        headers: {
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
          authorization: 'Bearer ' + token,
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        cannot(describeHttpFailure(display, res.status, res.headers));
      }
      // Inside the try, and BEFORE the timer is cleared. fetch resolves when the
      // HEADERS arrive -- the body is still streaming. Clearing the timer first
      // left res.json() completely unbounded, so an edge that sent headers and
      // then stalled the body would hang forever with no armed abort: exactly
      // the failure the bound was added to prevent.
      return await res.json();
    } catch (error) {
      if (error instanceof CannotMeasure) throw error;
      cannot(
        'GitHub API ' + display + ' could not be reached: ' + error.message +
          (error.name === 'AbortError' ? ' (timed out after ' + timeoutMs + 'ms)' : ''),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /** Every page, or a failure. Never a partial list. */
  async function paginate(pathname, display, pick) {
    const items = [];
    let total = null;
    for (let page = 1; page <= PAGE_CAP; page++) {
      const sep = pathname.includes('?') ? '&' : '?';
      const body = await ghJson(
        pathname + sep + 'per_page=' + PER_PAGE + '&page=' + page,
        display,
      );
      const batch = pick(body);
      if (!Array.isArray(batch)) {
        cannot('GitHub API ' + display + ' returned no array where one was expected.');
      }
      if (typeof body?.total_count === 'number') total = body.total_count;
      items.push(...batch);
      if (batch.length < PER_PAGE) {
        assertPaginationComplete(display, items.length, total);
        return items;
      }
    }
    cannot(
      'GitHub API ' + display + ' still had pages after ' + PAGE_CAP + ' of them. ' +
        'Stopping here would under-count, and an under-count reads as under ' +
        'budget. Raise PAGE_CAP deliberately.',
    );
  }

  // Each method takes the repo's DISPLAY LABEL beside its real name, so every
  // error message this layer can emit is already redacted for an undeclared
  // private repo. Defaulting the label to the real name would have made the
  // redaction opt-in, and an opt-in redaction is the one that gets forgotten.
  return {
    listRepos: () => paginate('/user/repos?affiliation=owner', '/user/repos', (b) => b),
    listArtifacts: (full, label) =>
      paginate(
        '/repos/' + full + '/actions/artifacts',
        '/repos/' + label + '/actions/artifacts',
        (b) => b.artifacts,
      ),
    listRuns: (full, label, sinceIso) =>
      paginate(
        '/repos/' + full + '/actions/runs?created=' + encodeURIComponent('>=' + sinceIso),
        '/repos/' + label + '/actions/runs',
        (b) => b.workflow_runs,
      ),
    // filter=all, NOT the default. The default (latest) returns only the most
    // recent attempt of each run, while GitHub bills EVERY attempt -- so a flaky
    // workflow re-run five times would be metered once. Re-running failed jobs
    // is one of the commonest ways a repo quietly burns its included minutes.
    listJobs: (full, label, runId) =>
      paginate(
        '/repos/' + full + '/actions/runs/' + runId + '/jobs?filter=all',
        '/repos/' + label + '/actions/runs/' + runId + '/jobs',
        (b) => b.jobs,
      ),
  };
}

/** Bounded concurrency. The jobs endpoint is one call per run and the busiest
 *  repo has ~80 runs a cycle; serial, that is minutes of wall clock for nothing. */
export async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const lanes = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(lanes);
  return results;
}

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

const fmtMB = (bytes) => (bytes / MB).toFixed(1) + ' MB';

/**
 * Measure the account and return a verdict. The api is injected so the canary
 * can drive every branch -- including the ones that matter most, which are the
 * failures: an empty repo list, a 401, a repo the token cannot see.
 */
export async function runCheck({ cfg, api, now, log = console.log }) {
  assertConfig(cfg);
  const lines = [];
  const say = (text) => {
    lines.push(text);
    log(text);
  };

  const cycle = cycleWindow(now);
  say(
    'CI spend guard -- cycle from ' + cycle.startIso + ', day ' +
      cycle.daysElapsed.toFixed(2) + ' of ' + cycle.daysInCycle,
  );

  const allRepos = await api.listRepos();
  // Only PRIVATE repos are metered. A public repo minutes and storage are free,
  // so counting them would invent spend that does not exist.
  const metered = allRepos
    .filter((repo) => repo.private === true)
    .map((repo) => repo.full_name)
    .sort();
  if (metered.length !== new Set(metered).size) {
    cannot(
      'the repo list contains duplicate full_names, so the positional labels ' +
        'below would name two different repos the same way and the pool would ' +
        'double-count one of them.',
    );
  }
  const missing = cfg.requiredRepos.filter((name) => !metered.includes(name));

  // THE LOAD-BEARING ASSERTION. Everything above can succeed while measuring
  // nothing: an expired token, a PAT whose repository access was narrowed, a
  // renamed repo. Each returns a SHORTER list, sums to fewer bytes, and reads
  // as an improvement. This turns every one of them into a non-zero exit before
  // a single byte is reported.
  assertMeasured(
    cfg.requiredRepos.length - missing.length,
    cfg.requiredRepos.length,
    'declared private repos' +
      (missing.length
        ? ' -- the token did not return: ' + missing.join(', ') +
          '. Check that CI_BUDGET_GITHUB_TOKEN is live and still holds ' +
          'Actions:read plus repository access to each of them'
        : ''),
  );

  const labelled = metered.map((full, index) => repoLabel(full, cfg.requiredRepos, index));
  const undeclared = metered.filter((full) => !cfg.requiredRepos.includes(full)).length;
  say('measured ' + metered.length + ' metered (private) repo(s): ' + labelled.join(', '));
  if (undeclared > 0) {
    say(
      '  ' + undeclared + ' of them are not named in ci-budgets.json requiredRepos ' +
        'and are referred to positionally -- this log is public. They are fully ' +
        'measured; add one to requiredRepos to see it named.',
    );
  }

  const poolRows = [];
  let poolBytes = 0;
  let minutesUsed = 0;
  let windowMinutes = 0;
  let jobsCounted = 0;
  let jobsUnfinished = 0;
  const perRepo = [];

  // The trailing rate window, clipped to the cycle: early in a cycle there is
  // less than a full window of data, and dividing a partial window by its full
  // nominal length would report a burn rate lower than the real one.
  const windowSpanDays = Math.min(cfg.minutes.rateWindowDays, cycle.daysElapsed);
  const windowStartMs = now.getTime() - windowSpanDays * MS_PER_DAY;
  const cycleStartMs = Date.parse(cycle.startIso + 'T00:00:00Z');
  const lookbackIso = new Date(cycleStartMs - cfg.minutes.reRunLookbackDays * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);

  for (const [index, full] of metered.entries()) {
    const label = repoLabel(full, cfg.requiredRepos, index);
    const named = label === full;
    const artifacts = await api.listArtifacts(full, label);
    // ONE walk: the sum and the rows are built together, so they cannot drift
    // into disagreeing about which artifacts are held.
    const pool = livePool(artifacts, label);
    const bytes = pool.bytes;
    poolBytes += bytes;
    // An artifact name commonly encodes a branch or feature name, so it is
    // withheld for a repo this public log may not name either.
    poolRows.push(
      ...pool.rows.map((row) => ({ ...row, name: named ? row.name : '(name withheld)' })),
    );

    // Listed from BEFORE the cycle, then filtered by job start. GitHub's
    // `created` filter reads created_at, which does NOT move when a run is
    // re-run -- so a run created in July and re-run five times in August burns
    // August minutes while being absent from created>=1-Aug entirely. That is
    // an under-count, and an under-count reads as under budget. The lookback
    // widens the LIST; updated_at prunes it back to runs actually touched this
    // cycle (so the extra listing costs pages, not job calls); and summariseJobs
    // counts a job only if it STARTED inside the cycle, which is the timestamp
    // GitHub bills against.
    const runs = await api.listRuns(full, label, lookbackIso);
    const touched = runs.filter(
      (run) => !run.updated_at || Date.parse(run.updated_at) >= cycleStartMs,
    );
    const jobLists = await mapWithConcurrency(touched, 6, (run) =>
      api.listJobs(full, label, run.id),
    );
    const summary = summariseJobs(
      jobLists.flat(),
      cfg.runnerMultipliers,
      windowStartMs,
      cycleStartMs,
    );
    minutesUsed += summary.minutes;
    windowMinutes += summary.windowMinutes;
    jobsCounted += summary.counted;
    jobsUnfinished += summary.unfinished;

    perRepo.push({ label, bytes, runs: runs.length, minutes: summary.minutes });
    say(
      '  ' + label + ': ' + fmtMB(bytes) + ' held across ' + pool.rows.length +
        ' live artifact(s), ' + summary.minutes + ' est. min over ' + runs.length +
        ' run(s)',
    );
  }

  // --- Rule 1: the held artifact pool (the leading indicator) ---
  const poolMB = poolBytes / MB;
  const poolVerdict = classify(poolMB, cfg.artifactPool.warnMB, cfg.artifactPool.failMB);
  const biggest = largestHeld(poolRows);
  say(
    '[' + poolVerdict.toUpperCase() + '] held artifact pool: ' + fmtMB(poolBytes) +
      ' (warn ' + cfg.artifactPool.warnMB + ', fail ' + cfg.artifactPool.failMB +
      ', included ' + (cfg.artifactPool.includedMB ?? 'n/a') + ')',
  );
  if (biggest) {
    say(
      '  largest single artifact: ' + fmtMB(biggest.bytes) + ' -- ' + biggest.name +
        ' in ' + biggest.repo + ' (run ' + (biggest.runId ?? 'unknown') + ')',
    );
  }

  // --- Rule 2: minutes used this cycle ---
  const usedVerdict = classify(minutesUsed, cfg.minutes.usedWarn, cfg.minutes.usedFail);
  say(
    '[' + usedVerdict.toUpperCase() + '] minutes used this cycle: ~' + minutesUsed +
      ' est. (warn ' + cfg.minutes.usedWarn + ', fail ' + cfg.minutes.usedFail +
      ', included ' + cfg.minutes.includedPerCycle + ') over ' + jobsCounted + ' job(s)',
  );
  if (jobsUnfinished > 0) {
    say(
      '  ' + jobsUnfinished + ' job(s) still running are NOT counted -- this total ' +
        'is that much low.',
    );
  }

  // --- Rule 3: the projection, charged at the CURRENT burn rate ---
  //
  // A cycle can be exactly zero days old -- 00:00:00.000 UTC on the 1st, or a
  // workflow_dispatch moments after it. There is then no span to divide by, and
  // BOTH projections are undefined. That is not a measurement failure: the pool
  // and the minutes-used rules measured fine, and exiting 2 over the calendar
  // would red-light a perfectly healthy account. So the projection reports as
  // unavailable and the other two rules stand.
  const daysRemaining = cycle.daysInCycle - cycle.daysElapsed;
  const started = cycle.daysElapsed > 0 && windowSpanDays > 0;
  const ratePerDay = started ? windowMinutes / windowSpanDays : 0;
  const projected = started
    ? projectAtCurrentRate(minutesUsed, windowMinutes, windowSpanDays, daysRemaining)
    : minutesUsed;
  // Reported beside it, never enforced: when the two disagree sharply, the gap
  // IS the signal (a burn that started, or one that stopped).
  const cycleAverage = started
    ? projectMinutes(minutesUsed, cycle.daysElapsed, cycle.daysInCycle)
    : minutesUsed;
  const projectable =
    started && projectionIsEnforceable(cycle.daysElapsed, cfg.minutes.projectionMinDays);
  const projectedVerdict = projectable
    ? classify(projected, cfg.minutes.projectedWarn, cfg.minutes.projectedFail)
    : 'ok';
  const rateLine = started
    ? ' -- ' + minutesUsed + ' spent plus ' + daysRemaining.toFixed(1) + ' day(s) at ' +
      ratePerDay.toFixed(1) + ' min/day (the last ' + windowSpanDays.toFixed(1) +
      ' day(s), ' + windowMinutes + ' min). Cycle average would say ~' +
      Math.round(cycleAverage) + '.'
    : ' -- the cycle is zero days old, so there is no burn rate to project from.';
  if (projectable) {
    say(
      '[' + projectedVerdict.toUpperCase() + '] projected to cycle end: ~' +
        Math.round(projected) + ' est. min (warn ' + cfg.minutes.projectedWarn +
        ', fail ' + cfg.minutes.projectedFail + ')' + rateLine,
    );
  } else {
    say(
      '[NOT ENFORCED] projection unavailable -- only ' + cycle.daysElapsed.toFixed(2) +
        ' day(s) of the cycle have elapsed, below the ' +
        cfg.minutes.projectionMinDays + '-day floor in ci-budgets.json. A ' +
        'projection from a fraction of a day is noise, so no number is quoted. ' +
        'The minutes-used rule above is gating throughout this window.' + rateLine,
    );
  }

  const worst = worstVerdict([poolVerdict, usedVerdict, projectedVerdict]);
  // A WARN THAT EXITS 0 IS DELIVERED NOWHERE, and this guard's whole premise is
  // that nobody knew. GitHub emails on a FAILED scheduled run only: a green
  // nightly produces no notification and no board change, so the 250 MB tier --
  // the leading indicator the arc was built around -- would fire into exactly
  // the silence the incident already proved nobody watches, and the first thing
  // to reach a human would be the 400 MB fail. escalateWarnToFailure turns the
  // warning tier into a non-zero exit so it has a delivery channel. The two
  // tiers still read differently in the report; what they no longer differ in is
  // whether anyone finds out.
  const escalate = cfg.escalateWarnToFailure === true;
  return {
    code: worst === 'fail' || (escalate && worst === 'warn') ? 1 : 0,
    escalated: escalate && worst === 'warn',
    worst,
    poolBytes,
    poolMB,
    minutesUsed,
    windowMinutes,
    ratePerDay,
    cycleAverage,
    projected,
    projectable,
    verdicts: { pool: poolVerdict, used: usedVerdict, projected: projectedVerdict },
    metered,
    perRepo,
    biggest,
    lines,
  };
}

/** The human-facing verdict, printed after the measurements. */
export function verdictReport(result, cfg) {
  const out = [];
  // The projection is quoted ONLY when the guard was willing to enforce it.
  // Printing the number after refusing to gate on it presents day-one noise --
  // which the measurement line has just called noise -- as an actionable figure.
  const projectedPhrase = result.projectable
    ? 'projected ~' + Math.round(result.projected)
    : 'projection not yet enforceable this early in the cycle';
  if (result.verdicts.pool === 'fail') {
    out.push(
      'CI BUDGET EXCEEDED -- held artifact pool is ' + result.poolMB.toFixed(1) +
        ' MB against a ' + cfg.artifactPool.failMB + ' MB ceiling.' +
        (result.biggest
          ? ' The biggest single holder is ' + result.biggest.name + ' in ' +
            result.biggest.repo + ' at ' + fmtMB(result.biggest.bytes) + '.'
          : '') +
        ' Delete the artifacts, then fix the workflow that keeps producing them: ' +
        'check retention-days, and whether an if-failure upload is bounded by a ' +
        'job that ever actually succeeds.',
    );
  } else if (result.verdicts.pool === 'warn') {
    out.push(
      '::warning title=CI artifact pool::Held artifact pool is ' +
        result.poolMB.toFixed(1) + ' MB, past the ' + cfg.artifactPool.warnMB +
        ' MB warning line. This is the LEADING indicator -- the accrued ' +
        'percentage GitHub emails about does not move until the allowance is ' +
        'already spent.',
    );
  }
  if (result.verdicts.used === 'fail' || result.verdicts.projected === 'fail') {
    out.push(
      'CI BUDGET EXCEEDED -- minutes. ~' + result.minutesUsed + ' used this cycle, ' +
        projectedPhrase + ', against ' +
        cfg.minutes.includedPerCycle + ' included. These are ESTIMATES from job ' +
        'wall clock (see ci-budgets.json); check the billing page before paying ' +
        'anything, but treat the trend as real.',
    );
  } else if (result.verdicts.used === 'warn' || result.verdicts.projected === 'warn') {
    out.push(
      '::warning title=CI minutes::~' + result.minutesUsed + ' minutes used this ' +
        'cycle, ' + projectedPhrase + ', of ' +
        cfg.minutes.includedPerCycle + ' included.',
    );
  }
  if (out.length === 0) {
    out.push(
      'CI spend within budget: ' + result.poolMB.toFixed(1) + ' MB held, ~' +
        result.minutesUsed + ' est. minutes used across ' + result.metered.length +
        ' metered repo(s).',
    );
  }
  if (result.escalated) {
    out.push(
      'This is the WARNING tier, and it is failing the job deliberately ' +
        '(ci-budgets.json escalateWarnToFailure). A green scheduled run notifies ' +
        'nobody, and a warning nobody sees is how the incident that produced this ' +
        'guard went unnoticed for four months. Nothing is over the hard ceiling ' +
        'yet -- act, or lower the warning line in a PR that says why.',
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Canary (rule R4 of check-script-conventions.mjs -- a guard with no proof it
// can fail is not a guard). Every rule is proven in BOTH directions from
// fixtures: no network, no token, no config file.
//
// The cases classify WHICH failure happened, not merely that one did. Asserting
// "it threw" is how a mutant survives: delete the assertMeasured call and an
// empty repo list still throws somewhere downstream, so a coarse test stays
// green while the load-bearing assertion is gone.
// ---------------------------------------------------------------------------

export function makeFixtureApi(spec) {
  return {
    listRepos: async () => {
      if (spec.reposThrows) cannot(spec.reposThrows);
      return spec.repos ?? [];
    },
    listArtifacts: async (full) => {
      if (spec.artifactsThrows) cannot(spec.artifactsThrows);
      return (spec.artifacts ?? {})[full] ?? [];
    },
    listRuns: async (full) => (spec.runs ?? {})[full] ?? [],
    listJobs: async (full, label, runId) => (spec.jobs ?? {})[full + '#' + runId] ?? [],
  };
}

const FIXTURE_CFG = {
  requiredRepos: ['acme/private-one'],
  // FALSE here so the tier semantics are visible in the base cases (a warn is a
  // warn). The SHIPPED value is true, and both directions are proven by the
  // three escalation cases plus the shipped-config case that reads the real
  // ci-budgets.json.
  escalateWarnToFailure: false,
  artifactPool: { includedMB: 500, warnMB: 250, failMB: 400 },
  minutes: {
    includedPerCycle: 2000,
    usedWarn: 1400,
    usedFail: 1700,
    projectedWarn: 1400,
    projectedFail: 1700,
    projectionMinDays: 5,
    rateWindowDays: 7,
    reRunLookbackDays: 45,
  },
  runnerMultipliers: { ubuntu: 1, windows: 2, macos: 10 },
};

const FIXTURE_REPOS = [
  { full_name: 'acme/private-one', private: true },
  { full_name: 'acme/public-one', private: false },
];

/** Held artifacts totalling roughly the given MB, in one row. */
const artifactsOf = (mb) => [
  {
    id: 1,
    name: 'playwright-report',
    size_in_bytes: Math.round(mb * MB),
    expired: false,
    workflow_run: { id: 99 },
  },
];

/** One completed ubuntu job of the given length, STARTING on a chosen date --
 *  the fixture the trailing-window rule turns on. ONE builder, so a field added
 *  for a new rule cannot reach half the cases and leave the other half testing a
 *  job shape the API never returns. */
const jobsAt = (startIso, minutes) => ({
  'acme/private-one#1': [
    {
      id: 7,
      name: 'build',
      status: 'completed',
      conclusion: 'success',
      labels: ['ubuntu-latest'],
      started_at: startIso,
      completed_at: new Date(Date.parse(startIso) + minutes * MS_PER_MINUTE).toISOString(),
    },
  ],
});

/** The same job at the start of the fixture cycle. */
const jobsOf = (minutes) => jobsAt('2026-08-01T00:00:00Z', minutes);

const completedJob = (labels, startIso, endIso) => ({
  id: 7,
  status: 'completed',
  conclusion: 'success',
  labels,
  started_at: startIso,
  completed_at: endIso,
});

function selfTest() {
  const cases = [];
  const add = (name, run, expected) => cases.push({ name, run, expected });

  // ONE classifier, by message needle. A weaker did-it-throw helper beside this
  // is exactly the assertion that lets a deleted assertMeasured survive.
  const KINDS = [
    ['previewProbe: measured', 'measured-shortfall'],
    ['declares no requiredRepos', 'no-required-repos'],
    ['owner-slash-name string', 'bad-repo-name'],
    ['is not below', 'inverted-thresholds'],
    ['not a positive number', 'bad-threshold'],
    ['no config block named', 'missing-block'],
    ['declares no runnerMultipliers', 'no-multipliers'],
    ['match no entry in', 'unknown-runner'],
    ['no readable size_in_bytes', 'unreadable-artifact'],
    ['unparseable timestamps', 'bad-job-times'],
    ['HTTP 401', 'auth-failed'],
    ['still had pages after', 'pagination-cap'],
    ['projectionMinDays', 'bad-projection-floor'],
    ['rateWindowDays', 'bad-rate-window'],
    ['reRunLookbackDays', 'bad-lookback'],
    ['escalateWarnToFailure', 'bad-escalation-flag'],
    ['served only', 'incomplete-pagination'],
    ['larger runner', 'larger-runner'],
    ['duplicate full_names', 'duplicate-repos'],
  ];
  const classifyFailure = (error) => {
    for (const [needle, kind] of KINDS) {
      if (String(error.message).includes(needle)) return kind;
    }
    return 'unclassified: ' + String(error.message).slice(0, 90);
  };

  /** Run the whole check over fixtures and reduce it to one word. */
  const outcome = async (spec, cfg = FIXTURE_CFG, nowIso = '2026-08-20T00:00:00Z') => {
    try {
      const result = await runCheck({
        cfg,
        api: makeFixtureApi(spec),
        now: new Date(nowIso),
        log: () => {},
      });
      return result.code === 1 ? 'exceeded' : result.worst;
    } catch (error) {
      return classifyFailure(error);
    }
  };

  const base = { repos: FIXTURE_REPOS, runs: { 'acme/private-one': [{ id: 1 }] } };

  // --- The pool rule, both directions ---
  add(
    'pool: a small pool passes',
    () => outcome({ ...base, artifacts: { 'acme/private-one': artifactsOf(120) }, jobs: jobsOf(5) }),
    'ok',
  );
  add(
    'pool: past the warning line warns, and still exits 0',
    () => outcome({ ...base, artifacts: { 'acme/private-one': artifactsOf(300) }, jobs: jobsOf(5) }),
    'warn',
  );
  add(
    'pool: past the fail line exceeds the budget',
    () => outcome({ ...base, artifacts: { 'acme/private-one': artifactsOf(450) }, jobs: jobsOf(5) }),
    'exceeded',
  );
  add(
    'pool: the incident steady state (861 MB) would have failed',
    () => outcome({ ...base, artifacts: { 'acme/private-one': artifactsOf(861.2) }, jobs: jobsOf(5) }),
    'exceeded',
  );
  // The boundary is what a >= to > mutation moves, and nothing else in this
  // file would notice.
  add('classify: exactly the fail threshold fails', () => classify(400, 250, 400), 'fail');
  add('classify: exactly the warn threshold warns', () => classify(250, 250, 400), 'warn');
  add('classify: a hair under the warn threshold is ok', () => classify(249.99, 250, 400), 'ok');
  add(
    'pool: expired artifacts do not count toward the held pool',
    () =>
      livePoolBytes([
        { id: 1, size_in_bytes: 900 * MB, expired: true },
        { id: 2, size_in_bytes: 10, expired: false },
      ]),
    10,
  );

  // --- THE LOAD-BEARING ASSERTION, both directions ---
  add(
    'auth: an EMPTY repo list is exit 2, never a green 0-byte report',
    () => outcome({ repos: [] }),
    'measured-shortfall',
  );
  add(
    'auth: a token that returns only PUBLIC repos is exit 2',
    () => outcome({ repos: [{ full_name: 'acme/public-one', private: false }] }),
    'measured-shortfall',
  );
  add(
    'auth: one required repo missing is exit 2 even when another is present',
    () =>
      outcome(
        { repos: [{ full_name: 'acme/other-private', private: true }] },
        { ...FIXTURE_CFG, requiredRepos: ['acme/private-one', 'acme/other-private'] },
      ),
    'measured-shortfall',
  );
  add(
    'auth: an expired token (HTTP 401 on the repo list) is exit 2',
    () => outcome({ reposThrows: 'GitHub API /user/repos -> HTTP 401. Token missing.' }),
    'auth-failed',
  );
  add(
    'auth: a 401 on the ARTIFACTS call is exit 2, not a pool of 0',
    () =>
      outcome({
        ...base,
        artifactsThrows: 'GitHub API /repos/x/actions/artifacts -> HTTP 401. Token missing.',
      }),
    'auth-failed',
  );
  add(
    'auth: the required repo present and measured passes',
    () => outcome({ ...base, artifacts: { 'acme/private-one': artifactsOf(1) }, jobs: jobsOf(5) }),
    'ok',
  );

  // --- Minutes, both directions ---
  add(
    'minutes: a heavy cycle exceeds the used ceiling',
    () => outcome({ ...base, artifacts: {}, jobs: jobsOf(1800) }),
    'exceeded',
  );
  add(
    'minutes: a light cycle passes',
    () => outcome({ ...base, artifacts: {}, jobs: jobsOf(30) }),
    'ok',
  );
  add(
    'minutes: a job is rounded UP to the whole minute',
    () =>
      jobMinutes(
        completedJob(['ubuntu-latest'], '2026-08-01T00:00:00Z', '2026-08-01T00:01:01Z'),
        FIXTURE_CFG.runnerMultipliers,
      ),
    2,
  );
  // Found by MUTATION, not by reading: removing the 1-minute floor left every
  // other minutes case green, because Math.ceil already returns 1 for any job
  // that ran for even a second. The floor is load-bearing for exactly one shape
  // -- a job that starts and finishes inside the same second, which is what an
  // instantly-failing job looks like -- and nothing asserted it.
  add(
    'minutes: a zero-duration job still bills the one-minute floor',
    () =>
      jobMinutes(
        completedJob(['ubuntu-latest'], '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
        FIXTURE_CFG.runnerMultipliers,
      ),
    1,
  );
  add(
    'minutes: a sub-minute job still bills one minute',
    () =>
      jobMinutes(
        completedJob(['ubuntu-latest'], '2026-08-01T00:00:00Z', '2026-08-01T00:00:04Z'),
        FIXTURE_CFG.runnerMultipliers,
      ),
    1,
  );
  add(
    'minutes: a skipped job bills nothing',
    () =>
      jobMinutes(
        { ...completedJob(['ubuntu-latest'], '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
          conclusion: 'skipped' },
        FIXTURE_CFG.runnerMultipliers,
      ),
    0,
  );
  add(
    'minutes: a windows job costs double',
    () =>
      jobMinutes(
        completedJob(['windows-latest'], '2026-08-01T00:00:00Z', '2026-08-01T00:10:00Z'),
        FIXTURE_CFG.runnerMultipliers,
      ),
    20,
  );
  add(
    'minutes: an UNKNOWN runner label is exit 2, not the cheapest price',
    () =>
      outcome({
        ...base,
        artifacts: {},
        jobs: {
          'acme/private-one#1': [
            completedJob(['self-hosted-gpu'], '2026-08-01T00:00:00Z', '2026-08-01T00:10:00Z'),
          ],
        },
      }),
    'unknown-runner',
  );
  add(
    'minutes: an in-flight job is excluded from the total rather than guessed at',
    () =>
      summariseJobs(
        [
          { status: 'in_progress', labels: ['ubuntu-latest'], started_at: '2026-08-01T00:00:00Z', completed_at: null },
          completedJob(['ubuntu-latest'], '2026-08-01T00:00:00Z', '2026-08-01T00:03:00Z'),
        ],
        FIXTURE_CFG.runnerMultipliers,
      ).unfinished,
    1,
  );

  // --- The projection window ---
  add('projection: enforceable once the floor has passed', () => projectionIsEnforceable(6, 5), true);
  add('projection: not enforceable on day one', () => projectionIsEnforceable(0.4, 5), false);
  add(
    'projection: a day-one burst does NOT red-light the account',
    () => outcome({ ...base, artifacts: {}, jobs: jobsOf(60) }, FIXTURE_CFG, '2026-08-01T06:00:00Z'),
    'ok',
  );
  add(
    'projection: the same burn rate DOES fail once the cycle is old enough',
    () => outcome({ ...base, artifacts: {}, jobs: jobsOf(400) }, FIXTURE_CFG, '2026-08-06T00:00:00Z'),
    'exceeded',
  );
  add('projection: cycle-average arithmetic', () => Math.round(projectMinutes(300, 10, 31)), 930);
  add(
    'projection: current-rate arithmetic -- spent is a fact, only the future is projected',
    () => projectAtCurrentRate(300, 70, 7, 20),
    500,
  );
  add(
    'projection: a burn that STOPPED does not keep projecting forward',
    () =>
      outcome(
        { ...base, artifacts: {}, jobs: jobsAt('2026-08-01T00:00:00Z', 900) },
        FIXTURE_CFG,
        '2026-08-20T00:00:00Z',
      ),
    'ok',
  );
  // The same fixture under the cycle-average rule the guard deliberately does
  // NOT enforce: 900 over 19 days projects to 1468, past the 1400 warn line. If
  // this ever equals the case above, the window has stopped doing anything.
  add(
    'projection: and the cycle average would have called that same account WARN',
    () => classify(projectMinutes(900, 19, 31), 1400, 1700),
    'warn',
  );
  add(
    'projection: a burn that just STARTED is caught inside the window',
    () =>
      outcome(
        { ...base, artifacts: {}, jobs: jobsAt('2026-08-18T00:00:00Z', 700) },
        FIXTURE_CFG,
        '2026-08-20T00:00:00Z',
      ),
    'exceeded',
  );
  add(
    'projection: a rate window shorter than the elapsed cycle is used whole',
    () =>
      Math.round(
        projectAtCurrentRate(500, 140, 7, 10),
      ),
    700,
  );
  add(
    'config: a zero rateWindowDays is exit 2 (it would divide by nothing)',
    () =>
      outcome(base, { ...FIXTURE_CFG, minutes: { ...FIXTURE_CFG.minutes, rateWindowDays: 0 } }),
    'bad-rate-window',
  );

  // --- Config vacuity, every block ---
  add(
    'config: an EMPTY requiredRepos list is exit 2, not a vacuous pass',
    () => outcome(base, { ...FIXTURE_CFG, requiredRepos: [] }),
    'no-required-repos',
  );
  add(
    'config: a repo name with no slash is exit 2',
    () => outcome(base, { ...FIXTURE_CFG, requiredRepos: ['private-one'] }),
    'bad-repo-name',
  );
  add(
    'config: a missing artifactPool block is exit 2',
    () => outcome(base, { ...FIXTURE_CFG, artifactPool: undefined }),
    'missing-block',
  );
  add(
    'config: warn above fail is exit 2 (one rule would be unreachable)',
    () => outcome(base, { ...FIXTURE_CFG, artifactPool: { warnMB: 400, failMB: 250 } }),
    'inverted-thresholds',
  );
  add(
    'config: a non-numeric threshold is exit 2',
    () => outcome(base, { ...FIXTURE_CFG, artifactPool: { warnMB: 'lots', failMB: 400 } }),
    'bad-threshold',
  );
  add(
    'config: no runnerMultipliers is exit 2',
    () => outcome(base, { ...FIXTURE_CFG, runnerMultipliers: {} }),
    'no-multipliers',
  );
  add(
    'config: a negative projection floor is exit 2',
    () =>
      outcome(base, {
        ...FIXTURE_CFG,
        minutes: { ...FIXTURE_CFG.minutes, projectionMinDays: -1 },
      }),
    'bad-projection-floor',
  );

  // --- The warn tier has to reach a human ---
  add(
    'escalation: a warn exits NON-ZERO when escalateWarnToFailure is on',
    () =>
      outcome(
        { ...base, artifacts: { 'acme/private-one': artifactsOf(300) }, jobs: jobsOf(5) },
        { ...FIXTURE_CFG, escalateWarnToFailure: true },
      ),
    'exceeded',
  );
  add(
    'escalation: and exits 0 when it is off, which is the tier as designed',
    () =>
      outcome(
        { ...base, artifacts: { 'acme/private-one': artifactsOf(300) }, jobs: jobsOf(5) },
        { ...FIXTURE_CFG, escalateWarnToFailure: false },
      ),
    'warn',
  );
  add(
    'escalation: a clean account is unaffected by the escalation flag',
    () =>
      outcome(
        { ...base, artifacts: { 'acme/private-one': artifactsOf(1) }, jobs: jobsOf(5) },
        { ...FIXTURE_CFG, escalateWarnToFailure: true },
      ),
    'ok',
  );
  add(
    'config: a non-boolean escalateWarnToFailure is exit 2, not a silent default',
    () => outcome(base, { ...FIXTURE_CFG, escalateWarnToFailure: 'yes' }),
    'bad-escalation-flag',
  );

  // --- A larger runner is RECOGNISED and mispriced, which the unknown-label
  // rule cannot see: ubuntu-latest-4-cores contains "ubuntu". ---
  add(
    'runner: a larger runner is refused rather than billed at its base rate',
    () =>
      outcome({
        ...base,
        artifacts: {},
        jobs: {
          'acme/private-one#1': [
            completedJob(['ubuntu-latest-4-cores'], '2026-08-01T00:00:00Z', '2026-08-01T00:10:00Z'),
          ],
        },
      }),
    'larger-runner',
  );
  add(
    'runner: an EXACT declared multiplier for that runner is honoured',
    () =>
      runnerMultiplier(['ubuntu-latest-4-cores'], {
        ...FIXTURE_CFG.runnerMultipliers,
        'ubuntu-latest-4-cores': 2,
      }),
    2,
  );
  add(
    'runner: a plain ubuntu-latest is still matched by substring',
    () => runnerMultiplier(['ubuntu-latest'], FIXTURE_CFG.runnerMultipliers),
    1,
  );

  // --- Naming, in a log that is world-readable ---
  add(
    'disclosure: a declared repo is named in full',
    () => repoLabel('acme/private-one', ['acme/private-one'], 0),
    'acme/private-one',
  );
  add(
    'disclosure: an undeclared private repo is measured but referred to positionally',
    () => repoLabel('acme/secret-thing', ['acme/private-one'], 3),
    'undeclared private repo #4',
  );
  add(
    'disclosure: an undeclared repo still contributes its bytes to the pool verdict',
    () =>
      outcome(
        {
          repos: [
            { full_name: 'acme/private-one', private: true },
            { full_name: 'acme/secret-thing', private: true },
          ],
          runs: {},
          artifacts: {
            'acme/private-one': artifactsOf(10),
            'acme/secret-thing': artifactsOf(450),
          },
        },
        FIXTURE_CFG,
      ),
    'exceeded',
  );

  // --- The zero-day cycle: a calendar edge is not a measurement failure ---
  add(
    'cycle: a zero-day-old cycle still measures the pool instead of exiting 2',
    () =>
      outcome(
        { ...base, artifacts: { 'acme/private-one': artifactsOf(450) }, jobs: jobsOf(5) },
        FIXTURE_CFG,
        '2026-08-01T00:00:00Z',
      ),
    'exceeded',
  );
  add(
    'cycle: and a clean account on that same zero-day cycle passes',
    () =>
      outcome(
        { ...base, artifacts: { 'acme/private-one': artifactsOf(1) }, jobs: jobsOf(5) },
        FIXTURE_CFG,
        '2026-08-01T00:00:00Z',
      ),
    'ok',
  );
  add(
    'config: a projectionMinDays of 0 is exit 2 (it enforces day-one noise)',
    () =>
      outcome(base, {
        ...FIXTURE_CFG,
        minutes: { ...FIXTURE_CFG.minutes, projectionMinDays: 0 },
      }),
    'bad-projection-floor',
  );

  // --- Data the guard must not read as zero ---
  add(
    'data: an artifact with no readable size is exit 2, not counted as zero',
    () =>
      outcome({
        ...base,
        artifacts: { 'acme/private-one': [{ id: 1, name: 'x', expired: false }] },
        jobs: jobsOf(5),
      }),
    'unreadable-artifact',
  );
  add(
    'data: a job with unparseable timestamps is exit 2, not skipped',
    () =>
      outcome({
        ...base,
        artifacts: {},
        jobs: {
          'acme/private-one#1': [completedJob(['ubuntu-latest'], 'not-a-date', 'also-not')],
        },
      }),
    'bad-job-times',
  );

  // --- The cycle window itself ---
  add('cycle: August has 31 days', () => cycleWindow(new Date('2026-08-20T00:00:00Z')).daysInCycle, 31);
  add('cycle: February 2028 has 29', () => cycleWindow(new Date('2028-02-10T00:00:00Z')).daysInCycle, 29);
  add(
    'cycle: the API filter is the first of the month, UTC',
    () => cycleWindow(new Date('2026-08-20T00:00:00Z')).startIso,
    '2026-08-01',
  );
  add(
    'cycle: elapsed days are fractional, so a mid-day projection is not rounded away',
    () => Number(cycleWindow(new Date('2026-08-11T12:00:00Z')).daysElapsed.toFixed(2)),
    10.5,
  );

  // --- SUMMING ACROSS REPOS IS THE JOB, and nothing proved it happened. Every
  // other fixture gives one repo everything, so `poolBytes = bytes` instead of
  // `+=` stayed green: two repos at 260 MB each would report 260 and pass. Both
  // of these are built so NEITHER repo alone crosses a line and their SUM does.
  const twoRepos = {
    repos: [
      { full_name: 'acme/private-one', private: true },
      { full_name: 'acme/private-two', private: true },
    ],
    runs: { 'acme/private-one': [{ id: 1 }], 'acme/private-two': [{ id: 2 }] },
  };
  const twoRepoCfg = { ...FIXTURE_CFG, requiredRepos: ['acme/private-one', 'acme/private-two'] };
  add(
    'accumulation: two pools UNDER the ceiling individually still exceed it together',
    () =>
      outcome(
        {
          ...twoRepos,
          artifacts: {
            'acme/private-one': artifactsOf(260),
            'acme/private-two': artifactsOf(260),
          },
        },
        twoRepoCfg,
      ),
    'exceeded',
  );
  add(
    'accumulation: two minute totals UNDER the ceiling individually still exceed it together',
    () =>
      outcome(
        {
          ...twoRepos,
          artifacts: {},
          jobs: {
            'acme/private-one#1': jobsAt('2026-08-02T00:00:00Z', 900)['acme/private-one#1'],
            'acme/private-two#2': jobsAt('2026-08-02T00:00:00Z', 900)['acme/private-one#1'],
          },
        },
        twoRepoCfg,
      ),
    'exceeded',
  );
  // The public-repo filter is what keeps FREE CI out of a private-only budget.
  // The public fixture repo used to be given nothing, so counting it added 0 and
  // dropping the filter changed no verdict -- while in production it would sum
  // this very repo's 21 workflows into the meter and red-light a clean account.
  add(
    'metering: a PUBLIC repo holding a huge pool contributes nothing',
    () =>
      outcome({
        ...base,
        artifacts: {
          'acme/private-one': artifactsOf(10),
          'acme/public-one': artifactsOf(900),
        },
        runs: { 'acme/private-one': [{ id: 1 }], 'acme/public-one': [{ id: 9 }] },
        jobs: {
          'acme/private-one#1': jobsOf(5)['acme/private-one#1'],
          'acme/public-one#9': jobsAt('2026-08-02T00:00:00Z', 1900)['acme/private-one#1'],
        },
      }),
    'ok',
  );

  // --- THE SHIPPED RULES, not just the fixture ones ---

  //
  // assertConfig runs inside runCheck, and main() returns 2 on a missing token
  // BEFORE it ever reads ci-budgets.json -- so an inverted threshold or a
  // deleted block would ship, and every run would red for the token while the
  // reader fixed the token and moved on. The canary job is the one that runs
  // without a secret; this is what makes it able to catch a bad rules file.
  add(
    'shipped: the real ci-budgets.json satisfies every rule assertConfig enforces',
    () => {
      assertConfig(JSON.parse(readFileSync(BUDGETS_PATH, 'utf8')));
      return 'valid';
    },
    'valid',
  );
  add(
    'shipped: the real requiredRepos are all owner-slash-name and non-empty',
    () => {
      const cfg = JSON.parse(readFileSync(BUDGETS_PATH, 'utf8'));
      return cfg.requiredRepos.every((r) => typeof r === 'string' && r.includes('/')) &&
        cfg.requiredRepos.length > 0;
    },
    true,
  );

  // --- The API layer. Driven through makeGitHubApi with a fake fetch, because
  // makeFixtureApi replaces it wholesale and would otherwise leave pagination,
  // the completeness assertion and the HTTP diagnosis with zero coverage. ---
  const fakeFetch = (pages) => {
    const calls = [];
    return {
      calls,
      impl: async (url) => {
        calls.push(url);
        const page = Number(new URL(url).searchParams.get('page'));
        const next = pages[page - 1] ?? { status: 200, body: { total_count: 0, artifacts: [] } };
        return {
          ok: next.status === undefined || next.status < 400,
          status: next.status ?? 200,
          headers: new Map(Object.entries(next.headers ?? {})),
          json: async () => next.body,
        };
      },
    };
  };
  const artifactPage = (n, total) => ({
    body: {
      total_count: total,
      artifacts: Array.from({ length: n }, (v, i) => ({
        id: i, name: 'a', size_in_bytes: 1, expired: false,
      })),
    },
  });

  add(
    'api: pagination walks every page and concatenates them',
    async () => {
      const fake = fakeFetch([artifactPage(100, 150), artifactPage(50, 150)]);
      const api = makeGitHubApi({ token: 't', fetchImpl: fake.impl });
      const rows = await api.listArtifacts('acme/private-one');
      return rows.length;
    },
    150,
  );
  add(
    'api: a short page that does NOT account for total_count is exit 2, not the end of the list',
    async () => {
      const fake = fakeFetch([artifactPage(100, 1200), artifactPage(50, 1200)]);
      const api = makeGitHubApi({ token: 't', fetchImpl: fake.impl });
      try {
        await api.listArtifacts('acme/private-one');
        return 'no-throw';
      } catch (error) {
        return classifyFailure(error);
      }
    },
    'incomplete-pagination',
  );
  add(
    'api: HTTP 401 from the transport is exit 2',
    async () => {
      const fake = fakeFetch([{ status: 401, body: {} }]);
      const api = makeGitHubApi({ token: 't', fetchImpl: fake.impl });
      try {
        await api.listRepos();
        return 'no-throw';
      } catch (error) {
        return classifyFailure(error);
      }
    },
    'auth-failed',
  );
  add(
    'api: the jobs call asks for EVERY attempt, not just the latest',
    async () => {
      const fake = fakeFetch([{ body: { total_count: 0, jobs: [] } }]);
      const api = makeGitHubApi({ token: 't', fetchImpl: fake.impl });
      await api.listJobs('acme/private-one', 1);
      return fake.calls[0].includes('filter=all');
    },
    true,
  );
  // The case BOUNDS ITS OWN HANG. A mutant that stops the abort from firing
  // leaves this fetch pending forever; without the race the whole canary would
  // exit before printing, and zero FAIL lines reads exactly like a blind
  // canary rather than like a killed mutant.
  add(
    'api: a stalled request is aborted and named, not left to hang the job',
    () => {
      const api = makeGitHubApi({
        token: 't',
        timeoutMs: 20,
        fetchImpl: (url, opts) =>
          new Promise((resolve, reject) => {
            opts?.signal?.addEventListener('abort', () => {
              const err = new Error('This operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }),
      });
      const attempt = api.listRepos().then(
        () => 'no-throw',
        (error) => (error.message.includes('timed out after') ? 'timed-out' : error.message),
      );
      const stall = new Promise((resolve) => setTimeout(() => resolve('hung'), 2000));
      return Promise.race([attempt, stall]);
    },
    'timed-out',
  );
  add(
    'api: every request carries the abort signal in the first place',
    async () => {
      let sawSignal = null;
      const api = makeGitHubApi({
        token: 't',
        fetchImpl: async (url, opts) => {
          sawSignal = opts?.signal ?? null;
          return { ok: true, status: 200, headers: new Map(), json: async () => [] };
        },
      });
      await api.listRepos();
      return sawSignal !== null;
    },
    true,
  );
  add(
    'api: rate limiting is diagnosed apart from a bad token',
    () =>
      describeHttpFailure('/x', 403, new Map([['x-ratelimit-remaining', '0']])).includes(
        'do not rotate it',
      ),
    true,
  );
  add(
    'api: a genuine permission 403 still says the token may lack access',
    () => describeHttpFailure('/x', 403, new Map()).includes('lacks Actions:read'),
    true,
  );
  add('api: 429 is always rate limiting', () =>
    describeHttpFailure('/x', 429, new Map()).includes('RATE LIMITED'), true);

  // --- The remaining rules whose mutants scored ZERO on the first pass ---
  add(
    'largest: the biggest artifact is reported, not merely the first or the smallest',
    () =>
      largestHeld([
        { repo: 'r', name: 'small-log', bytes: 10 * MB },
        { repo: 'r', name: 'huge-report', bytes: 470 * MB },
        { repo: 'r', name: 'medium', bytes: 90 * MB },
      ]).name,
    'huge-report',
  );
  add(
    'disclosure: an undeclared repo artifact NAME is withheld from the culprit line',
    async () => {
      const result = await runCheck({
        cfg: FIXTURE_CFG,
        api: makeFixtureApi({
          repos: [
            { full_name: 'acme/private-one', private: true },
            { full_name: 'acme/secret-thing', private: true },
          ],
          runs: {},
          artifacts: { 'acme/secret-thing': artifactsOf(450) },
        }),
        now: new Date('2026-08-20T00:00:00Z'),
        log: () => {},
      });
      return result.biggest.name;
    },
    '(name withheld)',
  );
  // 300 minutes on day 5. Clipped, the divisor is the 5 days that actually
  // exist: 60 min/day, projecting 1860 -- over the fail line. Un-clipped it
  // divides by a nominal 7, two of which hold no data at all: 42.9 min/day,
  // projecting 1414 -- a warn. The numbers are chosen so the two divisors land
  // on OPPOSITE sides of a threshold; an earlier version used 500 minutes,
  // where both divisors failed and the mutant survived with the case green.
  add(
    'window: the rate window is CLIPPED to the elapsed cycle, not divided by its nominal length',
    () =>
      outcome(
        { ...base, artifacts: {}, jobs: jobsAt('2026-08-02T00:00:00Z', 300) },
        FIXTURE_CFG,
        '2026-08-06T00:00:00Z',
      ),
    'exceeded',
  );
  add(
    'units: the pool divisor is decimal MB, matching the allowance GitHub bills against',
    () => livePoolBytes([{ id: 1, size_in_bytes: 1000000, expired: false }]) / MB,
    1,
  );
  add(
    'api: the run list carries the created>= cycle filter',
    async () => {
      const fake = fakeFetch([{ body: { total_count: 0, workflow_runs: [] } }]);
      const api = makeGitHubApi({ token: 't', fetchImpl: fake.impl });
      await api.listRuns('acme/private-one', 'acme/private-one', '2026-08-01');
      return fake.calls[0].includes('created=%3E%3D2026-08-01');
    },
    true,
  );
  add(
    'api: an error message carries the LABEL, never the private repo real name',
    async () => {
      const fake = fakeFetch([{ status: 403, body: {} }]);
      const api = makeGitHubApi({ token: 't', fetchImpl: fake.impl });
      try {
        await api.listArtifacts('acme/secret-thing', 'undeclared private repo #2');
        return 'no-throw';
      } catch (error) {
        return error.message.includes('secret-thing') ? 'LEAKED' : 'redacted';
      }
    },
    'redacted',
  );
  add(
    'api: exhausting PAGE_CAP is exit 2, not a truncated list reported as complete',
    async () => {
      const api = makeGitHubApi({
        token: 't',
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          headers: new Map(),
          json: async () => ({
            artifacts: Array.from({ length: 100 }, (v, i) => ({
              id: i, name: 'a', size_in_bytes: 1, expired: false,
            })),
          }),
        }),
      });
      try {
        await api.listArtifacts('acme/private-one', 'acme/private-one');
        return 'no-throw';
      } catch (error) {
        return classifyFailure(error);
      }
    },
    'pagination-cap',
  );
  add(
    'api: a sweep that runs out of its own budget names where it stopped',
    async () => {
      const api = makeGitHubApi({
        token: 't',
        sweepBudgetMs: -1,
        fetchImpl: async () => ({ ok: true, status: 200, headers: new Map(), json: async () => [] }),
      });
      try {
        await api.listRepos();
        return 'no-throw';
      } catch (error) {
        return error.message.includes('exhausted its') ? 'sweep-budget' : error.message;
      }
    },
    'sweep-budget',
  );
  add(
    'repos: a duplicated full_name is exit 2, not a double-counted pool',
    () =>
      outcome({
        repos: [
          { full_name: 'acme/private-one', private: true },
          { full_name: 'acme/private-one', private: true },
        ],
        runs: {},
        artifacts: { 'acme/private-one': artifactsOf(10) },
      }),
    'duplicate-repos',
  );
  add(
    'minutes: a job that STARTED before this cycle is not billed to it',
    () =>
      summariseJobs(
        [completedJob(['ubuntu-latest'], '2026-07-28T00:00:00Z', '2026-07-28T00:30:00Z')],
        FIXTURE_CFG.runnerMultipliers,
        null,
        Date.parse('2026-08-01T00:00:00Z'),
      ).minutes,
    0,
  );
  add(
    'minutes: and a RE-RUN of that old run, started inside the cycle, IS billed to it',
    () =>
      summariseJobs(
        [completedJob(['ubuntu-latest'], '2026-08-05T00:00:00Z', '2026-08-05T00:30:00Z')],
        FIXTURE_CFG.runnerMultipliers,
        null,
        Date.parse('2026-08-01T00:00:00Z'),
      ).minutes,
    30,
  );
  add(
    'config: a missing reRunLookbackDays is exit 2',
    () =>
      outcome(base, {
        ...FIXTURE_CFG,
        minutes: { ...FIXTURE_CFG.minutes, reRunLookbackDays: undefined },
      }),
    'bad-lookback',
  );

  // --- Reporting ---
  add(
    'report: a failing pool names the culprit artifact',
    async () => {
      const result = await runCheck({
        cfg: FIXTURE_CFG,
        api: makeFixtureApi({
          ...base,
          artifacts: { 'acme/private-one': artifactsOf(450) },
          jobs: jobsOf(5),
        }),
        now: new Date('2026-08-20T00:00:00Z'),
        log: () => {},
      });
      return verdictReport(result, FIXTURE_CFG).some((l) => l.includes('playwright-report'));
    },
    true,
  );
  add(
    'report: a clean account says so in one line',
    async () => {
      const result = await runCheck({
        cfg: FIXTURE_CFG,
        api: makeFixtureApi({
          ...base,
          artifacts: { 'acme/private-one': artifactsOf(1) },
          jobs: jobsOf(5),
        }),
        now: new Date('2026-08-20T00:00:00Z'),
        log: () => {},
      });
      return verdictReport(result, FIXTURE_CFG).length;
    },
    1,
  );

  return runCases(cases);
}

async function runCases(cases) {
  let failed = 0;
  for (const testCase of cases) {
    let got;
    try {
      got = await testCase.run();
    } catch (error) {
      got = 'threw: ' + error.message;
    }
    const ok = got === testCase.expected;
    if (!ok) failed += 1;
    const detail = ok
      ? ''
      : '  (expected ' + JSON.stringify(testCase.expected) + ', got ' + JSON.stringify(got) + ')';
    console.log((ok ? 'ok  ' : 'FAIL') + '  ' + testCase.name + detail);
  }
  if (failed > 0) {
    console.error('');
    console.error('FAIL self-test -- ' + failed + ' of ' + cases.length + ' case(s).');
    return false;
  }
  console.log('');
  console.log(
    'PASS self-test -- ' + cases.length + ' cases, every rule proven in both directions.',
  );
  return true;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export async function main(argv) {
  const KNOWN_FLAGS = ['--self-test'];
  const unknown = argv.filter((arg) => !KNOWN_FLAGS.includes(arg));
  if (unknown.length > 0) {
    console.error(
      'Unknown flag(s): ' + unknown.join(', ') + '. Known: ' + KNOWN_FLAGS.join(', '),
    );
    return 2;
  }
  if (argv.includes('--self-test')) {
    const passed = await selfTest();
    return passed ? 0 : 1;
  }

  const token = (process.env.CI_BUDGET_GITHUB_TOKEN ?? '').trim();
  if (!token) {
    // Deliberately no fallback to GITHUB_TOKEN. The workflow token is scoped to
    // THIS repo, which is public and therefore never metered: it would return a
    // repo list with no metered repos in it. The guard would still exit 2 -- but
    // with a confusing message about a missing repo instead of a missing secret.
    // An explicit name fails in the place the reader has to fix.
    console.error(
      'CI_BUDGET_GITHUB_TOKEN is not set. This guard reads account-wide Actions ' +
        'state and cannot run unauthenticated -- an unauthenticated read returns ' +
        'an empty repo list, sums to 0 bytes, and reads as under budget. Create a ' +
        'fine-grained PAT with Actions:read (plus the default Metadata:read) ' +
        'scoped to ALL REPOSITORIES -- a picked list makes a newly created ' +
        'private repo invisible, which is the case this guard advertises it ' +
        'catches. Store it as the CI_BUDGET_GITHUB_TOKEN secret and re-run.',
    );
    return 2;
  }

  let cfg;
  try {
    cfg = JSON.parse(readFileSync(BUDGETS_PATH, 'utf8'));
  } catch (error) {
    console.error('Cannot read ci-budgets.json: ' + error.message);
    return 2;
  }

  let result;
  try {
    result = await runCheck({ cfg, api: makeGitHubApi({ token }), now: new Date() });
  } catch (error) {
    console.error('');
    console.error('CI budget guard COULD NOT MEASURE: ' + error.message);
    console.error(
      'This is exit 2 on purpose. A spend guard that cannot see the account must ' +
        'not report a number -- an empty reading is indistinguishable from a ' +
        'perfectly clean one.',
    );
    return 2;
  }

  const report = verdictReport(result, cfg);
  console.log('');
  for (const line of report) {
    if (result.code === 1) console.error(line);
    else console.log(line);
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = ['## CI spend', '', '```', ...result.lines, '```', '', ...report, ''];
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
  }
  return result.code;
}

const IS_CLI =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (IS_CLI) {
  // process.exitCode, never process.exit() after printing: on Linux CI a
  // process.exit truncates buffered stdout (904 lines became 194, measured).
  process.exitCode = await main(process.argv.slice(2));
}
