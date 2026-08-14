#!/usr/bin/env node
/**
 * CI contract check: is the og-scrape EVIDENCE RECORDER still running?
 *
 * public.og_scrape_outcome_log is the only durable record of what Facebook
 * returned to our OG scrape POSTs. pg_net's net._http_response has a 6-hour
 * ttl, so without the snapshot job every outcome is erased four times a day.
 * The 2026-08-11 rate-limit storm lost all 221 of its 403s exactly that way,
 * and the arc then spent seven review rounds designing against a number nobody
 * had. The job that fills the log, cron 'og-scrape-outcome-snapshot' (star/30),
 * is scheduled BY HAND -- no migration creates it -- so if it stops, nothing
 * goes red and the evidence silently resumes self-deleting.
 *
 * Reads check_og_render_health_v1().snapshot (admin migration 20260814130000).
 *
 * WHAT THIS DELIBERATELY DOES NOT CHECK
 * ------------------------------------
 * Log FRESHNESS. Measured 2026-08-14: the job had succeeded 48/48 over 24
 * hours while the newest log write was 199 minutes old. Both facts correct --
 * the scrape backlog was clear, so the drain issued no Graph POSTs, so there
 * were no outcomes to record, so the snapshot correctly wrote no row. A
 * freshness floor would red CI on a healthy idle system, and a guard that reds
 * on ordinary quiet gets muted -- which is the falsely-trusted check this arc
 * exists to remove.
 *
 *   Log freshness answers "has there been scrape traffic lately?".
 *   Cron run history answers "is the recorder still running?".
 *
 * Only the second is the hole being closed. They are not the same question,
 * and conflating them is what made the first draft of this guard wrong.
 *
 * Coverage-vs-traffic (if POSTs exist in net._http_response, buckets must
 * cover them) is a real and still-unguarded gap. Declared, not omitted.
 *
 * EXIT CODES (R3)
 *   0  the recorder is running
 *   1  contract violated -- the recorder is stopped, gone, duplicated or failing
 *   2  infrastructure -- could not measure (no credentials, RPC absent,
 *      un-migrated payload, cron tables unreadable). Never a green 0.
 *
 * Local:  node scripts/check-og-scrape-evidence.mjs        (reads .env)
 * Canary: node scripts/check-og-scrape-evidence.mjs --self-test
 * CI:     VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
 */
import fs from 'node:fs';
import { isEntryPoint } from './lib/entry-point.mjs';

/** star/30 plus two missed ticks of slack. Wide enough that one slow tick is
 *  not a red; narrow enough that a stopped recorder surfaces inside 2 hours.
 *  It lives here, not in the database, so tuning it is a script edit rather
 *  than a reviewed-stamped-applied migration. */
export const WINDOW_MINUTES = 90;

/** The payload version that first carried `snapshot`. A consumer written
 *  against 2 reads every snapshot key as undefined, and undefined compares
 *  false against every threshold -- the fail-open the marker exists to stop. */
export const MIN_SCHEMA_VERSION = 3;

/** pg_cron's own vocabulary. succeeded/failed are TERMINAL; the rest mean a
 *  tick is IN FLIGHT and are neither red nor green -- the job runs every 30
 *  minutes, so a poll can land mid-tick. Scoring those as failures is how the
 *  first draft would have redded a healthy system. */
export const IN_FLIGHT = new Set(['starting', 'running', 'sending', 'connecting']);

export class CannotMeasure extends Error {}

/**
 * The whole decision, as a pure function of the payload. No network, no clock
 * beyond `now`, no filesystem -- so the canary drives exactly this and every
 * branch is reachable from a fixture.
 *
 * Returns { code, violations, notes, checks } where `checks` counts the
 * assertions that were actually EVALUATED. A guard that returns 0 having
 * evaluated nothing is the failure mode this whole suite exists to prevent,
 * so the caller asserts a floor on it rather than trusting the code alone.
 */
export function evaluate(payload, now = Date.now()) {
  const violations = [];
  const notes = [];
  let checks = 0;

  if (payload === null || typeof payload !== 'object') {
    throw new CannotMeasure('the RPC returned ' + JSON.stringify(payload) + ', expected an object');
  }

  const version = Number(payload.schema_version);
  if (!Number.isFinite(version)) {
    throw new CannotMeasure('payload carries no numeric schema_version; this is not check_og_render_health_v1');
  }
  if (version < MIN_SCHEMA_VERSION) {
    throw new CannotMeasure(
      'payload schema_version is ' + version + ', need >= ' + MIN_SCHEMA_VERSION +
      '. Admin migration 20260814130000 has not been applied, so `snapshot` is absent. ' +
      'Reading it anyway would compare undefined against every threshold and pass.'
    );
  }
  checks++;

  const snap = payload.snapshot;
  if (snap === null || typeof snap !== 'object') {
    throw new CannotMeasure('schema_version is ' + version + ' but `snapshot` is ' + JSON.stringify(snap));
  }

  // readable=false is "this reading was not taken", never a zero and never a
  // timestamp. It is INFRASTRUCTURE, not a violation: the cron tables were
  // unreachable, which says nothing about whether the job is running. Treating
  // it as a violation would blame the recorder for a permissions change.
  if (snap.readable !== true) {
    throw new CannotMeasure(
      'cron read failed: readable=' + JSON.stringify(snap.readable) +
      ' SQLSTATE=' + JSON.stringify(snap.read_error ?? null) +
      ' detail=' + JSON.stringify(snap.read_detail ?? null) +
      ' (ran_as=' + JSON.stringify(snap.ran_as ?? null) +
      ' bypassrls=' + JSON.stringify(snap.ran_as_bypassrls ?? null) + ')'
    );
  }
  checks++;

  // ---- the job itself ------------------------------------------------------
  // RLS on cron.job FILTERS rather than raising, so a definer that lost its
  // exemption reads as job_count=0 too. The message has to say so, or an
  // operator reschedules a job that is already running and ends up with two.
  const jobCount = Number(snap.job_count);
  if (jobCount === 0) {
    violations.push(
      'NO cron job invokes _og_scrape_snapshot_outcomes. Scrape evidence is being deleted at 6h ' +
      'with nothing recording it. Before rescheduling, confirm this is a deleted job and NOT a lost ' +
      'RLS exemption: ran_as=' + JSON.stringify(snap.ran_as ?? null) +
      ' bypassrls=' + JSON.stringify(snap.ran_as_bypassrls ?? null) + '.'
    );
  } else if (jobCount > 1) {
    violations.push(jobCount + ' cron jobs invoke _og_scrape_snapshot_outcomes -- duplicate schedules double-write the log.');
  }
  checks++;

  // A DEACTIVATED job keeps job_count=1 and a recent last_tick_at, so neither
  // of the checks around this one fires while nothing is being snapshotted.
  if (jobCount === 1 && snap.job_active !== true) {
    violations.push('the job exists but is NOT ACTIVE (job_active=' + JSON.stringify(snap.job_active) + '). Nothing is snapshotting.');
  }
  checks++;

  // ---- has it actually ticked? --------------------------------------------
  // Only meaningful when exactly one job exists; with zero there is nothing to
  // have ticked, and the violation above already says so.
  if (jobCount === 1) {
    const tick = snap.last_tick_at;
    if (tick === null || tick === undefined) {
      violations.push('the job exists but has not run inside the cron read window.');
    } else {
      const t = Date.parse(tick);
      if (!Number.isFinite(t)) {
        throw new CannotMeasure('last_tick_at is not a parseable timestamp: ' + JSON.stringify(tick));
      }
      const ageMin = Math.floor((now - t) / 60000);
      if (ageMin > WINDOW_MINUTES) {
        violations.push(
          'the recorder last ran ' + ageMin + ' minutes ago, over the ' + WINDOW_MINUTES +
          '-minute window. It runs star/30, so this is a stopped or stuck job.'
        );
      }
      // A tick in the FUTURE means clock skew between the runner and the
      // database, not health. Reported, never silently floored to 0 -- a
      // negative age would otherwise read as "very fresh" for ever.
      if (ageMin < -5) {
        notes.push('last_tick_at is ' + Math.abs(ageMin) + ' minutes in the FUTURE; runner and database clocks disagree.');
      }
    }
    checks++;

    const status = String(snap.last_status ?? '');
    if (status === 'failed') {
      violations.push('the most recent tick FAILED (last_status=failed). The recorder is scheduled but erroring.');
    } else if (IN_FLIGHT.has(status)) {
      notes.push('a tick was in flight at poll time (last_status=' + status + '); neither red nor green.');
    } else if (status !== 'succeeded' && status !== '') {
      notes.push('unrecognised pg_cron status ' + JSON.stringify(status) + '; treated as neither red nor green.');
    }
    checks++;
  }

  // ---- non-vacuity of the log itself --------------------------------------
  // null is UNKNOWN (the read was not taken), not false. Encoding it as false
  // would announce "the evidence chain has never worked", a far louder and
  // different claim; encoding it as true would fail open.
  const hasRows = payload.snapshot_log_has_rows;
  if (hasRows === null || hasRows === undefined) {
    throw new CannotMeasure('snapshot_log_has_rows is ' + JSON.stringify(hasRows) + ' -- the log could not be read');
  }
  if (hasRows !== true) {
    violations.push(
      'og_scrape_outcome_log is EMPTY. No amount of quiet explains that: an idle system stops ' +
      'ADDING rows, it does not lose the ones it has. The evidence chain has never worked.'
    );
  }
  checks++;

  return { code: violations.length ? 1 : 0, violations, notes, checks };
}

/** The floor R1 asks for. A payload that somehow reached the end having
 *  evaluated almost nothing must not report a green. */
export const MIN_CHECKS = 5;

export function loadEnv(readFile = fs.readFileSync, exists = fs.existsSync, base = process.env) {
  const env = { ...base };
  if (exists('.env')) {
    for (const raw of String(readFile('.env', 'utf8')).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx < 0) continue;
      const k = line.slice(0, idx).trim();
      if (env[k] === undefined) env[k] = line.slice(idx + 1).replace(/^"|"$/g, '');
    }
  }
  return env;
}

/** Default collaborator. Injected so the canary never opens a socket. */
export async function fetchHealthLive(env) {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Missing credentials are 2, never a green skip (R1/R3). A guard that
    // passes because it could not run is worse than one that fails.
    throw new CannotMeasure('missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  }
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc('check_og_render_health_v1');
  if (error) {
    // Not swallowed (R2). PGRST202 in particular means the schema cache has
    // not caught up with a just-applied migration -- infrastructure, not drift.
    throw new CannotMeasure('RPC check_og_render_health_v1 failed: ' + error.code + ' ' + error.message);
  }
  return data;
}

/**
 * The exit owner. Everything the canary needs is injected, so the canary can
 * drive THIS function -- not a re-implementation of it -- with no network, no
 * credentials and no filesystem (R5).
 */
export async function main(argv = [], deps = {}) {
  const out = deps.log || console.log;
  const err = deps.err || console.error;
  const now = deps.now || Date.now();

  if (argv.includes('--self-test')) return selfTest({ log: out, err });

  let payload;
  try {
    const env = deps.env || loadEnv();
    payload = await (deps.fetchHealth || fetchHealthLive)(env);
  } catch (error) {
    err('og-scrape evidence: CANNOT MEASURE -- ' + error.message);
    err('  This is exit 2, not a pass. Nothing was checked.');
    return 2;
  }

  // Injectable so the canary can drive the measurement-floor branch below.
  // Mutation found that branch unreachable from any valid payload -- deleting
  // the floor scored ZERO failing cases, which is the blind spot, not a pass.
  const assess = deps.evaluate || evaluate;

  let result;
  try {
    result = assess(payload, now);
  } catch (error) {
    if (error instanceof CannotMeasure) {
      err('og-scrape evidence: CANNOT MEASURE -- ' + error.message);
      err('  This is exit 2, not a pass. Nothing was checked.');
      return 2;
    }
    throw error;
  }

  // The measurement floor. Reaching a verdict having evaluated fewer
  // assertions than the least any valid payload can produce means the logic
  // short-circuited, and a 0 from there would be a lie.
  if (result.checks < MIN_CHECKS) {
    err('og-scrape evidence: CANNOT MEASURE -- only ' + result.checks + ' assertion(s) evaluated, floor is ' + MIN_CHECKS + '.');
    return 2;
  }

  for (const n of result.notes) out('  note: ' + n);

  if (result.code === 0) {
    out('og-scrape evidence recorder: OK (' + result.checks + ' assertions).');
    out('  NOTE: log freshness is deliberately NOT gated -- it is traffic-dependent.');
    return 0;
  }

  err('og-scrape evidence recorder: CONTRACT VIOLATED');
  for (const v of result.violations) err('  - ' + v);
  err('  Inspect: SELECT jobname, active, schedule, command FROM cron.job;');
  return 1;
}

// ---------------------------------------------------------------------------
// CANARY (R4). Every case drives main() -- the function whose return value
// becomes process.exitCode -- with injected collaborators, so the EXIT CODES
// are measured and not merely asserted (R5).
//
// Each case pins WHICH BRANCH produced its code by matching the message. Four
// different branches here return 2; a case asserting only "it returned 2"
// passes for the wrong reason, which is how a canary scores 16/16 while
// believing a bug.
//
// Memoised, never hoisted to an eager const: spreading a fixture during
// case-list construction dies with "Cannot access before initialization" and
// surfaces as THE CANARY COULD NOT RUN rather than a named FAIL.
// ---------------------------------------------------------------------------
const NOW = Date.parse('2026-08-14T13:00:00Z');
function healthy() {
  return {
    schema_version: 3,
    snapshot_log_has_rows: true,
    drain: { readable: true, job_count: 1 },
    snapshot: {
      readable: true, read_error: null, read_detail: null,
      ran_as: 'postgres', ran_as_bypassrls: true,
      job_count: 1, job_active: true,
      last_tick_at: '2026-08-14T12:45:00Z', last_status: 'succeeded',
    },
  };
}
/** Deep-ish clone with a patched snapshot. */
function withSnap(patch) {
  const h = healthy();
  return { ...h, snapshot: { ...h.snapshot, ...patch } };
}

export function canaryCases() {
  return [
    { name: 'healthy -> 0', payload: healthy(), code: 0, expect: /recorder: OK/ },
    { name: 'in-flight tick is neither red nor green -> 0',
      payload: withSnap({ last_status: 'running' }), code: 0, expect: /in flight/ },

    { name: 'job deleted -> 1 (no job branch)',
      payload: withSnap({ job_count: 0 }), code: 1, expect: /NO cron job invokes/ },
    { name: 'duplicate schedules -> 1 (duplicate branch)',
      payload: withSnap({ job_count: 2 }), code: 1, expect: /duplicate schedules/ },
    { name: 'deactivated job -> 1 (job_active branch)',
      payload: withSnap({ job_active: false }), code: 1, expect: /NOT ACTIVE/ },
    { name: 'stale tick -> 1 (window branch)',
      payload: withSnap({ last_tick_at: '2026-08-14T09:00:00Z' }), code: 1, expect: /over the 90-minute window/ },
    { name: 'never ticked -> 1 (null tick branch)',
      payload: withSnap({ last_tick_at: null }), code: 1, expect: /has not run inside the cron read window/ },
    { name: 'last tick failed -> 1 (failed branch)',
      payload: withSnap({ last_status: 'failed' }), code: 1, expect: /most recent tick FAILED/ },
    { name: 'empty log -> 1 (non-vacuity branch)',
      payload: { ...healthy(), snapshot_log_has_rows: false }, code: 1, expect: /is EMPTY/ },

    // --- THE EXIT-CODE CONTRACT ITSELF: four distinct roads to 2 ------------
    { name: 'un-migrated payload -> 2 (schema_version branch)',
      payload: { schema_version: 2, ready: 1 }, code: 2, expect: /schema_version is 2, need >= 3/ },
    { name: 'cron unreadable -> 2 (readable branch)',
      payload: withSnap({ readable: false, read_error: '42501' }), code: 2, expect: /cron read failed.*42501/ },
    { name: 'log unreadable -> 2 (unknown-not-false branch)',
      payload: { ...healthy(), snapshot_log_has_rows: null }, code: 2, expect: /log could not be read/ },
    { name: 'not the right function -> 2 (no version branch)',
      payload: { hello: 'world' }, code: 2, expect: /no numeric schema_version/ },
    { name: 'null payload -> 2 (shape branch)',
      payload: null, code: 2, expect: /expected an object/ },
    { name: 'missing credentials -> 2, never a green skip',
      throws: new CannotMeasure('missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY'),
      code: 2, expect: /missing VITE_SUPABASE_URL/ },
    // Drives the floor itself. No valid payload can evaluate below MIN_CHECKS,
    // so without an injected assessor this branch is unreachable and deleting
    // it is invisible -- measured by mutation, not assumed.
    { name: 'short-circuited assessment -> 2 (measurement floor branch)',
      payload: healthy(), code: 2, expect: /assertion\(s\) evaluated, floor is 5/,
      evaluate: () => ({ code: 0, violations: [], notes: [], checks: 1 }) },
  ];
}

export async function selfTest({ log = console.log, err = console.error } = {}) {
  const cases = canaryCases();
  let failed = 0;

  for (const c of cases) {
    const lines = [];
    const sink = (s) => lines.push(String(s));
    const code = await main([], {
      log: sink,
      err: sink,
      now: NOW,
      env: {},
      evaluate: c.evaluate,
      fetchHealth: async () => {
        if (c.throws) throw c.throws;
        return c.payload;
      },
    });
    const text = lines.join('\n');
    const codeOk = code === c.code;
    const msgOk = c.expect.test(text);
    if (codeOk && msgOk) {
      log('  PASS  ' + c.name);
    } else {
      failed++;
      err('  FAIL  ' + c.name);
      if (!codeOk) err('        expected exit ' + c.code + ', got ' + code);
      // The branch pin. Without this a case passes on the right code from the
      // wrong branch -- four cases here return 2 for four different reasons.
      if (!msgOk) err('        exit code was right but no branch matched ' + c.expect + '\n        got: ' + text);
    }
  }

  // Positive control on the floor constant. MIN_CHECKS is the LEAST any valid
  // payload can evaluate (job_count 0 or >1 skips the two tick assertions), so
  // it is pinned to a measured minimum, not guessed. If evaluate() ever
  // evaluates fewer on that path, the floor stops meaning anything.
  const fewest = evaluate(withSnap({ job_count: 0 }), NOW).checks;
  if (fewest !== MIN_CHECKS) {
    failed++;
    err('  FAIL  MIN_CHECKS is ' + MIN_CHECKS + ' but the sparsest valid payload evaluates ' + fewest);
  } else {
    log('  PASS  MIN_CHECKS equals the sparsest valid payload (' + fewest + ')');
  }

  // And the richest, so the floor cannot be met by a path that checks nothing.
  const most = evaluate(healthy(), NOW).checks;
  if (most <= fewest) {
    failed++;
    err('  FAIL  healthy payload evaluates ' + most + ', not more than the sparsest ' + fewest);
  } else {
    log('  PASS  healthy payload evaluates more (' + most + ' > ' + fewest + ')');
  }

  if (failed) {
    err('canary: ' + failed + ' of ' + (cases.length + 2) + ' FAILED');
    return 2;
  }
  log('canary: ' + (cases.length + 2) + '/' + (cases.length + 2) + ' passed');
  return 0;
}

// Realpath-to-realpath (scripts/lib/entry-point.mjs) -- R6. A hand-rolled
// import.meta/argv[1] compare mispredicts through a junction and the whole
// guard, canary included, prints nothing and exits 0.
if (isEntryPoint(import.meta.url)) {
  // process.exitCode, never process.exit() after printing: on Linux CI a
  // process.exit truncates buffered stdout.
  process.exitCode = await main(process.argv.slice(2));
}
