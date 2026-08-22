#!/usr/bin/env node
/**
 * FIREWALL DRIFT GUARD -- the live Vercel Edge/WAF config, diffed against the
 * committed vercel-firewall.json, every CI cycle. Phase P3 of the
 * edge-config-governance arc (closes RC1): until this existed, a dashboard
 * edit to Bot Protection / the OWASP CRS / a custom rule left no diff, no
 * review, no history anywhere -- exactly what took prod down for ~14h on
 * 2026-08-21, with four red probe workflows nobody was told about.
 *
 * HONEST LIMIT, stated here rather than implied away: this detects a
 * dashboard edit within one CI cycle. It does not and cannot PREVENT one --
 * nobody can stop a PATCH made straight against Vercel's API from outside
 * this repo. What it buys is time-to-detect: from "until a user complains"
 * to one CI cycle.
 *
 * NON-VACUITY. A fetch that returns no managedRules is not "zero drift", it
 * is "measured nothing" -- read as clean, it would be the exact inversion
 * check-ci-budget.mjs's own header warns about (an auth failure summing to 0
 * bytes and reading as under budget). See the guard below.
 *
 * Local: VERCEL_TOKEN=... node scripts/check-firewall-drift.mjs
 *        node scripts/check-firewall-drift.mjs --self-test
 * CI:    .github/workflows/firewall-drift-check.yml (schedule + dispatch).
 *        Deliberately NOT a 5th "Announce failure" consumer inside
 *        db-contract-check.yml and NOT wired into pre-ship's CHECKS -- see
 *        that workflow's own header for why (account/external state via a
 *        live, credentialed call, not a diff of this repo -- the same
 *        reasoning ci-budget-guard.yml and check:ci-budget already rest on).
 *
 * Exit: 0 no drift, 1 drift found (a contract violation), 2 could not
 * measure. A missing token, an unreadable committed file, a fetch failure or
 * an empty-looking response are all 2 -- never a green report over a read
 * that measured nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';
import {
  canonicalizeConfig,
  diffConfig,
  formatFinding,
  isPlausibleLiveConfig,
  resolveVercelEnv,
  resolveProjectId,
  fetchActiveConfig,
} from './lib/firewall-config.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COMMITTED_PATH = path.join(ROOT, 'vercel-firewall.json');

/**
 * Measure once and report a verdict. Every collaborator is injected so the
 * canary can drive every branch -- including the failures, which are the
 * ones that matter most (R1: a green exit reachable from a missing secret,
 * a walled read, an empty sample).
 */
export async function runCheck({
  env = process.env,
  fetchImpl = fetch,
  readCommitted = () => fs.readFileSync(COMMITTED_PATH, 'utf8'),
  log = console.log,
} = {}) {
  const { token, project, teamId } = resolveVercelEnv(env);
  if (!token) {
    return {
      code: 2,
      reason:
        'VERCEL_TOKEN is not set. This guard reads the LIVE Vercel firewall config and ' +
        'cannot run unauthenticated -- an unauthenticated fetch fails outright rather than ' +
        'returning an empty config, but a guard that treated ANY unmeasured state as ' +
        '"no drift" would reproduce the exact silence this guard exists to end.',
    };
  }

  let committedRaw;
  try {
    committedRaw = JSON.parse(readCommitted());
  } catch (error) {
    return { code: 2, reason: `cannot read/parse vercel-firewall.json: ${error.message}` };
  }
  const committed = canonicalizeConfig(committedRaw);

  let projectId;
  try {
    projectId = await resolveProjectId(fetchImpl, token, project, teamId);
  } catch (error) {
    return { code: 2, reason: `could not resolve project "${project}": ${error.message}` };
  }

  let liveRaw;
  try {
    liveRaw = await fetchActiveConfig(fetchImpl, token, projectId, teamId);
  } catch (error) {
    return { code: 2, reason: `could not fetch live firewall config: ${error.message}` };
  }

  if (!isPlausibleLiveConfig(liveRaw)) {
    return {
      code: 2,
      reason:
        'live config fetch returned no managedRules -- cannot distinguish "no drift" from ' +
        '"the read measured nothing".',
    };
  }

  const live = canonicalizeConfig(liveRaw);
  let findings;
  try {
    findings = diffConfig(committed, live);
  } catch (error) {
    return { code: 2, reason: error.message };
  }

  if (findings.length === 0) {
    log('firewall drift: none -- live config matches vercel-firewall.json');
    return { code: 0, findings };
  }

  log(`firewall drift: ${findings.length} field(s) differ from vercel-firewall.json`);
  for (const f of findings) log('  ' + formatFinding(f));
  return { code: 1, findings };
}

export async function main(argv = [], deps = {}) {
  const { out = console.log, err = console.error } = deps;
  if (argv.includes('--self-test')) {
    const passed = await selfTest();
    return passed ? 0 : 1;
  }
  const result = await runCheck({ ...deps, log: out });
  if (result.code === 2) {
    err('');
    err('firewall drift guard COULD NOT MEASURE: ' + result.reason);
    err('This is exit 2 on purpose -- never a green report over an unmeasured read.');
  }
  return result.code;
}

// Realpath-to-realpath (scripts/lib/entry-point.mjs). The raw import.meta vs
// argv[1] string compare it replaces mispredicts through a junction or
// symlink and the whole guard -- including its own canary -- prints nothing
// and exits 0.
// ---------------------------------------------------------------------------
// Canary (R4 of check-script-conventions.mjs -- a guard with no proof it can
// fail is not a guard). Pure fixtures: no network, no token, no filesystem.
//
// DECLARED BEFORE THE DISPATCH BELOW, DELIBERATELY: main() -> selfTest() can
// run synchronously inside the module's own top-level `await main(...)`, and
// these are `const` bindings -- unlike the hoisted function declarations
// around them, a `const` is in the temporal dead zone until its own
// declaration line has executed. Putting the isEntryPoint dispatch ABOVE
// this block (as most guards in this repo do, main() having nothing here to
// wait on) made every --self-test case throw "Cannot access before
// initialization" -- caught by running the canary itself, not by reading.
// ---------------------------------------------------------------------------

const FIXTURE_COMMITTED_RAW = {
  managedRules: {
    ai_bots: { active: true, action: 'deny' },
    bot_protection: { active: true, action: 'log' },
  },
  crs: { sqli: { active: true, action: 'log' } },
  rules: [
    {
      id: 'rule_x',
      name: 'Bypass',
      active: true,
      description: 'd',
      conditionGroup: [{ conditions: [{ type: 'path', op: 'eq', value: '/api/x' }] }],
      action: { mitigate: { action: 'bypass', redirect: null, rateLimit: null, actionDuration: null } },
    },
  ],
  ips: [],
  firewallEnabled: true,
};

const clone = (o) => JSON.parse(JSON.stringify(o));

function fetchFor(liveRaw, opts = {}) {
  return async (url) => {
    const u = String(url);
    if (u.includes('/v9/projects/')) {
      if (opts.projectFails) {
        return { ok: false, status: 401, text: async () => JSON.stringify({ error: { message: 'bad token' } }) };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'prj_test' }) };
    }
    if (u.includes('/v1/security/firewall/config/active')) {
      if (opts.activeThrows) throw new Error('network down');
      if (opts.activeFails) {
        return { ok: false, status: 500, text: async () => JSON.stringify({ error: { message: 'server error' } }) };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify(liveRaw) };
    }
    throw new Error('unexpected url in fixture: ' + u);
  };
}

async function selfTest() {
  const cases = [];
  const add = (name, run, expected) => cases.push({ name, run, expected });

  // --- R1-shape: missing token / unreadable state is exit 2, never a
  //     silent skip that reads as clean ---
  add('missing VERCEL_TOKEN is exit 2', async () =>
    (await runFor(FIXTURE_COMMITTED_RAW, {}, { VERCEL_TOKEN: '' })).code, 2);
  add('unreadable vercel-firewall.json is exit 2', async () =>
    (await runFor(FIXTURE_COMMITTED_RAW, { readCommittedThrows: true })).code, 2);
  add('cannot resolve project id is exit 2', async () =>
    (await runFor(FIXTURE_COMMITTED_RAW, { projectFails: true })).code, 2);
  add('live fetch HTTP failure is exit 2', async () =>
    (await runFor(FIXTURE_COMMITTED_RAW, { activeFails: true })).code, 2);
  add('live fetch network failure is exit 2', async () =>
    (await runFor(FIXTURE_COMMITTED_RAW, { activeThrows: true })).code, 2);
  add('empty managedRules on live is exit 2, not read as "no drift"', async () =>
    (await runFor({ ...FIXTURE_COMMITTED_RAW, managedRules: {} })).code, 2);
  add('managedRules literally null on live is exit 2, not a thrown TypeError', async () =>
    (await runFor({ ...FIXTURE_COMMITTED_RAW, managedRules: null })).code, 2);
  add('two committed rules sharing an id is exit 2, not silent shadowing', async () => {
    const dup = clone(FIXTURE_COMMITTED_RAW);
    dup.rules.push({ ...clone(dup.rules[0]), name: 'Duplicate id, different rule' });
    return (await runFor(clone(FIXTURE_COMMITTED_RAW), { committedRaw: dup })).code;
  }, 2);

  // --- The clean case ---
  add('identical live config is exit 0', async () =>
    (await runFor(clone(FIXTURE_COMMITTED_RAW))).code, 0);

  // --- Drift, one field family at a time, each asserting the SPECIFIC path ---
  const namesPath = async (mutate, wantPath) => {
    const live = clone(FIXTURE_COMMITTED_RAW);
    mutate(live);
    const r = await runFor(live);
    return r.code === 1 && r.findings.some((f) => f.path === wantPath) ? 'named:' + wantPath : 'MISSED:' + JSON.stringify(r);
  };
  add('managedRules.bot_protection.action drift is named',
    () => namesPath((l) => { l.managedRules.bot_protection.action = 'challenge'; }, 'managedRules.bot_protection.action'),
    'named:managedRules.bot_protection.action');
  add('a managedRules key entirely missing on live is named as a whole',
    () => namesPath((l) => { delete l.managedRules.ai_bots; }, 'managedRules.ai_bots'),
    'named:managedRules.ai_bots');
  add('crs.sqli.active drift is named',
    () => namesPath((l) => { l.crs.sqli.active = false; }, 'crs.sqli.active'),
    'named:crs.sqli.active');
  add('a rule removed on live is named by id',
    () => namesPath((l) => { l.rules = []; }, 'rules[rule_x]'),
    'named:rules[rule_x]');
  add('a rule added on live is named by id',
    () => namesPath((l) => { l.rules.push({ ...clone(l.rules[0]), id: 'rule_new', name: 'Surprise' }); }, 'rules[rule_new]'),
    'named:rules[rule_new]');
  add('a rule field change is named to the specific field',
    () => namesPath((l) => { l.rules[0].active = false; }, 'rules[rule_x].active'),
    'named:rules[rule_x].active');
  add('a rule conditionGroup change is named',
    () => namesPath((l) => { l.rules[0].conditionGroup[0].conditions[0].value = '/api/y'; }, 'rules[rule_x].conditionGroup'),
    'named:rules[rule_x].conditionGroup');
  add('firewallEnabled drift is named',
    () => namesPath((l) => { l.firewallEnabled = false; }, 'firewallEnabled'),
    'named:firewallEnabled');
  add('ips drift is named',
    () => namesPath((l) => { l.ips = ['1.2.3.4']; }, 'ips'),
    'named:ips');

  // --- Server-assigned fields must never present as drift, or a successful
  //     apply-firewall.mjs restore would leave this guard red forever. ---
  add('updatedAt / valid / validationErrors never present as drift', async () => {
    const live = clone(FIXTURE_COMMITTED_RAW);
    live.managedRules.bot_protection.updatedAt = '2099-01-01T00:00:00.000Z';
    live.rules[0].valid = false;
    live.rules[0].validationErrors = ['nonsense'];
    return (await runFor(live)).code;
  }, 0);

  // --- R5: the canary must drive main(), the actual process.exitCode owner,
  //     not merely the pure rule functions underneath it. ---
  add('main() itself returns 0 on a clean run', () =>
    main([], {
      env: { VERCEL_TOKEN: 'tok' },
      fetchImpl: fetchFor(clone(FIXTURE_COMMITTED_RAW)),
      readCommitted: () => JSON.stringify(FIXTURE_COMMITTED_RAW),
      out: () => {}, err: () => {},
    }), 0);
  add('main() itself returns 2 with no token', () =>
    main([], { env: {}, out: () => {}, err: () => {} }), 2);

  let pass = 0;
  for (const c of cases) {
    let actual;
    try { actual = await c.run(); } catch (error) { actual = 'THREW: ' + error.message; }
    const ok = actual === c.expected;
    if (ok) pass++;
    else console.error(`  FAIL  ${c.name} -- expected ${JSON.stringify(c.expected)}, got ${JSON.stringify(actual)}`);
  }
  console.log(`check-firewall-drift self-test: ${pass}/${cases.length} passed`);
  return pass === cases.length;
}

// Realpath-to-realpath (scripts/lib/entry-point.mjs). The raw import.meta vs
// argv[1] string compare it replaces mispredicts through a junction or
// symlink and the whole guard -- including its own canary -- prints nothing
// and exits 0. Placed LAST: main() -> selfTest() reaches every `const`
// fixture above it, and this is a top-level `await`, so it must not run
// until the whole module body has executed.
if (isEntryPoint(import.meta.url)) {
  // process.exitCode, never process.exit() after printing: on Linux CI a
  // process.exit truncates buffered stdout (measured elsewhere in this repo:
  // 904 lines became 194).
  process.exitCode = await main(process.argv.slice(2));
}

function runFor(liveRaw, opts = {}, envOverrides = {}) {
  return runCheck({
    env: { VERCEL_TOKEN: 'tok', ...envOverrides },
    fetchImpl: fetchFor(liveRaw, opts),
    readCommitted: opts.readCommittedThrows
      ? () => { throw new Error('disk gone'); }
      : () => JSON.stringify(opts.committedRaw ?? FIXTURE_COMMITTED_RAW),
    log: () => {},
  });
}
