#!/usr/bin/env node
/**
 * Guards Vercel FUNCTION STORAGE against the free-tier allowance, the way
 * check-firewall-drift.mjs guards the live WAF config and check-ci-budget.mjs
 * guards GitHub spend.
 *
 * WHY THIS EXISTS. On 2026-09-07 Vercel emailed at 75% of the 10 GB Hobby
 * Function Storage allowance. Nothing in this repo measured it, so the first
 * detector was the email -- and at 100% Vercel can return 503
 * DEPLOYMENT_PAUSED, which takes the live site down. The cause was two
 * multipliers nobody was watching: 27.70 MiB of function bundle per deployment
 * (an @sentry/react-router import dragging the whole Vite toolchain into the
 * lambda) times 315 retained deployments.
 *
 * WHY ITS OWN WORKFLOW, not a job inside ci-budget-guard.yml. Same reasoning
 * firewall-drift-check.yml already wrote down and this file does not re-decide:
 * this measures ACCOUNT/EXTERNAL state through a live credentialed Vercel call,
 * not a diff of this repo. A Dependabot PR gets a narrower secret store, so
 * VERCEL_TOKEN would be silently absent and every such PR would report a
 * spurious "could not measure". Decoupled and separately named, a missing or
 * expired token reds THIS board rather than every PR's.
 *
 * WHAT IT MEASURES, and why it is the LEADING indicator. Vercel bills Function
 * Storage in GB-months -- a daily maximum summed over the period, so the
 * percentage on the dashboard LAGS: by the time it reads 75% the month is
 * mostly spent and deleting deployments refunds nothing for ~30 days (deletion
 * is soft, with a recovery window). What moves first, and is readable at any
 * instant from two API calls, is the POOL:
 *
 *     retained deployments  x  function bytes per deployment
 *
 * Both factors are exactly the two levers anyone has: retention policy and
 * deploy rate move the first, bundle contents move the second. A guard
 * thresholded on the accrued percentage would fire the same day Vercel's email
 * did, which is worth nothing.
 *
 * MEASURING BYTES IS NOT OBVIOUS -- the one trap worth knowing. Only
 * GET /v1/deployments/{id}/builds carries sizes; /v6/ and /v13/ do not. It
 * returns ONE output[] entry PER ROUTE, each repeating the SAME lambda with the
 * same `size` and `digest`. Summing them naively gave 1.47 GB for a function
 * whose real size was 27.70 MiB. Dedupe by `digest`.
 *
 * DECIMAL GB, deliberately, matching ci-budgets.json's reasoning for the GitHub
 * pool: Vercel's included "10 GB" is decimal, so measuring in GiB would compare
 * against 9.31 GiB of real allowance and quietly move the fail line.
 *
 * HONEST LIMIT, also in ci-budgets.json's block: the pool is an ESTIMATE of the
 * stored bytes, never the invoice. It prices every retained deployment at the
 * size of the newest one, so a run right after a bundle change reads optimistic
 * (older, fatter deployments are still stored) and a run right after a bundle
 * regression reads pessimistic. It is the right shape for catching drift in
 * either multiplier; it is not an accounting record. No Hobby API exposes the
 * real GB figure -- that is dashboard-only, which is precisely why this proxy
 * has to exist.
 *
 * Usage:
 *        node scripts/check-deployment-storage.mjs
 *        node scripts/check-deployment-storage.mjs --self-test
 *
 * Exit codes: 0 under budget, 1 over a threshold, 2 COULD NOT MEASURE.
 * Exit 2 is never a pass. Every way this can measure nothing -- no token, a
 * 401, a renamed project, an empty deployment list, a deployment with no lambda
 * outputs -- returns 2 rather than a small number that reads as healthy.
 */

import { resolveProjectId } from './lib/firewall-config.mjs';

const API = 'https://api.vercel.com';
const GB = 1000000000;
const PAGE_CAP = 40;
const PER_PAGE = 100;

/** Decimal MB, for report lines. */
const fmtMB = (bytes) => (bytes / 1000000).toFixed(2) + ' MB';
const fmtGB = (bytes) => (bytes / GB).toFixed(2) + ' GB';

// ---------------------------------------------------------------------------
// Pure rules. Each takes its data so the self-test can drive it directly --
// the canary must exercise the DECISION, not just the predicates feeding it.
// ---------------------------------------------------------------------------

/**
 * The whole verdict, as a pure function of the two measured numbers.
 * Returns {code, label, reason}.
 */
export function verdictFor({ retained, bytesPerDeployment, budget }) {
  if (!Number.isFinite(retained) || retained <= 0) {
    return {
      code: 2,
      label: 'COULD NOT MEASURE',
      reason:
        'the project returned ' + retained + ' deployments. An expired token, a ' +
        'renamed project or a narrowed scope all return an EMPTY list, which ' +
        'multiplies out to 0 bytes and reads as wonderfully under budget -- the ' +
        'inversion this guard exists to prevent. A live project always has at ' +
        'least one deployment.',
    };
  }
  if (!Number.isFinite(bytesPerDeployment) || bytesPerDeployment <= 0) {
    return {
      code: 2,
      label: 'COULD NOT MEASURE',
      reason:
        'no lambda output carried a size, so bytes-per-deployment measured ' +
        bytesPerDeployment + '. That is the /v1/.../builds shape changing or the ' +
        'token losing read access -- not a project whose functions got smaller.',
    };
  }

  const poolBytes = retained * bytesPerDeployment;
  const pct = (poolBytes / (budget.includedGB * GB)) * 100;
  const base =
    retained + ' retained x ' + fmtMB(bytesPerDeployment) + ' = ' +
    fmtGB(poolBytes) + ' of ' + budget.includedGB + ' GB (' + pct.toFixed(1) + '%)';

  if (poolBytes >= budget.failGB * GB) {
    return { code: 1, label: 'OVER BUDGET', reason: base, poolBytes, pct };
  }
  if (poolBytes >= budget.warnGB * GB) {
    return { code: 1, label: 'WARN', reason: base, poolBytes, pct };
  }
  return { code: 0, label: 'under budget', reason: base, poolBytes, pct };
}

/**
 * Dedupe lambda outputs by digest and sum. The /builds response repeats one
 * lambda once per ROUTE it serves; without the dedupe a 27 MB function reports
 * as 1.47 GB.
 */
export function functionBytesFromBuilds(builds) {
  const seen = new Map();
  for (const build of builds || []) {
    for (const out of build.output || []) {
      if (out.type !== 'lambda') continue;
      if (typeof out.size !== 'number' || out.size <= 0) continue;
      if (!seen.has(out.digest)) seen.set(out.digest, out.size);
    }
  }
  let total = 0;
  for (const size of seen.values()) total += size;
  return { bytes: total, functions: seen.size };
}

export function assertBudget(budget) {
  for (const key of ['includedGB', 'warnGB', 'failGB']) {
    const v = budget && budget[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
      return (
        'ci-budgets.json deploymentStorage.' + key + ' is ' + JSON.stringify(v) +
        '. It must be a positive number or the guard has no line to hold.'
      );
    }
  }
  if (budget.warnGB >= budget.failGB) {
    return (
      'ci-budgets.json deploymentStorage.warnGB (' + budget.warnGB + ') is not ' +
      'below failGB (' + budget.failGB + '), so the warn tier can never fire ' +
      'before the fail tier and is dead config.'
    );
  }
  if (budget.failGB > budget.includedGB) {
    return (
      'ci-budgets.json deploymentStorage.failGB (' + budget.failGB + ') is above ' +
      'includedGB (' + budget.includedGB + '), so the guard would only fire after ' +
      'the allowance was already blown -- which is when Vercel pauses the site.'
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Live measurement
// ---------------------------------------------------------------------------

/** Count every retained deployment for the project. */
async function countDeployments(api, projectId, teamQs) {
  let until = null;
  let count = 0;
  let newestReady = null;
  for (let page = 0; page < PAGE_CAP; page += 1) {
    const url =
      API + '/v6/deployments?projectId=' + projectId + teamQs +
      '&limit=' + PER_PAGE + (until ? '&until=' + until : '');
    const body = await api.getJson(url);
    const rows = body.deployments || [];
    if (rows.length === 0) break;
    count += rows.length;
    for (const row of rows) {
      const state = row.state || row.readyState;
      if (state === 'READY' && !newestReady) newestReady = row.uid;
    }
    if (!body.pagination || !body.pagination.next) break;
    until = body.pagination.next;
  }
  return { count, newestReady };
}

export async function runCheck({ api, budget, projectId, teamQs, log = console.log }) {
  const configError = assertBudget(budget);
  if (configError) return { code: 2, label: 'COULD NOT MEASURE', reason: configError };

  const { count, newestReady } = await countDeployments(api, projectId, teamQs);
  if (!newestReady) {
    return {
      code: 2,
      label: 'COULD NOT MEASURE',
      reason:
        'no READY deployment found among ' + count + ' returned. Without one there ' +
        'is nothing to size the pool against, and reporting the count alone would ' +
        'understate storage rather than fail.',
    };
  }

  const builds = await api.getJson(
    API + '/v1/deployments/' + newestReady + '/builds' + (teamQs ? '?' + teamQs.slice(1) : ''),
  );
  const { bytes, functions } = functionBytesFromBuilds(builds.builds);

  const verdict = verdictFor({ retained: count, bytesPerDeployment: bytes, budget });
  log('deployment storage guard -- project ' + projectId);
  log('  newest READY deployment: ' + newestReady + ' (' + functions + ' function(s))');
  log('  ' + verdict.label + ': ' + verdict.reason);
  if (verdict.code === 1) {
    log('');
    log('  The pool is (retained deployments) x (bytes per deployment). Move either:');
    log('   - retention: Vercel -> Settings -> Build and Deployment -> Deployment');
    log('     Retention Policy. Hobby offers 30 days / 2 weeks / 1 week / 1 day,');
    log('     independently per class. Previews rarely need more than a week.');
    log('   - deploy rate: vercel.json ignoreCommand, and any cron or deploy hook.');
    log('   - bundle bytes: trace it with @vercel/nft over build/server/**/index.js');
    log('     and group fileList by package -- build tooling in the lambda is the');
    log('     usual finding, and it is invisible to grep.');
  }
  return verdict;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

export async function main(argv, deps = {}) {
  if (argv.includes('--self-test')) {
    const passed = await selfTest();
    return passed ? 0 : 1;
  }
  const unknown = argv.filter((a) => a.startsWith('--') && a !== '--self-test');
  if (unknown.length) {
    console.error('unknown flag(s): ' + unknown.join(', '));
    return 2;
  }

  const token = deps.token ?? process.env.VERCEL_TOKEN;
  if (!token) {
    console.error(
      'deployment storage guard COULD NOT MEASURE: VERCEL_TOKEN is not set. ' +
        'This is exit 2 on purpose -- an unauthenticated read returns nothing, ' +
        'and nothing sums to zero, which would read as under budget.',
    );
    return 2;
  }

  const teamId = process.env.VERCEL_TEAM_ID ?? '';
  const teamQs = teamId ? '&teamId=' + teamId : '';
  const project = process.env.VERCEL_PROJECT || 'bachata-website';

  const api = deps.api ?? {
    getJson: async (url) => {
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) {
        throw new Error(res.status + ' ' + url + ': ' + (await res.text()).slice(0, 200));
      }
      return res.json();
    },
  };

  let projectId;
  try {
    projectId = deps.projectId ?? (await resolveProjectId(fetch, token, project, teamId));
  } catch (error) {
    console.error(
      'deployment storage guard COULD NOT MEASURE: cannot resolve project id for ' +
        project + ' -- ' + error.message,
    );
    return 2;
  }

  let verdict;
  try {
    verdict = await runCheck({ api, budget: deps.budget ?? (await loadBudget()), projectId, teamQs });
  } catch (error) {
    console.error('deployment storage guard COULD NOT MEASURE: ' + error.message);
    return 2;
  }
  if (verdict.code === 2) {
    console.error('deployment storage guard COULD NOT MEASURE: ' + verdict.reason);
  }
  return verdict.code;
}

async function loadBudget() {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const raw = await readFile(path.join(root, 'ci-budgets.json'), 'utf8');
  const cfg = JSON.parse(raw);
  return cfg.deploymentStorage;
}

// ---------------------------------------------------------------------------
// Self-test. Drives the DECISION in both directions, and every could-not-measure
// shape -- a guard proven only on healthy input is half a test.
// ---------------------------------------------------------------------------

const BUDGET = { includedGB: 10, warnGB: 5, failGB: 7.5 };
const MB22 = 22790000; // the measured post-fix bundle, decimal bytes

async function selfTest() {
  const cases = [];
  const add = (name, fn) => cases.push({ name, fn });

  // --- the decision, in BOTH directions -------------------------------------
  add('healthy pool is exit 0', () => {
    const v = verdictFor({ retained: 145, bytesPerDeployment: MB22, budget: BUDGET });
    return v.code === 0;
  });
  add('warn tier is exit 1', () => {
    const v = verdictFor({ retained: 250, bytesPerDeployment: MB22, budget: BUDGET });
    return v.code === 1 && v.label === 'WARN';
  });
  add('fail tier is exit 1 and says OVER BUDGET', () => {
    const v = verdictFor({ retained: 340, bytesPerDeployment: MB22, budget: BUDGET });
    return v.code === 1 && v.label === 'OVER BUDGET';
  });
  add('the incident that caused this guard would have fired', () => {
    // 315 retained x 29.02 decimal MB = 9.14 GB, the state on 2026-09-07.
    const v = verdictFor({ retained: 315, bytesPerDeployment: 29017102, budget: BUDGET });
    return v.code === 1 && v.label === 'OVER BUDGET';
  });
  add('the post-fix state is comfortably green', () => {
    const v = verdictFor({ retained: 145, bytesPerDeployment: MB22, budget: BUDGET });
    return v.code === 0 && v.pct < 40;
  });

  // --- every could-not-measure shape ----------------------------------------
  add('zero deployments is exit 2, NOT a healthy zero', () => {
    const v = verdictFor({ retained: 0, bytesPerDeployment: MB22, budget: BUDGET });
    return v.code === 2;
  });
  add('zero bytes per deployment is exit 2', () => {
    const v = verdictFor({ retained: 145, bytesPerDeployment: 0, budget: BUDGET });
    return v.code === 2;
  });
  add('a non-finite count is exit 2', () => {
    const v = verdictFor({ retained: NaN, bytesPerDeployment: MB22, budget: BUDGET });
    return v.code === 2;
  });

  // --- the dedupe, which is the measurement's whole correctness -------------
  add('builds output deduped by digest, not summed per route', () => {
    const one = { digest: 'd1', type: 'lambda', size: 1000 };
    const builds = [{ output: [one, one, one, { ...one }, { digest: 'd2', type: 'lambda', size: 20 }] }];
    const { bytes, functions } = functionBytesFromBuilds(builds);
    return bytes === 1020 && functions === 2;
  });
  add('non-lambda outputs are ignored', () => {
    const builds = [{ output: [{ digest: 'x', type: 'file', size: 999 }] }];
    return functionBytesFromBuilds(builds).bytes === 0;
  });
  add('empty builds measure zero, which verdictFor turns into exit 2', () => {
    const { bytes } = functionBytesFromBuilds([]);
    return bytes === 0 && verdictFor({ retained: 5, bytesPerDeployment: bytes, budget: BUDGET }).code === 2;
  });

  // --- config assertions -----------------------------------------------------
  add('warn above fail is rejected as dead config', () =>
    assertBudget({ includedGB: 10, warnGB: 8, failGB: 7.5 }) !== null);
  add('fail above included is rejected', () =>
    assertBudget({ includedGB: 10, warnGB: 5, failGB: 12 }) !== null);
  add('a missing threshold is rejected', () => assertBudget({ includedGB: 10, warnGB: 5 }) !== null);
  add('the shipped budget passes its own assertion', () => assertBudget(BUDGET) === null);

  // --- main()'s exit contract, which is what CI actually reads ---------------
  // R5 in check-firewall-drift.mjs: a canary that proves every RULE and never
  // drives main() can pass with main()'s return flipped. These drive main().
  add('main() with no token is exit 2', async () => {
    const orig = process.env.VERCEL_TOKEN;
    delete process.env.VERCEL_TOKEN;
    try {
      return (await main([], { token: undefined })) === 2;
    } finally {
      if (orig !== undefined) process.env.VERCEL_TOKEN = orig;
    }
  });
  add('main() with an unknown flag is exit 2', async () => (await main(['--nope'])) === 2);
  add('main() surfaces a throwing api as exit 2, never 0', async () => {
    const code = await main([], {
      token: 't',
      projectId: 'prj_x',
      budget: BUDGET,
      api: { getJson: async () => { throw new Error('401 unauthorized'); } },
    });
    return code === 2;
  });
  add('main() returns 0 on a healthy injected account', async () => {
    const code = await main([], {
      token: 't',
      projectId: 'prj_x',
      budget: BUDGET,
      api: {
        getJson: async (url) =>
          url.includes('/builds')
            ? { builds: [{ output: [{ digest: 'd', type: 'lambda', size: MB22 }] }] }
            : { deployments: [{ uid: 'dpl_1', state: 'READY' }], pagination: null },
      },
    });
    return code === 0;
  });
  add('main() returns 1 when the injected account is over budget', async () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ uid: 'dpl_' + i, state: 'READY' }));
    let page = 0;
    const code = await main([], {
      token: 't',
      projectId: 'prj_x',
      budget: BUDGET,
      api: {
        getJson: async (url) => {
          if (url.includes('/builds')) {
            return { builds: [{ output: [{ digest: 'd', type: 'lambda', size: 29017102 }] }] };
          }
          page += 1;
          return { deployments: many, pagination: page < 4 ? { next: page } : null };
        },
      },
    });
    return code === 1;
  });
  add('main() is exit 2 when the account returns no READY deployment', async () => {
    const code = await main([], {
      token: 't',
      projectId: 'prj_x',
      budget: BUDGET,
      api: {
        getJson: async () => ({ deployments: [{ uid: 'dpl_1', state: 'ERROR' }], pagination: null }),
      },
    });
    return code === 2;
  });

  let pass = 0;
  for (const c of cases) {
    let ok = false;
    try {
      ok = await c.fn();
    } catch (error) {
      console.log('  case threw: ' + c.name + ' -- ' + error.message);
      ok = false;
    }
    if (ok) pass += 1;
    else console.log('  FAILED: ' + c.name);
  }
  console.log('check-deployment-storage self-test: ' + pass + '/' + cases.length + ' passed');
  return pass === cases.length;
}

// process.exitCode, never process.exit(): on Linux CI process.exit truncates
// buffered stdout, and with fetch in flight it can abort the process outright
// (measured in this account 2026-09-08 -- an until-loop poller spun forever
// because process.exit raced a pending fetch).
process.exitCode = await main(process.argv.slice(2));
