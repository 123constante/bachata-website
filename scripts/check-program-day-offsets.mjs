#!/usr/bin/env node
/**
 * Contract: a festival's program-day set is itself well formed.
 *
 * WHY THIS EXISTS, when four guards already cover this area.
 *
 * Every one of them compares two DERIVED VIEWS of the same day set, so a defect
 * in the source appears identically on both sides and cancels:
 *
 *   #26 check_program_day_integrity_v1  -- legacy day date vs item rollover
 *       date. The mirror STAMPS item timestamps from the merged day's date, so
 *       the two agree by construction.
 *   #40 check_festival_occurrence_span_v1 -- calendar distinct dates vs
 *       count(DISTINCT date_offset_days). DISTINCT on both sides.
 *   #64 check_festival_detail_span_v1 -- detail endpoints vs anchor +/- max
 *       offset. Endpoints only; never the count between them.
 *
 * On 2026-08-19 "All Stars Festival" served a THREE day programme for a
 * Thu-Sun festival: two program days carried date_offset_days = 0, so Friday
 * 6 November existed in the editor and on no rendered surface. The legacy
 * mirror merged the pair via ON CONFLICT (event_id, event_date); the public
 * grid deduped again via new Set(schedule.map(s => s.day)). Two layers of
 * silent collapse, no error path.
 *
 * #40 did catch it -- but only by luck. The collision landed on a MIDDLE day,
 * leaving max(offset) intact so the calendar and the programme disagreed. Had
 * it landed on the LAST day (offsets {0,0,1,2}) max(offset) would have shrunk
 * with the count, both sides would have read 3, and every check would have been
 * green with a day still missing. That mutant is case M2 below.
 *
 * Exit codes (R3): 0 pass, 1 contract violated, 2 infrastructure.
 * Canary (R4/R5): node scripts/check-program-day-offsets.mjs --self-test
 */

import fs from 'node:fs';
import { isEntryPoint } from './lib/entry-point.mjs';

/** The RPC runs four small aggregates over ~420 series and one LATERAL over
 *  the live festivals. It shares a 5-minute job budget with ~60 sibling steps,
 *  so a stall is reported as infrastructure rather than allowed to eat it. */
const RPC_TIMEOUT_MS = 20_000;

/** The single retry's wait. Named so the log and the canary agree on it, and
 *  injectable through main()'s deps so the canary costs no wall clock. */
const RETRY_DELAY_MS = 2000;

/** The admin migration that ships the RPC. Named once so the "apply it"
 *  message and the "do NOT re-apply it" message cannot drift apart. */
const CHECK_MIGRATION = '20260819120109_program_day_offset_canonical_check_v1.sql';

/**
 * R1 (silent-skip) floors. A guard that reports "0 violations" over a sample it
 * never actually loaded is worse than no guard: a red check gets fixed, a
 * falsely green one is trusted for months.
 *
 * The two floors do DIFFERENT jobs, and they are set from different populations
 * rather than from one "well below the measurement" gesture.
 *
 * MIN_SERIES answers "did the read reach the table at all". Its population --
 * series carrying program days, archived included (arm 1 is scoped that way) --
 * is 413 today and only grows: events accumulate and archiving does not remove
 * their day rows. 50 is an eighth of it, so it cannot red on ordinary churn,
 * and it is far enough above 1 to survive a read that found one row and stopped.
 *
 * MIN_FESTIVALS answers only "are arms 2 and 3 vacuous", and its population
 * SHRINKS: festivals are archived once they have run, and London hosts few. It
 * was 3 against a measured 8 until review on 2026-08-19 pointed out that a
 * 2.7x margin on a shrinking set reds the build over correct data, on a check
 * whose own message tells the operator not to lower the floor. The vacuity it
 * guards has exactly one value -- zero -- so that is where it sits. Nothing is
 * lost: the SQL side is a count(*), not a traversal, so "found one and stopped"
 * is not a failure mode it has, and MIN_SERIES already proves the read landed.
 */
const MIN_SERIES = 50;
const MIN_FESTIVALS = 1;

/** The anon statement_timeout (57014) and network blips are infra noise, not
 *  contract drift -- retry once. Kept narrow so a bare "timeout" substring
 *  cannot over-match a genuine contract failure. */
export function isTransient(err) {
  if (!err) return false;
  // Coerced, never ===. Some transports surface the PG code as a NUMBER, and a
  // strict compare against the string then drops the retry entirely -- a
  // routine anon statement_timeout would red a 79-step job over the exact noise
  // this function exists to absorb.
  if (String(err.code ?? '') === '57014') return true;
  const msg = String(err.message ?? '').toLowerCase();
  return (
    msg.includes('statement timeout') ||
    msg.includes('canceling statement') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up')
  );
}

export const CHECK_FN = 'check_program_day_offset_canonical_v1';

/** The undefined-object shape, whatever it is ABOUT: 42883 (function), 42P01
 *  (relation), or PostgREST's own PGRST202. */
function looksUndefined(err) {
  const code = String(err.code ?? '');
  if (code === 'PGRST202' || code === '42883' || code === '42P01') return true;
  const msg = String(err.message ?? '').toLowerCase();
  return msg.includes('could not find the function') || msg.includes('does not exist');
}

/** PostgREST reports an UNDEPLOYED check as PGRST202. That is a CONTRACT
 *  failure (exit 1, the migration has not shipped), never infra -- otherwise an
 *  unapplied migration reads as a passing build.
 *
 *  The name test is the whole point, and it is why this no longer trusts a bare
 *  `does not exist`. The check RPC calls four things: _p5_festival_span_v1,
 *  _festival_anchor_dates_p5, event_series_p5 and event_series_program_day_p5.
 *  Drop or re-sign any of them and a body that IS deployed raises 42883/42P01
 *  from the inside, matching the same substring -- and the operator is then told
 *  to apply a migration that is already applied, against a cause the log never
 *  names. Missing DEPENDENCY and missing CHECK are different repairs. */
export function isFunctionMissing(err) {
  if (!err) return false;
  if (String(err.code ?? '') === 'PGRST202') return true;
  return looksUndefined(err) && String(err.message ?? '').includes(CHECK_FN);
}

/** The same shape, naming something OTHER than the check itself: the check is
 *  deployed and one of its dependencies is not. Still exit 1 -- a schema that
 *  cannot answer its own health check is a shipped defect, not infra noise --
 *  but it must not print the "apply the migration" instruction. */
export function isDependencyMissing(err) {
  if (!err) return false;
  return looksUndefined(err) && !isFunctionMissing(err);
}

const KNOWN_STATUSES = new Set(['ok', 'fail']);

/** The value the RPC stamps into its own `check` field. */
const CHECK_NAME = 'program_day_offset_canonical';

/** The three arms, each with the sentence a reader needs to act on it. Named
 *  here rather than inlined so the canary can assert every one is reachable.
 *
 *  "Reachable" is load-bearing and it is not satisfied by an arm the SQL merely
 *  permits. The third arm was FIRST written as
 *    (local_end - local_start + 1) <> program_day_count
 *  and was arithmetically dead: _p5_festival_span_v1 returns local_start =
 *  anchor and local_end = anchor + max(offset), so the anchor cancels and the
 *  predicate collapses to max(offset)+1 <> count(DISTINCT offset) -- the same
 *  three numbers arms 1 and 2 read straight off the table. Brute-forced over
 *  every offset multiset of length 1-5 drawn from 0-4: it never fired alone
 *  once. Replaced 2026-08-19. */
const ARMS = [
  ['duplicate_offsets',
   'series with two program days on the SAME calendar date -- the legacy mirror ' +
   'merges them and the public grid dedupes them, so a day vanishes from the page'],
  ['non_contiguous',
   'festival(s) whose day offsets have a GAP -- the calendar fills ' +
   'anchor..anchor+max_offset contiguously, so a gap renders a phantom day no ' +
   'programme backs. UNIQUE (series_id, date_offset_days) cannot see this'],
  ['unplaceable_span',
   'festival(s) carrying a programme that cannot be PLACED on a calendar -- ' +
   '_p5_festival_span_v1 returns NULL endpoints because the anchor, ' +
   'COALESCE(default_start_date, min(occurrence_date)), resolves to nothing. ' +
   'The day rows are all well formed, so arms 1 and 2 read clean'],
];

/**
 * Pure verdict. No network, no credentials, no filesystem -- so the canary can
 * drive every branch.
 *
 * Returns { code, out, err } where code is the process exit code.
 */
export function evaluate(data) {
  const out = [];
  const err = [];

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    err.push(`FAIL: check_program_day_offset_canonical_v1 returned ${
      Array.isArray(data) ? 'an array' : String(data)}, expected a JSON object.`);
    return { code: 1, out, err };
  }

  // The payload names itself, so read the name. Without this, any
  // shape-compatible object -- a stale same-named function, a PostgREST schema
  // cache routed somewhere else, a future RPC that happens to answer with
  // status/series_total/festivals_total -- evaluates green as if it were this
  // contract. The field is free; not checking it is what makes it decoration.
  if (data.check !== CHECK_NAME) {
    err.push(
      `FAIL: payload identifies itself as ${JSON.stringify(data.check)}, not ` +
      `${JSON.stringify(CHECK_NAME)}. Something other than ` +
      `${CHECK_FN} answered this call.`,
    );
    return { code: 1, out, err };
  }

  const status = data.status;
  if (!KNOWN_STATUSES.has(status)) {
    err.push(`FAIL: unknown status ${JSON.stringify(status)}; expected one of ${
      [...KNOWN_STATUSES].join(', ')}.`);
    return { code: 1, out, err };
  }

  // R1: prove the sample was actually measured BEFORE trusting a green status.
  // An empty read and a clean database are indistinguishable from the outside;
  // only a floor separates them.
  const series = Number(data.series_total);
  const festivals = Number(data.festivals_total);

  if (!Number.isFinite(series) || series < MIN_SERIES) {
    err.push(
      `FAIL: measured only ${data.series_total} series carrying program days ` +
      `(floor ${MIN_SERIES}). Either the read did not reach the table or the ` +
      'floor is stale -- do NOT lower it without checking which.',
    );
    return { code: 1, out, err };
  }
  if (!Number.isFinite(festivals) || festivals < MIN_FESTIVALS) {
    err.push(
      `FAIL: measured only ${data.festivals_total} live festivals (floor ` +
      `${MIN_FESTIVALS}). The contiguity and span arms scan festivals only, so ` +
      'an empty festival set makes two of the three arms vacuous.',
    );
    return { code: 1, out, err };
  }

  const counts = ARMS.map(([key]) => Number(data[key]));
  if (counts.some((n) => !Number.isFinite(n))) {
    err.push(`FAIL: payload is missing an arm count; got keys ${
      Object.keys(data).join(', ')}.`);
    return { code: 1, out, err };
  }
  const total = counts.reduce((a, b) => a + b, 0);

  // The RPC contradicting its own arms is itself a defect -- an inconsistency
  // here means the status ladder and the counts have drifted apart, and
  // believing either one alone is how a guard goes quietly blind.
  if ((status === 'ok') !== (total === 0)) {
    err.push(
      `FAIL: payload is self-inconsistent -- status ${status} beside ${total} ` +
      'violation(s) across the three arms.',
    );
    return { code: 1, out, err };
  }

  if (status === 'ok') {
    out.push(
      `PASS program-day offsets canonical -- ${series} series (${festivals} live ` +
      'festivals): no duplicate dates, no gaps, every programme placeable.',
    );
    return { code: 0, out, err };
  }

  // NOT the sum. The arms overlap on the same series by design -- one festival
  // with a duplicated offset trips arm 1 and can trip arm 2 off that single
  // defect -- so adding them up reports one broken festival as "2 violations".
  // `total` keeps the one job it is sound for: the zero/non-zero consistency
  // test against `status`, above. What a red log needs is WHICH arms fired and
  // HOW MANY series are actually involved.
  const tripped = ARMS.filter(([key]) => Number(data[key]) > 0).map(([key]) => key);
  const sample = Array.isArray(data.sample) ? data.sample : [];
  const named = new Set(sample.map((s) => s?.series_id ?? s?.name).filter(Boolean));
  err.push(
    `FAIL program-day offsets: ${tripped.length} of ${ARMS.length} arm(s) tripped ` +
    `(${tripped.join(', ')}) over ${series} series` +
    (named.size > 0
      ? `; ${named.size} series named below${sample.length >= 10 ? ' (sample capped)' : ''}`
      : '') + '.',
  );
  for (const [key, why] of ARMS) {
    const n = Number(data[key]);
    if (n > 0) err.push(`  - ${key}: ${n} ${why}`);
  }
  if (sample.length > 0) {
    err.push('  offending series:');
    for (const s of sample) {
      // series_id FIRST. event_series_p5.name is not unique -- two "Bachata
      // Night" series are ordinary -- so a log naming only the display name
      // costs the operator the follow-up query the RPC selects series_id to
      // avoid. distinct_offsets and the span endpoints tell them which arm.
      err.push(`    ${s?.series_id ?? '?'} ${s?.name ?? '?'} ` +
        `[${s?.format ?? '?'}/${s?.lifecycle_status ?? '?'}] ` +
        `offsets=${JSON.stringify(s?.offsets ?? null)} ` +
        `rows=${s?.day_rows ?? '?'} distinct=${s?.distinct_offsets ?? '?'} ` +
        `span=${s?.local_start ?? 'NULL'}..${s?.local_end ?? 'NULL'}`);
    }
  }
  err.push('  Repair it in the ADMIN repo, then re-run. Do not relax this check.');
  return { code: 1, out, err };
}

/**
 * Env files, in precedence order, WITHOUT clobbering anything already exported
 * (CI supplies the values directly and must win).
 *
 * More than one name on purpose: this repo keeps its keys spread across
 * several, so a guard that reads only `.env` reports "missing credentials" in
 * a tree where they are plainly present -- which reads as a broken check
 * rather than a missing file.
 *
 * It does NOT rescue a fresh `git worktree`, and an earlier draft of this
 * comment claimed it did. These names resolve against process.cwd(); a worktree
 * holding none of the three still misses all three and still returns 2. Fixing
 * that means resolving upward from import.meta.url to the main worktree, which
 * is a different change with its own cross-repo hazard -- see the
 * `relative_path_resolves_in_wrong_repo` note. Documenting a defence that is
 * not there is worse than not having it.
 */
const ENV_FILES = ['.env.local', '.env', '.env.development'];

function loadEnv() {
  const env = { ...process.env };
  for (const name of ENV_FILES) {
    if (!fs.existsSync(name)) continue;
    for (const raw of fs.readFileSync(name, 'utf8').split(/\r?\n/)) {
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

async function connectAndCall(url, key) {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key, { auth: { persistSession: false } });
  return async () => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), RPC_TIMEOUT_MS);
    try {
      return await client
        .rpc('check_program_day_offset_canonical_v1')
        .abortSignal(ac.signal);
    } finally {
      clearTimeout(timer);
    }
  };
}

// R5 (unproven-exit-contract): main() is the SOLE owner of the exit code --
// `--self-test` dispatches THROUGH it rather than beside it -- and it takes
// injectable collaborators so selfTest() can drive it with no token, no network
// and no filesystem. R5 is static: it proves the canary CALLS this function, not
// that the assertions are worth anything, so every case below pins WHICH branch
// produced its code. Three branches here return 2; a case asserting only "it
// returned 2" would pass for the wrong reason.
async function main(argv = [], deps = {}) {
  const {
    loadEnvFn = loadEnv,
    connect = connectAndCall,
    log = console.log,
    // Every failure line went to an UNINJECTED console.error until 2026-08-19,
    // so a PASSING --self-test printed "FAIL: ... not found" and "Repair it in
    // the ADMIN repo" straight to stderr -- in the CI step that runs the canary
    // immediately before the live check, where the two outputs are adjacent and
    // a reader cannot tell a driven branch from a real violation. Silencing
    // only the reassuring half is worse than silencing neither.
    errLog = console.error,
    // The retry wait is a collaborator like any other. Left hard-coded, the
    // canary spent two real seconds of a `timeout-minutes: 5` job budget to
    // prove a branch that needs no clock at all.
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = deps;

  if (argv.includes('--self-test')) return (await selfTest(log)) ? 0 : 1;

  const env = loadEnvFn();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY;

  // R3: missing credentials are INFRASTRUCTURE (2), never a green 0 and never
  // a contract failure (1).
  if (!url || !key) {
    errLog('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
    return 2;
  }

  let callGuard;
  try {
    callGuard = await connect(url, key);
  } catch (e) {
    errLog(`Could not load @supabase/supabase-js: ${e?.message ?? e}`);
    return 2;
  }

  let { data, error } = await callGuard();
  if (error && isTransient(error)) {
    errLog(
      `Transient error (${error.code ?? '?'}: ${error.message}); retrying once ` +
      `in ${RETRY_DELAY_MS}ms...`,
    );
    await sleep(RETRY_DELAY_MS);
    ({ data, error } = await callGuard());
  }

  if (error) {
    if (isFunctionMissing(error)) {
      errLog(
        `FAIL: ${CHECK_FN} not found (${error.code ?? '?'}: ${error.message}).\n` +
          '      Apply the ADMIN migration that ships it:\n' +
          `      ${CHECK_MIGRATION}`,
      );
      return 1;
    }
    if (isDependencyMissing(error)) {
      // Deliberately NOT the message above. The same 42883/42P01 shape reaches
      // here when the check is deployed and one of the four things it calls is
      // not -- and sending the operator to re-apply a migration that is already
      // applied is a log that actively misdirects the fix.
      errLog(
        `FAIL: ${CHECK_FN} is deployed, but something it calls is not ` +
          `(${error.code ?? '?'}: ${error.message}).\n` +
          `      Do NOT re-apply ${CHECK_MIGRATION} -- it is already applied.\n` +
          '      The body depends on _p5_festival_span_v1,\n' +
          '      _festival_anchor_dates_p5, event_series_p5 and\n' +
          '      event_series_program_day_p5. The message above names the one\n' +
          '      that was dropped or re-signed.',
      );
      return 1;
    }
    errLog(`Transport/unexpected error: ${error.code ?? '?'}: ${error.message}`);
    return 2;
  }

  const verdict = evaluate(data);
  for (const line of verdict.out) log(line);
  for (const line of verdict.err) errLog(line);
  return verdict.code;
}

/** A healthy payload, overridable per case. Built from the LIVE shape measured
 *  on 2026-08-19 so the canary cannot drift away from what the RPC really
 *  returns. */
function payload(over = {}) {
  return {
    check: 'program_day_offset_canonical',
    status: 'ok',
    series_total: 413,
    festivals_total: 8,
    duplicate_offsets: 0,
    non_contiguous: 0,
    unplaceable_span: 0,
    sample: [],
    computed_at: '2026-08-19T12:00:00+00:00',
    ...over,
  };
}

/** Drive main() with everything injected: no token, no network, no filesystem,
 *  and no clock. `errSink`, when passed, collects the stderr lines so a case can
 *  assert WHICH message a branch produced rather than only which code -- two
 *  branches returning 1 for different reasons is exactly the shape R5 warns
 *  about. */
function driveMain(argv, { env = { VITE_SUPABASE_URL: 'u', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' },
                           result, connectThrows = false, errSink } = {}) {
  return main(argv, {
    loadEnvFn: () => env,
    log: () => {},
    errLog: (line) => { if (errSink) errSink.push(String(line)); },
    sleep: async () => {},
    connect: async () => {
      if (connectThrows) throw new Error('module not found');
      const seq = Array.isArray(result) ? [...result] : [result];
      return async () => (seq.length > 1 ? seq.shift() : seq[0]);
    },
  });
}

// EQUALITY, not a floor. A canary with slack can silently lose a rung -- the
// floor-shaped version of this number would still print PASS after someone
// deleted the two self-inconsistency cases. Add a case, update this number.
const EXPECTED_CASES = 41;

export async function selfTest(log = console.log) {
  const cases = [
    // ---- evaluate(): the RULES ----
    ['healthy payload passes', () => evaluate(payload()).code, 0],
    // The arm combinations below are the ones the RPC can actually EMIT for
    // each shape, worked through against its own SQL -- not a hand-built set.
    // The earlier draft had M1 and M3 co-firing the third arm, which was true
    // only of the dead version of it.
    ['M1 duplicate {0,0,2,3} -- the real All Stars bug. Arm 1 alone: n=4 d=3, ' +
     'but max+1=4 so contiguity reads clean',
      () => evaluate(payload({ status: 'fail', duplicate_offsets: 1,
        sample: [{ series_id: '5e24e6d7-6162-4090-978d-3224ebe16be2',
                   name: 'All Stars Festival', format: 'festival',
                   lifecycle_status: 'live', offsets: [0, 0, 2, 3], day_rows: 4,
                   distinct_offsets: 3, local_start: '2026-11-05',
                   local_end: '2026-11-08' }] })).code, 1],
    ['M2 collision on the LAST day {0,0,1,2} -- invisible to every pre-existing ' +
     'check, because max(offset) shrinks WITH the count',
      () => evaluate(payload({ status: 'fail', duplicate_offsets: 1, non_contiguous: 1 })).code, 1],
    ['M3 gap {0,1,3} -- arm 2 alone; UNIQUE(series_id,date_offset_days) accepts ' +
     'it and arm 1 reads clean because n=d=3',
      () => evaluate(payload({ status: 'fail', non_contiguous: 1 })).code, 1],
    ['M4 unplaceable -- a well-formed day set on a festival with no resolvable ' +
     'anchor. Arm 3 ALONE: the other two see nothing wrong with the rows',
      () => evaluate(payload({ status: 'fail', unplaceable_span: 1 })).code, 1],
    ['every arm is individually reachable',
      () => ARMS.filter(([k]) =>
        evaluate(payload({ status: 'fail', [k]: 1 })).code === 1).length, ARMS.length],
    ['status ok beside non-zero counts is self-inconsistent',
      () => evaluate(payload({ status: 'ok', duplicate_offsets: 2 })).code, 1],
    ['status fail beside zero counts is self-inconsistent',
      () => evaluate(payload({ status: 'fail' })).code, 1],
    ['unknown status fails', () => evaluate(payload({ status: 'degraded' })).code, 1],
    ['null payload fails', () => evaluate(null).code, 1],
    ['array payload fails', () => evaluate([]).code, 1],
    ['string payload fails', () => evaluate('ok').code, 1],
    ['missing arm key fails', () => {
      const p = payload(); delete p.non_contiguous; return evaluate(p).code;
    }, 1],
    // ---- evaluate(): the R1 FLOORS, both edges pinned ----
    ['zero series is BLIND, not clean',
      () => evaluate(payload({ series_total: 0 })).code, 1],
    ['series just below the floor fails',
      () => evaluate(payload({ series_total: MIN_SERIES - 1 })).code, 1],
    ['series exactly at the floor passes',
      () => evaluate(payload({ series_total: MIN_SERIES })).code, 0],
    ['zero festivals makes two arms vacuous, so it fails -- and with the floor ' +
     'at 1 this IS the below-the-floor edge, not a separate case',
      () => evaluate(payload({ festivals_total: MIN_FESTIVALS - 1 })).code, 1],
    ['festivals exactly at the floor passes',
      () => evaluate(payload({ festivals_total: MIN_FESTIVALS })).code, 0],
    ['a non-numeric festival count is blind, not clean',
      () => evaluate(payload({ festivals_total: null })).code, 1],
    ['non-numeric total is blind, not clean',
      () => evaluate(payload({ series_total: null })).code, 1],
    // ---- evaluate(): the payload must be THIS contract ----
    ['a payload naming a different check fails',
      () => evaluate(payload({ check: 'something_else_v1' })).code, 1],
    ['a payload with no check field fails',
      () => { const p = payload(); delete p.check; return evaluate(p).code; }, 1],
    // ---- error classifiers ----
    ['57014 is transient', () => isTransient({ code: '57014' }), true],
    ['a NUMERIC 57014 is transient too -- the strict === lost this',
      () => isTransient({ code: 57014 }), true],
    ['a contract failure is NOT transient',
      () => isTransient({ code: 'P0001', message: 'duplicate offsets' }), false],
    ['PGRST202 is a missing function', () => isFunctionMissing({ code: 'PGRST202' }), true],
    ['a 42883 naming the CHECK is a missing function',
      () => isFunctionMissing({ code: '42883',
        message: `function ${CHECK_FN}() does not exist` }), true],
    ['a 42883 naming a DEPENDENCY is NOT a missing function',
      () => isFunctionMissing({ code: '42883',
        message: 'function _p5_festival_span_v1(uuid, text) does not exist' }), false],
    ['...that same error IS a missing dependency',
      () => isDependencyMissing({ code: '42883',
        message: 'function _p5_festival_span_v1(uuid, text) does not exist' }), true],
    ['a 42P01 on a dependency TABLE is a missing dependency',
      () => isDependencyMissing({ code: '42P01',
        message: 'relation "event_series_program_day_p5" does not exist' }), true],
    ['a missing CHECK is not ALSO reported as a missing dependency',
      () => isDependencyMissing({ code: 'PGRST202',
        message: `Could not find the function public.${CHECK_FN}` }), false],
  ];

  // ---- THE EXIT-CODE CONTRACT ITSELF (R5) ----
  // Each case drives main() -- the function whose return value becomes
  // process.exitCode -- and pins WHICH branch produced the code. Four branches
  // here return 2, so a case asserting only "it returned 2" proves nothing.
  cases.push(
    ['exit 2: no credentials at all',
      () => driveMain([], { env: {} }), 2],
    ['exit 2: url present but key missing (a HALF-configured env, not a clean one)',
      () => driveMain([], { env: { VITE_SUPABASE_URL: 'u' } }), 2],
    ['exit 2: the supabase client will not load',
      () => driveMain([], { connectThrows: true }), 2],
    ['exit 2: a non-transient transport error',
      () => driveMain([], { result: { error: { code: '08006', message: 'connection refused' } } }), 2],
    ['exit 1: the RPC is not deployed -- an unapplied migration must NOT read as pass',
      () => driveMain([], { result: { error: { code: 'PGRST202', message: 'Could not find the function' } } }), 1],
    ['exit 0: a healthy live payload',
      () => driveMain([], { result: { data: payload(), error: null } }), 0],
    ['exit 1: a violating live payload',
      () => driveMain([], { result: { data: payload({ status: 'fail', duplicate_offsets: 1 }), error: null } }), 1],
    ['exit 0: a transient error RETRIES and then succeeds',
      () => driveMain([], { result: [
        { error: { code: '57014', message: 'canceling statement due to statement timeout' } },
        { data: payload(), error: null },
      ] }), 0],
    // The OTHER half of the retry, and the only stateful branch in main(). A
    // regression that drops the `error` half of the reassignment leaves it
    // stale-or-undefined and can reach evaluate(undefined); with only the
    // succeeds-on-retry case above, nothing would notice.
    ['exit 2: a transient error on BOTH attempts exhausts the retry',
      async () => {
        const errSink = [];
        const code = await driveMain([], { errSink, result: { error: {
          code: '57014', message: 'canceling statement due to statement timeout' } } });
        return `${code}|retried=${errSink.some((l) => l.includes('retrying once'))}`;
      }, '2|retried=true'],
    // Pins the BRANCH by its message, not just its code. Two branches return 1
    // here for opposite repairs, and the whole point of splitting them is that
    // the log stops telling the operator to re-apply an applied migration.
    ['exit 1: a missing DEPENDENCY, and the log must NOT say "apply the migration"',
      async () => {
        const errSink = [];
        const code = await driveMain([], { errSink, result: { error: {
          code: '42883',
          message: 'function _p5_festival_span_v1(uuid, text) does not exist' } } });
        const text = errSink.join('\n');
        return `${code}|apply=${text.includes('Apply the ADMIN migration')}` +
          `|dep=${text.includes('is deployed, but something it calls is not')}`;
      }, '1|apply=false|dep=true'],
  );

  let failed = 0;
  for (const [name, run, want] of cases) {
    let got;
    try {
      got = await run();
    } catch (e) {
      // A throwing case is recorded as a failure, never allowed to abort the
      // run before any result prints.
      log(`FAIL ${name} -- threw ${e?.message ?? e}`);
      failed += 1;
      continue;
    }
    if (got === want) {
      log(`PASS ${name}`);
    } else {
      log(`FAIL ${name} -- expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
      failed += 1;
    }
  }

  // A canary that silently runs fewer cases than it was written with is the
  // failure mode this whole file exists to prevent.
  if (cases.length !== EXPECTED_CASES) {
    log(`FAIL case-count drift -- ran ${cases.length}, expected exactly ${EXPECTED_CASES}.`);
    failed += 1;
  }

  log(
    failed === 0
      ? `PASS self-test -- ${cases.length} cases, rules AND exit codes proven.`
      : `FAIL self-test -- ${failed} failure(s) over ${cases.length} case(s).`,
  );
  return failed === 0;
}

// R6: isEntryPoint(), never a hand-rolled import.meta/argv[1] compare. Node
// realpaths one side and not the other, so through a junction the script exits
// 0 having run NOTHING -- and a false 0 here reads as PASSED.
//
// ONE exit owner: main() dispatches --self-test internally, so there is a single
// assignment to process.exitCode for R5 to point at.
if (isEntryPoint(import.meta.url)) {
  // A throw anywhere is "the check could not run" -- exit 2, never 1.
  process.exitCode = await main(process.argv.slice(2)).catch((e) => {
    console.error(`Transport/unexpected error: ${e?.message ?? e}`);
    return 2;
  });
}
