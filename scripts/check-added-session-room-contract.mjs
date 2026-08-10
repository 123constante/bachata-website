#!/usr/bin/env node
/**
 * CI contract check -- added-session room scoping (2026-08-10).
 *
 * Calls public.check_added_session_room_contract_v1(), which asks the SAME
 * question the write-time guard asks (_added_session_room_ok_p5_v1 /
 * _added_session_room_ok_legacy_v1, admin migration 20260810140000) over every
 * roomed added-session row on both faces of the projection:
 * event_occurrence_added_session_p5 and calendar_occurrence_added_sessions.
 *
 * WHY THIS EXISTS. Admin migration 20260809150000 installed a trigger that
 * refuses an added-session room which is not at the occurrence's effective
 * per-date venue, and proved 0 foreign rows ONCE, at install. Nothing
 * re-evaluated it afterwards. Two routes can still produce a foreign row
 * without the guard ever firing -- a venue_rooms.venue_id move, and a
 * calendar_occurrences.venue_id write with no P5 override row -- and the first
 * symptom of either is an admin's save aborting with
 * venue_room_belongs_to_other_venue and nothing saying why. Residue #6 of the
 * admin repo's docs/room-scoping-residue.md; admin migration 20260810150000.
 *
 * WHY IT ASKS THE GUARD'S QUESTION RATHER THAN THE OBVIOUS ONE. The underlying
 * predicates (_room_usable_for_occurrence_p5_v1 etc.) are STRICTER than what
 * enforces: the guard prefers the owner's occurrence on the legacy face, and
 * widens on the row's own calendar_occurrences.venue_id. A check built on the
 * predicates would count as violations exactly the writes the guard permits and
 * redden this job on legal data. The RPC calls the decision owners; this script
 * only reads its verdict.
 *
 * GATING: `ok` must be true -- strict zero foreign rows on both faces, both
 * guard triggers present and firing, the guard still delegating to its decision
 * owners, all three owners present. REPORTED and never gating: the NULL-venue
 * fail-open band (an occurrence with no resolvable venue permits any room), and
 * the widening's footprint per face -- rows the decision permits and the bare
 * rule refuses, which the widening and nothing else can account for. Both were
 * 0 on prod when this shipped; a rise in either is worth a look, not a red.
 *
 * DEPLOY ORDER. The RPC ships in admin migration 20260810150000, which was
 * applied before this branch was opened. A missing function therefore means the
 * migration was reverted or this is pointed at a database that never had it --
 * exit 1 with that remediation, per the house convention.
 *
 * Exit codes (repo convention, R3): 0 contract holds, 1 contract violated,
 * 2 the check could not run (credentials, network, timeout, missing module).
 *
 * Local:  node scripts/check-added-session-room-contract.mjs     (reads .env)
 * Canary: node scripts/check-added-session-room-contract.mjs --self-test
 * CI:     env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 */
import fs from 'node:fs';
import path from 'node:path';

/** Hard ceiling on the RPC round trip. The RPC calls three SECURITY DEFINER
 *  helpers per roomed row; the population is small (22 rows across both faces
 *  on 2026-08-10) but the job budget is shared with ~40 sibling steps, so a
 *  stall is reported as infrastructure rather than allowed to eat it. */
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

// The anon statement_timeout (57014) and network blips are infra noise, not
// contract drift -- retry once. Same helper as check-festival-detail-span.mjs
// and check-venue-publish-gate.mjs; kept narrow so a bare "timeout" substring
// cannot over-match a genuine error.
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
 * NARROW ON PURPOSE, for the reason check-festival-detail-span.mjs records: a
 * bare /does not exist/ also matches `relation "x" does not exist` (42P01) and
 * `column "y" does not exist` (42703) raised from within the body -- which is
 * exactly what the Stage E table drops will produce. Those are infrastructure
 * (exit 2), not a missing guard, and routing them here would hand the operator
 * an "apply migration X" remediation that cannot possibly help.
 *
 * THE 42883 ARM REQUIRES THE GUARD'S NAME, and a draft that also accepted a
 * bare /function/i reintroduced the very defect the paragraph above avoids. The
 * RPC calls three SECURITY DEFINER owners; drop one -- the DECISION_OWNERS_MISSING
 * scenario the RPC has a dedicated code for -- and it raises 42883 reading
 * `function public._added_session_room_ok_p5_v1(uuid, uuid) does not exist`,
 * which contains the word "function" and does NOT name the guard. That routed a
 * missing OWNER to "apply migration 20260810150000", which is already applied
 * and cannot help. A genuinely missing check function arrives as PGRST202 from
 * PostgREST, or as a 42883 that names it.
 */
export function isFunctionMissing(err) {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  if (code === 'PGRST202') return true; // PostgREST: no such function in schema cache
  const namesTheGuard = /check_added_session_room_contract_v1/i.test(msg);
  if (code === '42883') return namesTheGuard;
  if (/schema cache/i.test(msg)) return true; // PostgREST-specific wording
  return namesTheGuard && /does not exist|could not find the function/i.test(msg);
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Pure verdict over the RPC payload. Returns { code, out, err } where out/err
 * are the lines to print. Exercised by the canary; main() only does I/O.
 */
export function evaluate(data) {
  const out = [];
  const err = [];

  if (data == null) {
    err.push(
      'FAIL: check_added_session_room_contract_v1 returned NULL -- the guard ' +
        'broke, which is a contract violation in itself.',
    );
    return { code: 1, out, err };
  }

  // FAIL CLOSED ON AN UNRECOGNISED SHAPE. A payload without these branches is
  // not this guard, and reading `ok` off it would report a green over a
  // question nobody asked.
  //
  // `widening` is in the list for exactly the same reason as the other three,
  // and a draft that left it out was wrong: with optional-chained reads a body
  // lacking that branch reports both footprints as 0, suppresses their notes,
  // and prints a clean green claiming a measurement it never made.
  if (
    data.p5 == null ||
    data.legacy == null ||
    data.structure == null ||
    data.widening == null
  ) {
    err.push(
      'FAIL: unrecognised payload from check_added_session_room_contract_v1 ' +
        '(missing one of the p5/legacy/structure/widening branches). The deployed ' +
        'body is not the one this check reads -- see admin migration 20260810150000.',
    );
    return { code: 1, out, err };
  }

  out.push(JSON.stringify(data, null, 2));

  const p5Roomed = num(data.p5.roomed);
  const legacyRoomed = num(data.legacy.roomed);
  const band = num(data.p5.vacuous_null_venue) + num(data.legacy.vacuous_null_venue_owned);
  const widened = num(data.widening.p5_rows) + num(data.widening.legacy_owned_rows);
  // NOT a second field on `widening`: this is the count of legacy rows its
  // footprint skips, and the RPC deliberately reports it once, here.
  const unowned = num(data.legacy.unowned);

  // ---- the non-gating bands, reported before the verdict either way --------
  if (band > 0) {
    out.push(
      `\nnote: ${band} roomed row(s) sit on an occurrence with no resolvable venue, ` +
        'so any existing room passes there. Fail-open by design (admin residue #1); ' +
        'non-gating. Set a venue on the date or the series to bring them under the rule.',
    );
  }

  if (widened > 0) {
    out.push(
      `\nnote: ${widened} roomed row(s) (p5 ${num(data.widening.p5_rows)}, legacy ` +
        `${num(data.widening.legacy_owned_rows)}) are legal ONLY because of the guard's ` +
        'one-directional widening: the rule they are judged by refuses the room, and the ' +
        "date's own calendar_occurrences.venue_id is what permits it. That footprint was 0 " +
        'when this check shipped. Non-gating -- the widening exists so a guard that cannot ' +
        'see what the admin is looking at does not block them -- but it means those rows ' +
        'depend on a legacy column, and would turn foreign the moment it is cleared.',
    );
  }

  if (unowned > 0) {
    out.push(
      `\nnote: ${unowned} roomed legacy row(s) have no P5 owner. They are fully GATED ` +
        'above; what skips them is the widening footprint only, because judging an unowned ' +
        'row means the multi-twin traversal the RPC deliberately does not restate.',
    );
  }

  // ---- the gate ------------------------------------------------------------
  if (data.ok !== true) {
    const errors = Array.isArray(data.errors) ? data.errors : [];
    const rendered = errors.length
      ? errors.map((e) => `        - ${e?.code ?? '?'}: ${e?.message ?? ''}`).join('\n')
      : '        (the guard reported not-ok but listed no errors, which is itself a defect)';
    err.push(
      '\nADDED-SESSION ROOM CONTRACT FAIL:\n' +
        rendered +
        '\n\n      A FOREIGN_* code means rows exist that the write-time guard would ' +
        'refuse: the next save of that date aborts with venue_room_belongs_to_other_venue.\n' +
        '      Most likely a venue_rooms.venue_id move, or a calendar_occurrences.venue_id ' +
        'write with no P5 override row (both recorded in the ADMIN repo, which this file ' +
        'is not in: docs/room-scoping-residue.md).\n' +
        '      A GUARD_TRIGGER_* or GUARD_NOT_DELEGATING code means the enforcement layer ' +
        'itself moved, and the zero above would be meaningless even if it were there.',
    );
    return { code: 1, out, err };
  }

  out.push(
    `\nadded-session room contract: ok (${p5Roomed} P5 + ${legacyRoomed} legacy roomed ` +
      'row(s) judged by the same decision the write-time guard makes, 0 foreign; ' +
      'both guard triggers firing and still delegating to their owners).',
  );

  // NOT treated as blindness, and the difference from check-festival-detail-span
  // is deliberate. There, a zero comparison meant the guard had stopped seeing a
  // population that certainly exists. Here an empty population is a legitimate
  // state -- nobody has roomed an added session -- and the structural arms are
  // still asserting against the live catalog, so this run measured something
  // real. Said out loud so a quiet green is never mistaken for a broad one.
  if (p5Roomed + legacyRoomed === 0) {
    out.push(
      '\nnote: no roomed added-session rows exist, so the data arm compared nothing ' +
        'this run. What passed is the structural arm: both guard triggers present and ' +
        'firing, the guard delegating, three decision owners in place.',
    );
  }

  return { code: 0, out, err };
}

// NOTE: main() RETURNS its exit code rather than calling process.exit().
// process.exit() truncates buffered stdout on Linux CI, and on Windows it can
// abort the runtime outright (exit 127) when an undici keep-alive handle is
// still closing -- a green check that fails its own job.
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
      .rpc('check_added_session_room_contract_v1')
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
        `FAIL: check_added_session_room_contract_v1 not found (${error.code ?? '?'}: ${error.message}).\n` +
          '      Apply the ADMIN migration that ships it:\n' +
          '      20260810150000_check_added_session_room_contract_v1.sql\n' +
          '      (it depends on the decision owners from 20260810140000 and the guard\n' +
          '      from 20260809150000 -- apply those first if this is a fresh database).',
      );
      return 1;
    }
    console.error(`Transport/unexpected error: ${error.code ?? '?'}: ${error.message}`);
    return 2;
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
 * A case that THROWS is recorded as a failure rather than aborting the run
 * before any result prints, and a run of fewer than MIN_CASES cases fails
 * rather than reporting "PASS -- 0 cases".
 */
const MIN_CASES = 20;

export function selfTest(log = console.log) {
  const cases = [];
  const add = (name, fn, expected) => {
    let actual;
    try {
      actual = fn();
    } catch (e) {
      actual = `THREW: ${e?.message ?? e}`;
    }
    cases.push({ name, actual, expected });
  };

  const clean = {
    ok: true,
    p5: { roomed: 11, violations: 0, vacuous_null_venue: 0 },
    legacy: { roomed: 11, violations: 0, owned: 11, unowned: 0, vacuous_null_venue_owned: 0 },
    widening: { p5_rows: 0, legacy_owned_rows: 0 },
    structure: { trigger_p5: true, trigger_legacy: true, guard_delegates: true, owners_present: 3 },
    errors: [],
  };
  const foreign = {
    ...clean,
    ok: false,
    p5: { roomed: 11, violations: 2, vacuous_null_venue: 0 },
    errors: [
      {
        code: 'ADDED_SESSION_ROOM_FOREIGN_P5',
        message: '2 of 11 roomed event_occurrence_added_session_p5 row(s) hold a room the write-time guard would refuse',
      },
    ],
  };
  const unwatched = {
    ...clean,
    ok: false,
    structure: { trigger_p5: false, trigger_legacy: true, guard_delegates: true, owners_present: 3 },
    errors: [{ code: 'GUARD_TRIGGER_MISSING_P5', message: 'absent or not firing' }],
  };

  // --- evaluate(), both directions ---
  add('a clean payload passes', () => evaluate(clean).code, 0);
  add('foreign rows FAIL with exit 1', () => evaluate(foreign).code, 1);
  add('the failure names its code', () => evaluate(foreign).err.join('\n').includes('ADDED_SESSION_ROOM_FOREIGN_P5'), true);
  add('the failure names its count', () => evaluate(foreign).err.join('\n').includes('2 of 11'), true);
  add('a disabled guard trigger FAILS even with 0 foreign rows', () => evaluate(unwatched).code, 1);
  add('a NULL payload is a contract violation (1), not a pass', () => evaluate(null).code, 1);
  add('ok:false with an empty error list still FAILS', () => evaluate({ ...clean, ok: false, errors: [] }).code, 1);
  add('a missing ok key fails closed', () => evaluate({ ...clean, ok: undefined }).code, 1);
  add('a truthy-but-not-true ok fails closed', () => evaluate({ ...clean, ok: 'yes' }).code, 1);

  // --- payload shape, both directions ---
  add('a payload with no structure branch FAILS', () => evaluate({ ...clean, structure: undefined }).code, 1);
  add('a payload with no p5 branch FAILS', () => evaluate({ ...clean, p5: undefined }).code, 1);
  add('a payload with no legacy branch FAILS', () => evaluate({ ...clean, legacy: undefined }).code, 1);
  // The optional-chained read that made this necessary: without widening in the
  // gate, both footprints silently read 0 and the run printed a clean green.
  add('a payload with no widening branch FAILS', () => evaluate({ ...clean, widening: undefined }).code, 1);
  add('the shape failure says so, not "foreign rooms"', () => evaluate({ ...clean, structure: undefined }).err.join('\n').includes('unrecognised payload'), true);

  // --- the bands are REPORTED and never gate ---
  add('the NULL-venue band does not gate', () => evaluate({ ...clean, p5: { roomed: 11, violations: 0, vacuous_null_venue: 4 } }).code, 0);
  add('the NULL-venue band is reported', () => evaluate({ ...clean, p5: { roomed: 11, violations: 0, vacuous_null_venue: 4 } }).out.join('\n').includes('4 roomed row(s) sit on an occurrence with no resolvable venue'), true);
  add('the widening footprint does not gate', () => evaluate({ ...clean, widening: { p5_rows: 3, legacy_owned_rows: 0 } }).code, 0);
  add('the widening footprint is reported', () => evaluate({ ...clean, widening: { p5_rows: 3, legacy_owned_rows: 0 } }).out.join('\n').includes('legal ONLY because of'), true);
  add('the footprint reports both faces, not a fused total', () => evaluate({ ...clean, widening: { p5_rows: 3, legacy_owned_rows: 2 } }).out.join('\n').includes('p5 3, legacy 2'), true);
  add('a legacy-only footprint is still reported', () => evaluate({ ...clean, widening: { p5_rows: 0, legacy_owned_rows: 2 } }).code, 0);
  add('unowned legacy rows are reported off legacy.unowned', () => evaluate({ ...clean, legacy: { ...clean.legacy, unowned: 2 } }).out.join('\n').includes('no P5 owner'), true);
  add('unowned legacy rows do not gate', () => evaluate({ ...clean, legacy: { ...clean.legacy, unowned: 2 } }).code, 0);
  add('a band on a FAILING payload does not turn it green', () => evaluate({ ...foreign, widening: { p5_rows: 5, legacy_owned_rows: 0 } }).code, 1);

  // --- an empty population passes, and says that it is empty ---
  add('zero roomed rows still passes', () => evaluate({ ...clean, p5: { roomed: 0, violations: 0, vacuous_null_venue: 0 }, legacy: { roomed: 0, violations: 0, owned: 0, unowned: 0, vacuous_null_venue_owned: 0 } }).code, 0);
  add('zero roomed rows says the data arm compared nothing', () => evaluate({ ...clean, p5: { roomed: 0, violations: 0, vacuous_null_venue: 0 }, legacy: { roomed: 0, violations: 0, owned: 0, unowned: 0, vacuous_null_venue_owned: 0 } }).out.join('\n').includes('compared nothing'), true);

  // --- error classification, both directions ---
  add('57014 is transient', () => isTransient({ code: '57014', message: 'x' }), true);
  add('a genuine SQL error is NOT transient', () => isTransient({ code: '42883', message: 'operator does not exist' }), false);
  add('PGRST202 is function-missing', () => isFunctionMissing({ code: 'PGRST202', message: 'x' }), true);
  add('a permission error is NOT function-missing', () => isFunctionMissing({ code: '42501', message: 'permission denied' }), false);
  add('relation-does-not-exist from inside the body is NOT function-missing', () => isFunctionMissing({ code: '42P01', message: 'relation "calendar_occurrence_added_sessions" does not exist' }), false);
  add('column-does-not-exist is NOT function-missing', () => isFunctionMissing({ code: '42703', message: 'column "venue_room_id" does not exist' }), false);
  // The wrong-remediation defect: a dropped decision OWNER raises 42883 naming
  // the owner, not the check, and must not be reported as a missing check.
  add('a dropped decision owner (42883) is NOT function-missing', () => isFunctionMissing({ code: '42883', message: 'function public._added_session_room_ok_p5_v1(uuid, uuid) does not exist' }), false);
  add('a 42883 that NAMES the check IS function-missing', () => isFunctionMissing({ code: '42883', message: 'function public.check_added_session_room_contract_v1() does not exist' }), true);

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
const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]).replace(/\\/g, '/').endsWith('/check-added-session-room-contract.mjs');

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
