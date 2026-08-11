#!/usr/bin/env node
/**
 * CI contract check -- occurrence delete/booking safety (2026-08-11).
 *
 * Calls public.check_occurrence_delete_booking_safety_v1() (admin migration
 * 20260810220000). That RPC DISCOVERS every function which deletes from
 * calendar_occurrences / event_occurrence_p5, or from a table that CASCADEs
 * them away, and requires each to name the booking guard
 * _occurrence_date_has_bookings_v1 or carry a written exemption whose premise
 * it re-measures on every run.
 *
 * WHY THIS EXISTS. Admin migration 20260810210000 single-sourced the booking
 * and curation predicates out of the three occurrence chokepoints
 * (_cmd_series_remove_date_p5, _cmd_series_stop_repeating_p5,
 * _reconcile_series_occurrences_after_rule_change_p5_v1) into two helpers, so
 * that "this chokepoint still refuses to destroy a booking" became a structural
 * question instead of three inlined predicate texts somebody has to keep in
 * sync by hand. Nothing re-asks that question after install. The wreckage it
 * prevents is not recoverable and is not even visible afterwards: deleting a
 * booked calendar_occurrences row CASCADEs its event_attendance and
 * event_guest_list_entries rows away, so the evidence goes with the crime.
 *
 * WHAT MAKES IT MORE THAN A COPY-DETECTOR. It does not hold a list of the three
 * known chokepoints -- a list can only re-assert what its author already knew,
 * and is blind to a delete path added tomorrow. The population is derived from
 * the catalog, including the CASCADE-PARENT paths that destroy occurrences
 * without ever naming an occurrence table (admin_bulk_delete_draft_events
 * removes every draft event in one statement; the parent set itself comes from
 * pg_constraint). Run against prod on the day it shipped it found NINE delete
 * paths, four of which no plan document mentioned.
 *
 * GATING. `status` decides, and the RPC decides `status` through a separate
 * pure ladder (_occurrence_delete_safety_status_v1) so the ordering could be
 * proven in both directions at install:
 *
 *   ok         pass.
 *   degraded   PASS, loudly. An unguarded path is tolerated by ruling: either
 *              known_unguarded (a real hole with an open arc) or dormant
 *              (unguarded but nothing invokes it -- and only half of that
 *              premise is measurable from inside the database). The job does
 *              not go red over a pre-existing condition nobody has decided to
 *              fix, and does NOT report a clean ok over it either: that is the
 *              difference between a tolerated hole and a forgotten one. Both
 *              come back as stable LABELS, never function names -- see the
 *              anon note in admin migration 20260810220000.
 *   violation  FAIL. A delete path with no guard and no exemption, an exemption
 *              whose premise stopped holding, a missing helper, a changed FK
 *              action, or a live-data arm.
 *   blind      FAIL. The check could not see its subject -- the chokepoints are
 *              gone, or no longer match, or a table it reads is missing. Green
 *              would be a lie; this is the failure mode a guard suite cannot
 *              afford (the workflow's own precheck comment records 77
 *              consecutive silently-unwatched runs).
 *   malformed  FAIL. The deployed body emitted a fact object its own ladder
 *              cannot bucket, which means the RPC is not the one this reads.
 *
 * REPORTED AND NEVER GATING: p5_unlinked_on_legacy_series (428 pre-existing
 * rows on 2026-08-11 -- the ON DELETE SET NULL residue, which cannot be gated
 * on zero until P3c clears the sediment), the cron scan's outcome, and a LOST
 * self-match (see the note below -- the expected state is true, so only its
 * absence is news). A rise in the first is worth a look, not a red.
 *
 * WHY THE FAILING ARMS ARE READ OFF THE PAYLOAD rather than from a list here:
 * a hand-copied list of the RPC's arm names in this file would be a second copy
 * of something the RPC owns, in a different repo, and would silently stop
 * reporting an arm added later. Every non-empty array in the payload that is
 * not on the small NON_GATING list is printed as a failing arm.
 *
 * DEPLOY ORDER. The RPC ships in admin migration 20260810220000. A missing
 * function therefore means the migration was reverted, or this is pointed at a
 * database that never had it -- exit 1 with that remediation, per the house
 * convention.
 *
 * Exit codes (repo convention, R3): 0 contract holds, 1 contract violated,
 * 2 the check could not run (credentials, network, timeout, missing module).
 *
 * Local:  node scripts/check-occurrence-delete-booking-safety.mjs   (reads .env)
 * Canary: node scripts/check-occurrence-delete-booking-safety.mjs --self-test
 * CI:     env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 */
import fs from 'node:fs';
import path from 'node:path';

/** Hard ceiling on the RPC round trip. It scans pg_proc bodies for every
 *  function in the public schema and runs three small aggregate queries over
 *  calendar_occurrences; ~2.2k occurrence rows and ~1k functions on 2026-08-11.
 *  The job budget is shared with ~40 sibling steps, so a stall is reported as
 *  infrastructure rather than allowed to eat it. */
const RPC_TIMEOUT_MS = 20_000;

/** Keys that are arrays but are NOT failing-arm reports. Everything else in the
 *  payload that is a non-empty array is treated as an arm that is red. */
const NON_GATING_ARRAYS = new Set([
  'discovery_targets',
  'cascade_parents',
  // Both are standing, non-empty, and are the DEGRADED reason -- reported
  // there rather than listed as arms that went red.
  'known_unguarded_present',
  'dormant_exemptions_present',
]);

/** Numeric arms the RPC gates on. Named here only so a non-zero one can be
 *  printed with a sentence explaining it; the RPC's own ladder is what decides. */
const NUMERIC_ARMS = [
  ['booking_rows_without_p5_partner',
   'booking-bearing mirror row(s) whose event_occurrence_p5 partner is gone -- ' +
   'the booking is stranded on an occurrence the P5 spine no longer knows about'],
  ['booked_occurrences_on_draft_events',
   'booking(s) sit on a DRAFT event -- one call to admin_bulk_delete_draft_events ' +
   'destroys them, which is the premise that exemption rests on'],
];

const KNOWN_STATUSES = new Set(['ok', 'degraded', 'violation', 'blind', 'malformed']);

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
// contract drift -- retry once. Same helper as check-added-session-room-contract.mjs;
// kept narrow so a bare "timeout" substring cannot over-match a genuine error.
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
 * NARROW ON PURPOSE, for the reason check-added-session-room-contract.mjs
 * records: a bare /does not exist/ also matches `relation "x" does not exist`
 * (42P01) and `column "y" does not exist` (42703) raised from within the body.
 * Those are infrastructure (exit 2), not a missing guard, and routing them here
 * would hand the operator an "apply migration X" remediation that cannot help.
 *
 * The 42883 arm REQUIRES the name: this RPC calls _occurrence_delete_safety_status_v1,
 * so dropping THAT raises a 42883 which contains the word "function" and does
 * not name the check. A genuinely missing check function arrives as PGRST202
 * from PostgREST, or as a 42883 that names it.
 */
export function isFunctionMissing(err) {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  if (code === 'PGRST202') return true; // PostgREST: no such function in schema cache
  const namesTheGuard = /check_occurrence_delete_booking_safety_v1/i.test(msg);
  if (code === '42883') return namesTheGuard;
  if (/schema cache/i.test(msg)) return true; // PostgREST-specific wording
  return namesTheGuard && /does not exist|could not find the function/i.test(msg);
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Every non-empty array in the payload that reports a red arm. Derived, so an
 *  arm added to the RPC later is reported here without editing this file. */
export function failingArms(data) {
  return Object.entries(data)
    .filter(([k, v]) => Array.isArray(v) && v.length > 0 && !NON_GATING_ARRAYS.has(k))
    .map(([k, v]) => `        - ${k}: ${JSON.stringify(v)}`);
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
      'FAIL: check_occurrence_delete_booking_safety_v1 returned NULL -- the guard ' +
        'broke, which is a contract violation in itself.',
    );
    return { code: 1, out, err };
  }

  // Echoed BEFORE the shape gates, not after. A payload this file rejects is
  // exactly the one an operator needs to see: "the deployed body is not the one
  // this check reads" with no evidence of what did come back sends them to the
  // migration file to guess. Draft 1 pushed this after the three early returns,
  // so every shape failure printed a remediation and nothing else.
  out.push(JSON.stringify(data, null, 2));

  // FAIL CLOSED ON AN UNRECOGNISED SHAPE. A payload without these branches is
  // not this guard, and reading `status` off it would report a green over a
  // question nobody asked. delete_path_summary is in the list because it is
  // what the non-vacuity floor below is measured from: without it, a body that
  // discovered nothing would sail through that floor reading 0.
  if (
    typeof data.status !== 'string' ||
    data.delete_path_summary == null ||
    data.subsystem_present === undefined ||
    data.chokepoints_absent === undefined
  ) {
    err.push(
      'FAIL: unrecognised payload from check_occurrence_delete_booking_safety_v1 ' +
        '(missing status / delete_path_summary / subsystem_present / chokepoints_absent). ' +
        'The deployed body is not the one this check reads -- see admin migration ' +
        '20260810220000.',
    );
    return { code: 1, out, err };
  }

  if (!KNOWN_STATUSES.has(data.status)) {
    err.push(
      `FAIL: check_occurrence_delete_booking_safety_v1 reported an unknown status ` +
        `"${data.status}". This check knows ${[...KNOWN_STATUSES].join(' | ')}; a new one ` +
        'means the ladder gained a rung nothing here reads. Failing closed.',
    );
    return { code: 1, out, err };
  }

  const total = num(data.delete_path_summary.total);
  const guarded = num(data.delete_path_summary.guarded);
  const unlinked = num(data.p5_unlinked_on_legacy_series);

  // ---- the non-gating bands, reported before the verdict either way --------
  if (unlinked > 0) {
    out.push(
      `\nnote: ${unlinked} event_occurrence_p5 row(s) on a legacy-linked series carry a NULL ` +
        'legacy_occurrence_id. That is the ON DELETE SET NULL residue -- the shape left behind ' +
        'when a mirror row is deleted out from under its P5 twin -- and prod already held 428 ' +
        'of them when this check shipped, so it is REPORTED and never gated. Clearing the ' +
        'sediment is arc P3c; until then a rise here is worth a look, not a red.',
    );
  }

  if (data.cron_scan && data.cron_scan !== 'read' && data.cron_scan !== 'absent') {
    out.push(
      `\nnote: the dormancy arm could not read cron.job (${data.cron_scan}). The RPC buckets ` +
        'that as BLIND rather than as a clean zero, so it will show up in the verdict below ' +
        'rather than passing silently.',
    );
  }

  // REPORTED WHEN FALSE, not when true, because true is the expected state:
  // the RPC's body quotes a DELETE statement shape while documenting its own
  // pattern, so it matches itself and the v_scanners exclusion is load-bearing
  // (measured true on install, 2026-08-11). Noting the expected state every
  // night is noise; the drift worth seeing is the exclusion quietly becoming
  // decorative, because then a later edit could remove it without consequence
  // -- until the prose comes back and the check reports itself as an unguarded
  // delete path.
  if (data.self_match_without_exclusion === false) {
    out.push(
      "\nnote: the check's own body no longer matches its delete pattern, so the " +
        'v_scanners self-exclusion has become precautionary rather than load-bearing. ' +
        'Nothing is broken; it means the two are no longer coupled the way the migration ' +
        'describes, which is worth a glance if someone is about to simplify either.',
    );
  }

  // ---- the non-vacuity floor -----------------------------------------------
  // A guard that discovered NO delete path has lost its subject. The RPC should
  // already call that blind; this is the independent floor, because "reported ok
  // over a population of zero" is the failure mode this repo's guard-script
  // conventions check exists to end.
  if (total === 0 && (data.status === 'ok' || data.status === 'degraded')) {
    err.push(
      'FAIL: the check reported ' +
        `"${data.status}" having discovered ZERO delete paths. It cannot both have nothing ` +
        'to look at and be satisfied -- the discovery pattern has rotted, or this is not the ' +
        'database the contract is about.',
    );
    return { code: 1, out, err };
  }

  // ---- the gate ------------------------------------------------------------
  if (data.status === 'violation') {
    const arms = failingArms(data);
    for (const [key, why] of NUMERIC_ARMS) {
      if (num(data[key]) > 0) arms.push(`        - ${key}: ${num(data[key])} (${why})`);
    }
    err.push(
      '\nOCCURRENCE DELETE/BOOKING SAFETY FAIL:\n' +
        (arms.length
          ? arms.join('\n')
          : '        (the RPC reported a violation but no arm is non-empty, which is itself a defect)') +
        '\n\n      unruled_delete_paths means a function deletes occurrences (or cascades them ' +
        'away) and neither calls _occurrence_date_has_bookings_v1 nor carries a ruling. Rule on ' +
        'it in a migration -- guard it, or add it to the allowlist with a reason.\n' +
        '      allowlist_entries_unmatched means an exemption no longer matches any discovered ' +
        'function: the path was removed (drop the entry) or it escaped the pattern (worse).\n' +
        '      missing_helpers / curation_helper_not_named_by / booking_helper_unprobed_tables ' +
        'mean the single-sourced guard itself moved -- admin migration 20260810210000.\n' +
        '      fk_topology_drift means an ON DELETE action or an FK edge the data arms reason ' +
        'from has changed; the arms need re-aiming before their zeros mean anything again.',
    );
    return { code: 1, out, err };
  }

  if (data.status === 'blind') {
    err.push(
      '\nOCCURRENCE DELETE/BOOKING SAFETY BLIND:\n' +
        failingArms(data).join('\n') +
        '\n\n      The check could not see its subject. chokepoints_absent means the three ' +
        'occurrence chokepoints are not on this database; chokepoints_not_deleting means they ' +
        'exist but no longer match the delete pattern (a rename, or a body that moved its ' +
        'DELETE somewhere the catalog cannot show); data_tables_absent means a table it reads ' +
        'is gone; cron_scan_blocked means the dormancy premise could not be measured.\n' +
        '      A blind guard is reported red on purpose: green here would mean "nothing was ' +
        'checked" and read as "nothing is wrong".',
    );
    return { code: 1, out, err };
  }

  if (data.status === 'malformed') {
    err.push(
      '\nFAIL: the deployed check emitted a fact object its own status ladder rejects. ' +
        'That means check_occurrence_delete_booking_safety_v1 and ' +
        '_occurrence_delete_safety_status_v1 are out of step -- one was replaced without the ' +
        'other. Re-apply admin migration 20260810220000, which installs both together.',
    );
    return { code: 1, out, err };
  }

  if (data.status === 'degraded') {
    const known = Array.isArray(data.known_unguarded_present) ? data.known_unguarded_present : [];
    const dormant = Array.isArray(data.dormant_exemptions_present)
      ? data.dormant_exemptions_present
      : [];
    out.push(
      `\noccurrence delete/booking safety: DEGRADED (pass) -- ${total} delete path(s) ruled on, ` +
        `${guarded} calling the booking guard, and ${known.length + dormant.length} unguarded ` +
        'path(s) tolerated by ruling.\n' +
        `      known-unguarded: ${known.join(', ') || '(none)'} -- a real hole, ruled OPEN rather ` +
        'than fixed. Arc P3c asks whether a routine admin save can actually reach the state ' +
        'where replace_or_patch_occurrences drops a booked occurrence.\n' +
        `      dormant: ${dormant.join(', ') || '(none)'} -- unguarded, but exempt while nothing ` +
        'invokes it. The RPC re-measures the half it can see (function bodies, cron.job) on ' +
        'every run; an application calling it through the service role is invisible to it and ' +
        'to every other control, which is why "dormant" is degraded rather than ok and why the ' +
        'entry is flagged for REVOKE and retirement.\n' +
        '      This is a PASS on purpose: turning it red today would make a permanently-red ' +
        'check nobody reads, which is worse than a loud pass. Close either item and this ' +
        'returns to ok by itself.',
    );
    return { code: 0, out, err };
  }

  out.push(
    `\noccurrence delete/booking safety: ok (${total} delete path(s) discovered, ${guarded} ` +
      'calling _occurrence_date_has_bookings_v1, the rest ruled on by name; every exemption ' +
      'premise re-measured, both helpers present, FK topology unchanged).',
  );
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
      .rpc('check_occurrence_delete_booking_safety_v1')
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
        `FAIL: check_occurrence_delete_booking_safety_v1 not found (${error.code ?? '?'}: ${error.message}).\n` +
          '      Apply the ADMIN migration that ships it:\n' +
          '      20260810220000_check_occurrence_delete_booking_safety_v1.sql\n' +
          '      (it depends on the guard helpers from 20260810210000 -- apply that first\n' +
          '      if this is a fresh database).',
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
// EQUALITY, not a floor. The companion migration states the reason in its own
// self-verify: "a floor of 'at least N' leaves N-minus-the-actual-count cases of
// slack in which a future edit can quietly delete a rung". A canary with slack
// can lose the `blind FAILS` case, the unknown-status case and the two
// zero-population cases and still print PASS. Add a case, update this number --
// that is the point.
const EXPECTED_CASES = 42;

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
    status: 'ok',
    subsystem_present: true,
    known_unguarded_present: [],
    unruled_delete_paths: [],
    allowlist_entries_unmatched: [],
    cascade_children_unprobed: [],
    missing_helpers: [],
    curation_helper_not_named_by: [],
    booking_helper_unprobed_tables: [],
    fk_topology_drift: [],
    dormant_exemptions_awake: [],
    exempt_paths_anon_reachable: [],
    booking_rows_without_p5_partner: 0,
    booked_occurrences_on_draft_events: 0,
    chokepoints_absent: [],
    chokepoints_not_deleting: [],
    data_tables_absent: [],
    cron_scan_blocked: [],
    delete_path_summary: { total: 9, guarded: 3, unruled: 0 },
    discovery_targets: ['calendar_occurrences', 'event_occurrence_p5', 'events'],
    cascade_parents: ['events', 'event_series_p5'],
    p5_unlinked_on_legacy_series: 428,
    self_match_without_exclusion: false,
    cron_scan: 'read',
  };
  const degraded = {
    ...clean,
    status: 'degraded',
    known_unguarded_present: ['ARC_P3C_SAVE_REPLACE_PATH'],
    dormant_exemptions_present: ['DORMANT_PRUNE_PENDING_RETIREMENT'],
  };
  const violation = {
    ...clean,
    status: 'violation',
    unruled_delete_paths: ['purge_stale_dates_v1'],
  };
  const blind = { ...clean, status: 'blind', chokepoints_not_deleting: ['_cmd_series_remove_date_p5'] };

  // ASSERT AGAINST THE RENDERED TEXT, NOT out[0]. out[0] is a verbatim JSON echo
  // of the payload, so "the output mentions <a value the payload contains>" is
  // satisfied by the echo whether or not the branch rendered anything -- and on
  // the err side the static remediation prose names arms and functions, which
  // does the same job. Four cases here were inert for exactly those two reasons,
  // and EXPECTED_CASES cannot catch it: it counts cases, it cannot tell a case
  // that must pass from one that measures. The sentinels below appear in no
  // literal in this file, so only real rendering can produce them.
  const rendered = (v) => v.out.slice(1).join('\n');
  const SENT_KNOWN = 'ZZ_SENTINEL_KNOWN_LABEL';
  const SENT_DORMANT = 'ZZ_SENTINEL_DORMANT_LABEL';
  const SENT_FN = 'zz_sentinel_delete_path_v1';
  const SENT_ARM = 'zz_sentinel_arm_added_later';

  // --- evaluate(), both directions ---
  add('a clean payload passes', () => evaluate(clean).code, 0);
  add('degraded PASSES (the ruled-open hole must not red the job)', () => evaluate(degraded).code, 0);
  add('degraded says so loudly rather than reading as ok', () => rendered(evaluate(degraded)).includes('DEGRADED'), true);
  // Both halves, or it is not a measurement: the label the payload carries IS
  // rendered, and a payload carrying none does NOT render one.
  add('degraded RENDERS the known-hole label it was given', () => rendered(evaluate({ ...degraded, known_unguarded_present: [SENT_KNOWN] })).includes(SENT_KNOWN), true);
  add('degraded renders no known-hole label when there is none', () => rendered(evaluate({ ...degraded, known_unguarded_present: [] })).includes(SENT_KNOWN), false);
  add('degraded RENDERS the dormant label it was given', () => rendered(evaluate({ ...degraded, dormant_exemptions_present: [SENT_DORMANT] })).includes(SENT_DORMANT), true);
  add('degraded renders no dormant label when there is none', () => rendered(evaluate({ ...degraded, dormant_exemptions_present: [] })).includes(SENT_DORMANT), false);
  // The labels exist so the ANON-CALLABLE RPC does not publish a standing list
  // of guard-free ways to destroy occurrences. This file runs in private CI, so
  // its static prose naming replace_or_patch_occurrences is fine and useful --
  // what would NOT be fine is this file holding a label-to-function lookup,
  // because then the indirection would be decorative and any future consumer
  // could resolve it. Measured as: the real function names present in the
  // rendering do not vary with the labels the payload carries.
  add('the rendering holds no label-to-function lookup', () => {
    const REAL = ['replace_or_patch_occurrences', 'calendar_occurrences_prune'];
    const namesIn = (t) => REAL.filter((n) => t.includes(n)).join(',');
    const withLabels = rendered(evaluate({
      ...degraded,
      known_unguarded_present: [SENT_KNOWN],
      dormant_exemptions_present: [SENT_DORMANT],
    }));
    const withNone = rendered(evaluate({
      ...degraded,
      known_unguarded_present: [],
      dormant_exemptions_present: [],
    }));
    return namesIn(withLabels) === namesIn(withNone);
  }, true);
  add('a dormant path is not listed as a red arm', () => failingArms(degraded).length, 0);
  add('the shape failure still shows the payload it rejected', () => evaluate({ ...clean, delete_path_summary: undefined }).out.join('\n').includes('"status"'), true);
  add('a violation FAILS with exit 1', () => evaluate(violation).code, 1);
  add('the violation names the offending function', () => evaluate({ ...violation, unruled_delete_paths: [SENT_FN] }).err.join('\n').includes(SENT_FN), true);
  // The ARM name is read off the payload KEY, so a sentinel key proves the
  // reporting is derived rather than matching this file's own prose.
  add('the violation names the arm it came from', () => evaluate({ ...violation, [SENT_ARM]: ['x'] }).err.join('\n').includes(SENT_ARM), true);
  add('blind FAILS -- an unwatched guard is not a green one', () => evaluate(blind).code, 1);
  add('blind explains which arm went blind', () => evaluate({ ...blind, chokepoints_not_deleting: [], [SENT_ARM]: ['x'] }).err.join('\n').includes(SENT_ARM), true);
  add('malformed FAILS', () => evaluate({ ...clean, status: 'malformed' }).code, 1);
  add('a NULL payload is a contract violation (1), not a pass', () => evaluate(null).code, 1);

  // --- payload shape, both directions ---
  add('a payload with no status FAILS', () => evaluate({ ...clean, status: undefined }).code, 1);
  add('a payload with no delete_path_summary FAILS', () => evaluate({ ...clean, delete_path_summary: undefined }).code, 1);
  add('a payload with no subsystem_present FAILS', () => evaluate({ ...clean, subsystem_present: undefined }).code, 1);
  add('the shape failure says so, not "delete path"', () => evaluate({ ...clean, status: undefined }).err.join('\n').includes('unrecognised payload'), true);
  // A ladder that gains a rung this file does not know must fail closed, not
  // fall through to the trailing ok.
  add('an unknown status FAILS closed', () => evaluate({ ...clean, status: 'quarantined' }).code, 1);
  add('the unknown-status failure names it', () => evaluate({ ...clean, status: 'quarantined' }).err.join('\n').includes('quarantined'), true);

  // --- the non-vacuity floor ---
  add('ok over ZERO discovered paths FAILS', () => evaluate({ ...clean, delete_path_summary: { total: 0, guarded: 0, unruled: 0 } }).code, 1);
  add('degraded over ZERO discovered paths FAILS too', () => evaluate({ ...degraded, delete_path_summary: { total: 0, guarded: 0, unruled: 0 } }).code, 1);
  add('the zero-path failure says it discovered nothing', () => evaluate({ ...clean, delete_path_summary: { total: 0, guarded: 0, unruled: 0 } }).err.join('\n').includes('ZERO delete paths'), true);

  // --- the bands are REPORTED and never gate ---
  add('the SET NULL residue does not gate', () => evaluate({ ...clean, p5_unlinked_on_legacy_series: 999 }).code, 0);
  add('the SET NULL residue is reported', () => evaluate(clean).out.join('\n').includes('428 event_occurrence_p5 row(s)'), true);
  add('a blocked cron scan is reported', () => evaluate({ ...clean, cron_scan: 'blocked: 42501' }).out.join('\n').includes('could not read cron.job'), true);
  add('the EXPECTED self-match (true) is not reported as news', () => evaluate({ ...clean, self_match_without_exclusion: true }).out.join('\n').includes('self-exclusion'), false);
  add('a LOST self-match is reported, and does not gate', () => {
    const v = evaluate({ ...clean, self_match_without_exclusion: false });
    return v.code === 0 && v.out.join('\n').includes('precautionary');
  }, true);

  // --- derived arm reporting ---
  add('failingArms reads arms off the payload, not a local list', () => failingArms({ ...clean, an_arm_added_later: ['x'] }).join(''), '        - an_arm_added_later: ["x"]');
  add('failingArms ignores the non-gating arrays', () => failingArms(clean).length, 0);
  add('a numeric arm is explained in the failure', () => evaluate({ ...clean, status: 'violation', booked_occurrences_on_draft_events: 2 }).err.join('\n').includes('DRAFT event'), true);
  add('a band on a FAILING payload does not turn it green', () => evaluate({ ...violation, p5_unlinked_on_legacy_series: 0 }).code, 1);

  // --- error classification, both directions ---
  add('57014 is transient', () => isTransient({ code: '57014', message: 'x' }), true);
  add('a genuine SQL error is NOT transient', () => isTransient({ code: '42883', message: 'operator does not exist' }), false);
  add('PGRST202 is function-missing', () => isFunctionMissing({ code: 'PGRST202', message: 'x' }), true);
  add('a permission error is NOT function-missing', () => isFunctionMissing({ code: '42501', message: 'permission denied' }), false);
  add('relation-does-not-exist from inside the body is NOT function-missing', () => isFunctionMissing({ code: '42P01', message: 'relation "calendar_occurrences" does not exist' }), false);
  // The wrong-remediation defect: a dropped status ladder raises 42883 naming
  // the ladder, not the check, and must not be reported as a missing check.
  add('a dropped status ladder (42883) is NOT function-missing', () => isFunctionMissing({ code: '42883', message: 'function public._occurrence_delete_safety_status_v1(jsonb) does not exist' }), false);
  add('a 42883 that NAMES the check IS function-missing', () => isFunctionMissing({ code: '42883', message: 'function public.check_occurrence_delete_booking_safety_v1() does not exist' }), true);

  let failed = 0;
  for (const c of cases) {
    const ok = c.actual === c.expected;
    if (!ok) failed++;
    log(`${ok ? '  ok  ' : '  FAIL'} ${c.name}${ok ? '' : ` (got ${JSON.stringify(c.actual)}, want ${JSON.stringify(c.expected)})`}`);
  }

  // Non-vacuity on the canary itself: "PASS -- 0 cases" must be impossible,
  // and so must "PASS -- 30 of the 39 cases somebody wrote".
  if (cases.length !== EXPECTED_CASES) {
    log(`  FAIL non-vacuity: ran ${cases.length} case(s), expected exactly ${EXPECTED_CASES}`);
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
  path.resolve(process.argv[1]).replace(/\\/g, '/').endsWith('/check-occurrence-delete-booking-safety.mjs');

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
