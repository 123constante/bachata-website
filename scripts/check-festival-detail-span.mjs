#!/usr/bin/env node
/**
 * CI contract check #64 -- festival DETAIL date-span (2026-08-06).
 *
 * Calls public.check_festival_detail_span_v1(), which asserts that
 * get_public_festival_detail_v2(...).dates matches the canonical program-day
 * span (_p5_festival_span_v1) for every LIVE festival.
 *
 * Why this exists SEPARATELY from check #40: #40
 * (check_festival_occurrence_span_v1) measures the CALENDAR read path
 * (get_calendar_events_v2), which was moved onto the program-day canon by the
 * program-day-canonical rework and is correct. The DETAIL read path never
 * got that fix. On 2026-08-06 #40 reported "7 live festivals, 0 drift" while
 * three detail pages rendered the wrong span:
 *
 *   AB Intl Congress     dates 2027-03-26..2027-03-27, program 26..29 (2 lost)
 *   London Sensual Days  dates 2026-06-19..2026-06-22, program 19..21 (phantom)
 *   BOS Mallorca         dates 2026-10-22..2026-10-26, program 22..25 (phantom)
 *
 * A green #40 next to three broken pages is the exact gap this closes: the
 * two public read paths must agree about the same festival.
 *
 * The wrong span is not cosmetic -- dates.endsAt also feeds the page JSON-LD
 * endDate (Google) and the .ics / Google / Outlook calendar exports.
 *
 * DEPLOY ORDER MATTERS, and this step is PR-BLOCKING (the workflow fires on
 * pull_request to main, not only nightly). The guard shipped by admin
 * migration 20260807082141 carries a known defect: a festival with program
 * days but NO anchor date yields a NULL canonical span, which its drift
 * filter reports as drift forever against a page that renders correctly.
 * Admin migration 20260807110000 supersedes that body (CREATE OR REPLACE)
 * and classifies the shape as no_anchor instead. THIS CHECK MUST NOT BE
 * MERGED BEFORE 20260807110000 IS APPLIED -- otherwise the first anchorless
 * festival blocks every Website PR with a red no read-path edit can clear.
 * The startup assertion below refuses to run against the superseded guard
 * rather than leaving that to a comment nobody reads.
 *
 * GATING: status must be 'ok' (drift_count = 0). no_program_days and
 * no_anchor are REPORTED, never gating -- an indeterminate span is check
 * #40's to own, and failing twice for one data problem just teaches people
 * to ignore a red. But a run that compared ZERO festivals is BLIND, not
 * green, and fails: a guard that gets quieter as it stops measuring is the
 * check-sourcemap-debugids defect this repo already paid for once.
 *
 * Exit codes (repo convention, R3): 0 contract holds, 1 contract violated,
 * 2 the check could not run (credentials, network, timeout, missing module).
 * A thrown error anywhere is 2, never a stack trace masquerading as drift.
 *
 * Local:  node scripts/check-festival-detail-span.mjs     (reads .env)
 * Canary: node scripts/check-festival-detail-span.mjs --self-test
 * CI:     env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 */
import fs from 'node:fs';
import path from 'node:path';

/** Hard ceiling on the RPC round trip. The job budget is 5 minutes for ~60
 *  sequential steps, and this one loops get_public_festival_detail_v2 per live
 *  festival, so a stall here would starve the ~23 contract checks after it --
 *  including the raffle security posture gate. Fail fast as infra (exit 2)
 *  rather than silently eating the budget. */
const RPC_TIMEOUT_MS = 20_000;

function loadEnv() {
  const env = { ...process.env };
  if (fs.existsSync('.env')) {
    const file = fs.readFileSync('.env', 'utf8');
    for (const raw of file.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx < 0) continue;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).replace(/^"|"$/g, '');
      if (env[k] === undefined) env[k] = v;
    }
  }
  return env;
}

// The anon 3s statement_timeout (57014) and network blips are infra noise,
// not gate drift -- retry once. Kept narrow on purpose: a bare "timeout"
// substring would over-match genuine errors. Same helper as
// check-venue-publish-gate.mjs, which calls a comparably heavy anon RPC.
export function isTransient(err) {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  return (
    code === '57014' ||
    msg.includes('statement timeout') ||
    msg.includes('canceling statement') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('network')
  );
}

/**
 * Is this "the guard itself is not deployed", as opposed to any error raised
 * from INSIDE the guard body?
 *
 * NARROW ON PURPOSE. A bare /does not exist/ also matches `relation "x" does
 * not exist` (42P01) and `column "y" does not exist` (42703) raised from
 * within the guard -- which is exactly what Stage E dropping a dependency
 * will produce. Those are infrastructure (exit 2), not a contract violation
 * (exit 1), and routing them here would hand the operator a remediation
 * ("apply migration X") that cannot possibly help. So the name-shaped arms
 * require the function name to appear alongside.
 */
export function isFunctionMissing(err) {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  if (code === 'PGRST202') return true; // PostgREST: no such function in schema cache
  const namesTheGuard = /check_festival_detail_span_v1/i.test(msg);
  if (code === '42883') return namesTheGuard || /function/i.test(msg);
  if (/schema cache/i.test(msg)) return true; // PostgREST-specific wording
  return namesTheGuard && /does not exist|could not find the function/i.test(msg);
}

/**
 * Is the deployed guard the pre-20260807110000 body? That one emits no
 * `no_anchor` key; the current body always emits it, even as 0. Pure, so the
 * canary can prove both directions rather than leaving this branch untested
 * inside main().
 */
export function isSupersededGuardBody(data) {
  return data != null && data.no_anchor === undefined;
}

/**
 * Pure verdict over the RPC payload. Returns { code, out, err } where out/err
 * are the lines to print. Exercised by the canary; main() only does I/O.
 */
export function evaluate(data) {
  const out = [];
  const err = [];

  if (data == null) {
    err.push(
      'FAIL: check_festival_detail_span_v1 returned NULL -- the guard broke, ' +
        'which is a contract violation in itself.',
    );
    return { code: 1, out, err };
  }

  out.push(JSON.stringify(data, null, 2));

  const total = Number(data.festivals_total ?? 0);
  const noDays = Number(data.no_program_days ?? 0);
  const noAnchor = Number(data.no_anchor ?? 0);
  // What the drift CTE actually compared. Printing "N live festivals verified"
  // off `total` was measured to overstate: total counts every live festival,
  // while the comparison skips the indeterminate ones.
  const compared = Math.max(0, total - noDays - noAnchor);

  if (noDays > 0) {
    out.push(
      `\nnote: ${noDays} live festival(s) have no program days, ` +
        'so their span is indeterminate here. Non-gating -- check #40 owns that.',
    );
  }

  // Emitted by the guard from admin migration 20260807110000 onward.
  if (noAnchor > 0) {
    out.push(
      `\nnote: ${noAnchor} live festival(s) have program days but no anchor date ` +
        '(no default_start_date, no occurrence rows), so the canon is indeterminate ' +
        'and the page serves its occurrence-derived fallback. Non-gating; fix the data.',
    );
  }

  if (data.status !== 'ok') {
    err.push(
      `\nFESTIVAL DETAIL SPAN FAIL: ${data.drift_count ?? '?'} live festival(s) ` +
        'have a detail-page date span that disagrees with their program-day ' +
        'structure. See drift_sample above: detail_* is what the festival page ' +
        '(and its JSON-LD endDate and .ics export) is publishing; canonical_* is ' +
        'what the program days say.\n' +
        '      Two known shapes: an end that crosses midnight leaks a phantom ' +
        'trailing day, and a multi-occurrence festival truncates to day 0.\n' +
        '      Fix the read path, not the data -- see the ADMIN repo (this file ' +
        'is not in it): docs/festival-detail-span-delta.md.',
    );
    return { code: 1, out, err };
  }

  // NON-VACUITY. A pass over zero comparisons is not a pass. Gates only when
  // NOTHING was compared -- a partial skip stays non-gating so one data
  // problem does not red both #40 and #64.
  if (compared === 0) {
    err.push(
      `\nFESTIVAL DETAIL SPAN BLIND: the guard compared ZERO of ${total} live ` +
        `festival(s) (${noDays} without program days, ${noAnchor} without an anchor). ` +
        'Reporting "ok" here would be a green over an unmeasured population.\n' +
        '      This is not drift -- fix the data (or confirm there are genuinely ' +
        'no live festivals) before trusting this check.',
    );
    return { code: 1, out, err };
  }

  out.push(
    `\nfestival detail span: ok (${compared} of ${total} live festival(s) compared, ` +
      '0 drift; each publishes its program-day span).',
  );
  return { code: 0, out, err };
}

// NOTE: main() RETURNS its exit code rather than calling process.exit().
// process.exit() truncates buffered stdout on Linux CI (it does not on
// Windows), which silently swallowed most of a guard's output once already.
async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
    return 2;
  }

  // Imported dynamically so a missing/broken dependency is caught here and
  // reported as exit 2. A static import throws at MODULE LOAD, before any
  // handler exists, which would defeat the exit-code contract in the header.
  let createClient;
  try {
    ({ createClient } = await import('@supabase/supabase-js'));
  } catch (e) {
    console.error(`Could not load @supabase/supabase-js: ${e?.message ?? e}`);
    return 2;
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const callGuard = () => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), RPC_TIMEOUT_MS);
    return sb
      .rpc('check_festival_detail_span_v1')
      .abortSignal(ac.signal)
      .then((r) => r)
      .finally(() => clearTimeout(timer));
  };

  let { data, error } = await callGuard();
  if (error && isTransient(error)) {
    console.error(
      `Transient error (${error.code || '?'}: ${error.message}); retrying once in 2s...`,
    );
    await new Promise((r) => setTimeout(r, 2000));
    ({ data, error } = await callGuard());
  }

  if (error) {
    if (isFunctionMissing(error)) {
      console.error(
        `FAIL: check_festival_detail_span_v1 not found (${error.code ?? '?'}: ${error.message}).\n` +
          '      Apply the ADMIN migration that ships the current guard body:\n' +
          '      20260807110000_festival_detail_span_guard_series_pick_and_anchor_v1.sql\n' +
          '      (it CREATE OR REPLACEs the body first shipped by 20260807082141 --\n' +
          '      do NOT apply 082141 on its own, that reverts the deterministic\n' +
          '      series pick, the no_anchor classification and the timezone guard).',
      );
      return 1;
    }
    console.error(`Transport/unexpected error: ${error.code ?? '?'}: ${error.message}`);
    return 2;
  }

  // SOFT-PASS against the superseded guard body, matching the house convention
  // for a check that lands before its admin migration (check-slug-resolver-
  // parity.mjs, check-slug-presence.mjs, check-organiser-link-contract.mjs all
  // warn-and-pass "until the admin migration ships").
  //
  // Why not gate: the 082141 body reports permanent false drift on a festival
  // with program days but no anchor date, and emits no key that would let this
  // script tell that false drift from the real thing. Gating on it in a
  // PR-blocking workflow would produce a red no Website change can clear;
  // failing as infra (exit 2) would red the same PRs for a deploy-ordering
  // state that is nobody's bug. So it passes, loudly, and becomes a real gate
  // the moment 20260807110000 applies -- no merge-order constraint either way.
  if (isSupersededGuardBody(data)) {
    console.log(JSON.stringify(data, null, 2));
    console.warn(
      '\nWARNING -- NOT GATING YET. The deployed check_festival_detail_span_v1\n' +
        '      predates admin migration 20260807110000 (no `no_anchor` key in its\n' +
        '      payload). That body cannot distinguish real drift from its own known\n' +
        '      false-drift shape (program days present, anchor date absent), so this\n' +
        '      check reports rather than gates until the migration is applied.\n' +
        '      Apply 20260807110000 to turn this into a real gate.',
    );
    return 0;
  }

  const verdict = evaluate(data);
  for (const line of verdict.out) console.log(line);
  for (const line of verdict.err) console.error(line);
  return verdict.code;
}

/**
 * Canary (rule R4): prove the verdict logic can FAIL before trusting it to
 * pass. Pure -- no network, no credentials.
 *
 * Two properties the repo has paid for elsewhere and that this harness now
 * carries itself: a case that THROWS is recorded as a failure rather than
 * aborting the run before any result prints, and a run that executed fewer
 * than MIN_CASES cases fails rather than reporting "PASS -- 0 cases".
 */
const MIN_CASES = 18;

export function selfTest(log = console.log) {
  const cases = [];
  // Each assertion is evaluated inside the harness, so a throw becomes a FAIL
  // line instead of killing every case after it.
  const add = (name, fn, expected) => {
    let actual;
    try {
      actual = fn();
    } catch (e) {
      actual = `THREW: ${e?.message ?? e}`;
    }
    cases.push({ name, actual, expected });
  };

  const clean = { status: 'ok', festivals_total: 7, no_program_days: 0, no_anchor: 0, drift_count: 0 };
  const drifting = {
    status: 'drift',
    festivals_total: 7,
    no_program_days: 0,
    no_anchor: 0,
    drift_count: 3,
    drift_sample: [{ name: 'AB Intl' }],
  };

  // --- evaluate(), both directions ---
  add('a clean payload passes', () => evaluate(clean).code, 0);
  add('drift status FAILS with exit 1', () => evaluate(drifting).code, 1);
  add('the failure names its drift count', () => evaluate(drifting).err.join('\n').includes('3 live festival(s)'), true);
  add('a NULL payload is a contract violation (1), not a pass', () => evaluate(null).code, 1);
  add('an unknown status gates (fail-closed)', () => evaluate({ ...clean, status: 'wat' }).code, 1);

  // --- the skip counters: partial is non-gating, total blindness is not ---
  add('some festivals skipped still passes', () => evaluate({ ...clean, no_program_days: 2 }).code, 0);
  add('no_program_days is reported', () => evaluate({ ...clean, no_program_days: 2 }).out.join('\n').includes('no program days'), true);
  add('no_anchor is non-gating', () => evaluate({ ...clean, no_anchor: 1 }).code, 0);
  add('no_anchor is reported', () => evaluate({ ...clean, no_anchor: 1 }).out.join('\n').includes('no anchor'), true);
  add('ALL skipped is BLIND and FAILS', () => evaluate({ ...clean, no_program_days: 7 }).code, 1);
  add('blindness by anchor also FAILS', () => evaluate({ ...clean, no_anchor: 7 }).code, 1);
  add('blindness is worded as blind, not drift', () => evaluate({ ...clean, no_anchor: 7 }).err.join('\n').includes('BLIND'), true);
  add('zero live festivals is BLIND, not a silent green', () => evaluate({ ...clean, festivals_total: 0 }).code, 1);
  add('the pass line reports COMPARED, not total', () => evaluate({ ...clean, no_program_days: 2 }).out.join('\n').includes('5 of 7'), true);

  // --- error classification, both directions ---
  add('57014 is transient', () => isTransient({ code: '57014', message: 'x' }), true);
  add('a genuine SQL error is NOT transient', () => isTransient({ code: '42883', message: 'operator does not exist' }), false);
  add('PGRST202 in error.CODE is function-missing', () => isFunctionMissing({ code: 'PGRST202', message: 'x' }), true);
  add('schema-cache text is function-missing', () => isFunctionMissing({ message: 'Could not find the function in the schema cache' }), true);
  add('a permission error is NOT function-missing', () => isFunctionMissing({ code: '42501', message: 'permission denied' }), false);
  // The over-match this narrowing exists to stop: a dependency dropped by
  // Stage E raises from INSIDE the guard and must read as infra, not as a
  // missing guard with an unhelpful "apply migration X" remediation.
  add('relation-does-not-exist from inside the body is NOT function-missing', () => isFunctionMissing({ code: '42P01', message: 'relation "calendar_occurrences" does not exist' }), false);
  add('column-does-not-exist is NOT function-missing', () => isFunctionMissing({ code: '42703', message: 'column "venue_id" does not exist' }), false);

  // --- guard-body generation, both directions ---
  add('a payload without no_anchor is the SUPERSEDED body', () => isSupersededGuardBody({ status: 'ok', festivals_total: 7 }), true);
  add('a payload with no_anchor: 0 is the CURRENT body', () => isSupersededGuardBody(clean), false);
  add('a NULL payload is not classified as superseded', () => isSupersededGuardBody(null), false);

  let failed = 0;
  for (const c of cases) {
    const ok = c.actual === c.expected;
    if (!ok) failed++;
    log(`${ok ? '  ok  ' : '  FAIL'} ${c.name}${ok ? '' : ` (got ${JSON.stringify(c.actual)}, want ${JSON.stringify(c.expected)})`}`);
  }

  // Non-vacuity on the canary itself: "PASS -- 0 cases" must be impossible.
  if (cases.length < MIN_CASES) {
    log(`  FAIL non-vacuity: ran ${cases.length} case(s), expected at least ${MIN_CASES}`);
    failed++;
  }

  log(
    failed === 0
      ? `PASS self-test -- ${cases.length} cases, the contract proven in both directions.`
      : `FAIL self-test -- ${failed} failure(s) over ${cases.length} case(s).`,
  );
  return failed === 0;
}

// Only act when run as a CLI -- importing this module must not query or exit.
// Three sibling guards carry this; one records that going unguarded killed the
// test runner.
const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]).replace(/\\/g, '/').endsWith('/check-festival-detail-span.mjs');

if (invokedDirectly) {
  if (process.argv.includes('--self-test')) {
    process.exitCode = selfTest() ? 0 : 1;
  } else {
    // A throw anywhere is "the check could not run" -- exit 2, never 1.
    process.exitCode = await main().catch((e) => {
      console.error(`Transport/unexpected error: ${e?.message ?? e}`);
      return 2;
    });
  }
}
