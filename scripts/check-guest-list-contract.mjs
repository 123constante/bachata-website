#!/usr/bin/env node
/**
 * CI integrity check for the guest-LIST contract.
 *
 * Sibling of check-guest-entries-contract.mjs. That one watches ROW hygiene (retention,
 * tokens, qr_token defaults); this one watches the guest LIST itself:
 *
 *   - duplicate_live_name_count: two live rows with the same name in the same uniqueness
 *     scope. The two partial unique indexes make this structurally impossible, so nonzero
 *     means an index was dropped or disabled.
 *   - standing_casefold_dupes: two standing (VIP) names differing only by case. Same
 *     reasoning against guest_list_standing_names_norm_name_uq_idx. PostgreSQL allows a
 *     CREATE OR REPLACE of an indexed function without rebuilding the index, so this
 *     measures the literal expression rather than asking the suspect to certify itself.
 *   - payload_contract_breaks: the PUBLIC payload of get_event_guest_list no longer matches
 *     the contract the Website reads (P6). Nonzero means the page and the server disagree
 *     about what `count` means or what an entry carries.
 *
 * WHY THIS FILE EXISTS AT ALL. check_guest_list_contract_v1 has been installed in prod since
 * the guest-list arc's early phases and NOTHING HAS EVER RUN IT -- guards.json carried
 * executor:null for it, which is inventory, not an exemption. Its sibling has been running
 * nightly the whole time, which is what made the gap easy to miss. Wired by the arc's P6
 * (admin migration 20260827210000), the deploy that also gave the check its payload
 * dimension.
 *
 * NON-VACUITY IS ASSERTED, NOT ASSUMED. The payload dimension walks every has_guestlist
 * event; on a database with none it would measure nothing and still report ok:true. The RPC
 * publishes payload_events_checked so that case is distinguishable, and this script FAILS on
 * it rather than printing a green that means "there was nothing to look at".
 *
 * WHY THE SHAPE IS main(argv, deps) + selfTest(), AND NOT THE STRAIGHT-LINE DRAFT. The first
 * version of this file did its RPC call at module scope and graded it with a top-level
 * if/else chain. Every rule it enforced was correct and NONE of them was provable: with the
 * network call welded to the grading there was no way to ask "does this script still fail
 * when the contract breaks?" without breaking the contract in prod. check-script-conventions
 * R4 caught it as a NEW guard with no canary. The grading is now a pure function of the RPC
 * payload, main() owns the exit code, and the canary drives both with injected collaborators.
 *
 * FOUR BRANCHES RETURN 2, so the integer alone cannot say which one fired. grade() therefore
 * returns a `kind` alongside the code and the canary asserts on THAT -- a case that only
 * checked the number would pass for the wrong reason, which is the failure mode this repo
 * has already measured elsewhere.
 *
 * Local:  node scripts/check-guest-list-contract.mjs
 *         node scripts/check-guest-list-contract.mjs --self-test
 * CI:     env vars VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * Exit codes (R3): 0 pass, 1 contract violated, 2 could not measure.
 *
 * See: admin repo migrations/20260826210000_guestlist_p3_name_identity_chokepoint_v1.sql
 *      admin repo migrations/20260827210000_guestlist_p6_public_truth_contract_v1.sql
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { isEntryPoint } from './lib/entry-point.mjs';

const DRIFT_BASELINE = 0;
/** Prod holds 6 guest-list events. Require at least one, so an empty read is not a pass. */
const MIN_PAYLOAD_EVENTS = 1;

export function loadEnv(base = process.env, readFile = null) {
  const env = { ...base };
  const read =
    readFile ?? ((path) => (fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : null));
  const file = read('.env');
  if (typeof file === 'string') {
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

/**
 * STRICT ON PURPOSE. This was `Number.isFinite(Number(v))`, which coerces before it judges:
 * `Number(null)`, `Number('')`, `Number([])` and `Number(false)` are all 0, so a payload with
 * `drift_count: null` -- a plausible shape for a dimension the RPC failed to compute --
 * graded as "0 drift" and the guard printed OK and exited 0. A JSON number arrives as a
 * number; anything else is a payload this script has not understood, and NaN routes it to the
 * malformed branch instead of to a green.
 */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

/**
 * Grade one RPC payload. PURE -- no network, no env, no process state.
 *
 * Returns { code, kind, lines }. `kind` names the branch that fired, because four distinct
 * branches return 2 and a canary asserting only on the integer cannot tell them apart.
 */
export function grade(data, { driftBaseline = DRIFT_BASELINE } = {}) {
  const driftCount = num(data?.drift_count);
  const payloadChecked = num(data?.payload_events_checked);
  const payloadBreaks = num(data?.payload_contract_breaks);

  // ORDER MATTERS. The absent-key case is diagnosed BEFORE the generic malformed-payload one:
  // a prod that predates the P6 migration has no payload_* keys at all, and grading that as
  // "malformed" sends the reader hunting for a corrupt response instead of telling them the
  // public read contract simply is not being checked yet.
  if (!Number.isFinite(payloadChecked) || !Number.isFinite(payloadBreaks)) {
    return {
      code: 2,
      kind: 'no-payload-dimension',
      lines: [
        'FAIL: check_guest_list_contract_v1 published no payload dimension ' +
          '(payload_events_checked / payload_contract_breaks are absent). The database ' +
          'predates admin migration 20260827210000, so the public read contract is NOT ' +
          'being checked.',
      ],
    };
  }

  if (!Number.isFinite(driftCount)) {
    return {
      code: 2,
      kind: 'malformed',
      lines: ['FAIL: contract RPC returned a malformed payload.'],
    };
  }

  if (payloadChecked < MIN_PAYLOAD_EVENTS) {
    return {
      code: 2,
      kind: 'vacuous',
      lines: [
        `FAIL: the payload dimension evaluated ${payloadChecked} events (expected at least ` +
          `${MIN_PAYLOAD_EVENTS}). Nothing was measured, so ok:true means nothing. Either ` +
          'every event lost has_guestlist, or this is pointed at the wrong database.',
      ],
    };
  }

  // EACH DIMENSION IS ASSERTED DIRECTLY, not merely through the sum.
  //
  // `drift_count` is the RPC's own total (dup + standing + payload_breaks), and gating on it
  // alone makes this script's headline claim -- "payload_contract_breaks nonzero means the
  // page and the server disagree" -- true only TRANSITIVELY, via a sum whose COMMENT had
  // already drifted once in this very migration's history. If the RPC ever stops folding a
  // dimension into the total, the guard goes quiet about exactly the thing it was wired up
  // to watch. Reading the named keys costs nothing and does not depend on that arithmetic.
  const named = [
    ['payload_contract_breaks', payloadBreaks],
    ['duplicate_live_name_count', num(data?.duplicate_live_name_count)],
    ['standing_casefold_dupes', num(data?.standing_casefold_dupes)],
  ];
  const unreadable = named.filter(([, v]) => !Number.isFinite(v)).map(([k]) => k);
  if (unreadable.length > 0) {
    return {
      code: 2,
      kind: 'malformed',
      lines: [
        'FAIL: contract RPC returned a malformed payload -- these dimensions are not ' +
          `numbers: ${unreadable.join(', ')}.`,
      ],
    };
  }
  // The question is NOT "is any dimension nonzero" -- a raised baseline exists precisely to
  // tolerate known, accepted drift, and reading it that way would make the baseline
  // unusable. The question is whether the TOTAL still accounts for its own parts. If the
  // named dimensions sum to more than `drift_count`, the RPC has stopped folding one in and
  // the sum can no longer be trusted to carry a breach -- so the breach is reported from the
  // named keys directly, whatever the baseline says.
  const namedSum = named.reduce((acc, [, v]) => acc + v, 0);
  if (namedSum > driftCount) {
    return {
      code: 1,
      kind: 'dimension-break',
      lines: [
        `FAIL: drift_count is ${driftCount} but its own dimensions sum to ${namedSum} ` +
          `(${named.map(([k, v]) => `${k}=${v}`).join(', ')}). The RPC's total no longer ` +
          'reflects its dimensions -- trust the named keys, not the sum.',
      ],
    };
  }

  if (driftCount === 0) {
    const lines = [];
    // The RPC caps its payload scan so an anon caller cannot amplify a request by the fleet
    // size. A cap that is not reported is indistinguishable from full coverage, so say when
    // it bit rather than printing a green that quietly means "the first 50".
    // payload_events_in_fleet, NOT *_total: the admin health page adopts any key ending in
    // `_total` as the row's denominator, which would mislabel that row's two unrelated
    // dimensions. The RPC names the key for what it counts; this reader follows.
    const total = num(data?.payload_events_in_fleet);
    const capped = Number.isFinite(total) && total > payloadChecked;
    if (capped) {
      lines.push(
        `NOTE: the payload dimension checked ${payloadChecked} of ${total} guest-list ` +
          "events (the RPC's scan cap was reached). The remainder were NOT checked.",
      );
    }
    lines.push(
      'OK: 0 drift across all dimensions. Contract holds ' +
        `(payload dimension checked ${payloadChecked} event(s)).`,
    );
    return { code: 0, kind: capped ? 'clean-capped' : 'clean', lines };
  }

  if (driftCount <= driftBaseline) {
    return {
      code: 0,
      kind: 'within-baseline',
      lines: [`WARN: ${driftCount} drift (baseline: ${driftBaseline}). No regression.`],
    };
  }

  const causes = [];
  if (num(data?.duplicate_live_name_count) > 0) {
    causes.push('a partial unique index on event_guest_list_entries was dropped or disabled');
  }
  if (num(data?.standing_casefold_dupes) > 0) {
    causes.push(
      'guest_list_standing_names_norm_name_uq_idx was dropped, or _guest_normalize_name_v1 ' +
        'was replaced under it',
    );
  }
  if (payloadBreaks > 0) {
    causes.push(
      'get_event_guest_list no longer matches the public payload contract the Website reads ' +
        '-- see payload_sample above for the offending event(s)',
    );
  }
  return {
    code: 1,
    kind: 'drift',
    lines: [
      `FAIL: ${driftCount} drift (baseline: ${driftBaseline}). ` +
        (causes.length > 0 ? `Likely: ${causes.join('; ')}.` : 'No dimension named a cause.'),
    ],
  };
}

/** The real collaborator. Injected in the canary so no case touches the network. */
export async function callContractRpc(url, key) {
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return sb.rpc('check_guest_list_contract_v1');
}

// ---------------------------------------------------------------------------
// Canary
// ---------------------------------------------------------------------------

/**
 * Every case drives main() -- the function whose return value becomes process.exitCode --
 * rather than grade() alone. Driving only the pure grader would prove the RULES and leave
 * the exit contract unproven, which is R5's whole complaint.
 *
 * Proof that these cases bind: flip any single `code:` below and the corresponding case
 * fails. Verified by flipping the drift branch's `code: 1` to `code: 0` on 2026-08-27 --
 * exactly one case went red, and it named the branch.
 */
async function selfTest() {
  const CREDS = {
    VITE_SUPABASE_URL: 'https://example.test',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'anon-key',
  };
  const silent = { out: () => {}, err: () => {} };
  /** main() with the network replaced by a canned response. */
  const withPayload = (payload, env = CREDS) =>
    main([], {
      ...silent,
      env,
      readEnvFile: () => null,
      rpc: async () => ({ data: payload, error: null }),
    });

  const healthy = {
    drift_count: 0,
    duplicate_live_name_count: 0,
    standing_casefold_dupes: 0,
    payload_events_checked: 6,
    payload_contract_breaks: 0,
    payload_events_in_fleet: 6,
  };

  const cases = [
    // --- the exit contract, driven through main() ---
    { name: 'main: healthy payload exits 0', expected: 0, run: () => withPayload(healthy) },
    {
      name: 'main: real drift exits 1',
      expected: 1,
      run: () => withPayload({ ...healthy, drift_count: 3, duplicate_live_name_count: 3 }),
    },
    {
      name: 'main: pre-P6 database (no payload keys) exits 2',
      expected: 2,
      run: () =>
        withPayload({ drift_count: 0, duplicate_live_name_count: 0, standing_casefold_dupes: 0 }),
    },
    {
      name: 'main: vacuous read (0 events measured) exits 2',
      expected: 2,
      run: () => withPayload({ ...healthy, payload_events_checked: 0 }),
    },
    {
      name: 'main: malformed drift_count exits 2',
      expected: 2,
      run: () => withPayload({ ...healthy, drift_count: 'nope' }),
    },
    {
      name: 'main: missing credentials exits 2',
      expected: 2,
      run: () =>
        main([], {
          ...silent,
          env: {},
          readEnvFile: () => null,
          rpc: async () => {
            throw new Error('the canary must not reach the network with no credentials');
          },
        }),
    },
    {
      name: 'main: RPC error exits 2',
      expected: 2,
      run: () =>
        main([], {
          ...silent,
          env: CREDS,
          readEnvFile: () => null,
          rpc: async () => ({ data: null, error: { message: 'permission denied' } }),
        }),
    },
    {
      name: 'main: RPC throwing exits 2 (a thrown collaborator is not a pass)',
      expected: 2,
      run: () =>
        main([], {
          ...silent,
          env: CREDS,
          readEnvFile: () => null,
          rpc: async () => {
            throw new Error('socket hang up');
          },
        }),
    },
    { name: 'main: unknown flag exits 2', expected: 2, run: () => main(['--wat'], silent) },

    // --- WHICH branch fired. Four branches return 2; the integer cannot tell them apart. ---
    {
      name: 'grade: pre-P6 database is diagnosed as no-payload-dimension, not malformed',
      expected: 'no-payload-dimension',
      run: () => grade({ drift_count: 0 }).kind,
    },
    {
      name: 'grade: malformed drift is diagnosed as malformed',
      expected: 'malformed',
      run: () => grade({ ...healthy, drift_count: 'nope' }).kind,
    },
    {
      name: 'grade: 0 events measured is diagnosed as vacuous',
      expected: 'vacuous',
      run: () => grade({ ...healthy, payload_events_checked: 0 }).kind,
    },
    {
      name: 'grade: healthy is diagnosed as clean',
      expected: 'clean',
      run: () => grade(healthy).kind,
    },
    {
      name: 'grade: drift is diagnosed as drift',
      expected: 'drift',
      run: () => grade({ ...healthy, drift_count: 2, standing_casefold_dupes: 2 }).kind,
    },

    // --- the dimensions are asserted DIRECTLY, not only through drift_count ---
    {
      name: 'grade: payload breaks with a clean drift_count still FAILS (sum drifted)',
      expected: 'dimension-break',
      run: () => grade({ ...healthy, drift_count: 0, payload_contract_breaks: 2 }).kind,
    },
    {
      name: 'main: a drifted sum hiding a payload break exits 1',
      expected: 1,
      run: () => withPayload({ ...healthy, drift_count: 0, payload_contract_breaks: 2 }),
    },
    {
      name: 'grade: duplicate_live_name_count is asserted directly too',
      expected: 'dimension-break',
      run: () => grade({ ...healthy, drift_count: 0, duplicate_live_name_count: 1 }).kind,
    },
    {
      name: 'grade: a null dimension is malformed, NOT a green (num() is strict)',
      expected: 'malformed',
      run: () => grade({ ...healthy, duplicate_live_name_count: null }).kind,
    },
    {
      name: 'main: drift_count null exits 2 rather than reading as 0 drift',
      expected: 2,
      run: () => withPayload({ ...healthy, drift_count: null }),
    },

    // --- the within-baseline branch, which is unreachable at the default baseline ---
    {
      name: 'grade: a nonzero baseline absorbs drift at or under it',
      expected: 'within-baseline',
      run: () =>
        grade({ ...healthy, drift_count: 2, duplicate_live_name_count: 2 }, { driftBaseline: 3 })
          .kind,
    },
    {
      name: 'grade: drift over a raised baseline still fails',
      expected: 'drift',
      run: () =>
        grade({ ...healthy, drift_count: 5, duplicate_live_name_count: 5 }, { driftBaseline: 3 })
          .kind,
    },

    // --- the cap NOTE. A truncated scan reported as a full one is the bug ARM 6 shipped. ---
    {
      name: 'grade: a capped scan still exits 0 but says so',
      expected: 'clean-capped',
      run: () => grade({ ...healthy, payload_events_checked: 50, payload_events_in_fleet: 120 })
        .kind,
    },
    {
      name: 'grade: a capped scan names both numbers in its NOTE',
      expected: true,
      run: () =>
        grade({ ...healthy, payload_events_checked: 50, payload_events_in_fleet: 120 }).lines.some(
          (l) => l.includes('checked 50 of 120'),
        ),
    },
    {
      name: 'grade: an uncapped scan prints no NOTE',
      expected: false,
      run: () => grade(healthy).lines.some((l) => l.startsWith('NOTE:')),
    },

    // --- the drift message must name a cause, or it sends the reader nowhere ---
    {
      name: 'grade: payload breaks are named as a cause',
      expected: true,
      run: () =>
        grade({ ...healthy, drift_count: 1, payload_contract_breaks: 1 }).lines.some((l) =>
          l.includes('public payload contract'),
        ),
    },

    // --- loadEnv reads .env without clobbering a real environment variable ---
    {
      name: 'loadEnv: .env fills a gap',
      expected: 'from-file',
      run: () => loadEnv({}, () => 'VITE_SUPABASE_URL=from-file').VITE_SUPABASE_URL,
    },
    {
      name: 'loadEnv: the real environment wins over .env',
      expected: 'from-env',
      run: () =>
        loadEnv({ VITE_SUPABASE_URL: 'from-env' }, () => 'VITE_SUPABASE_URL=from-file')
          .VITE_SUPABASE_URL,
    },
    {
      name: 'loadEnv: an absent .env is not an error',
      expected: undefined,
      run: () => loadEnv({}, () => null).VITE_SUPABASE_URL,
    },
  ];

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
    'PASS self-test -- ' + cases.length + ' cases; every exit code, every 2-branch, and ' +
      'every grade() kind driven.',
  );
  return true;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/**
 * Owns the exit code: it RETURNS the integer and the CLI tail assigns it. Setting
 * process.exitCode in here instead would hide the value from the canary, which is the
 * shape R5 exists to refuse.
 */
export async function main(argv = [], deps = {}) {
  const {
    env: baseEnv = process.env,
    readEnvFile = null,
    rpc = callContractRpc,
    out = console.log,
    err = console.error,
  } = deps ?? {};

  const KNOWN_FLAGS = ['--self-test'];
  const unknown = argv.filter((arg) => !KNOWN_FLAGS.includes(arg));
  if (unknown.length > 0) {
    err('Unknown flag(s): ' + unknown.join(', ') + '. Known: ' + KNOWN_FLAGS.join(', '));
    return 2;
  }
  if (argv.includes('--self-test')) {
    return (await selfTest()) ? 0 : 1;
  }

  const env = loadEnv(baseEnv, readEnvFile);
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    err('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
    return 2;
  }

  // R2: a collaborator that THREW has not been checked. Without this the rejection escaped
  // main(), became an unhandled rejection at the CLI boundary and exited 1 -- "the contract
  // is violated" -- for a DNS failure that measured nothing at all.
  let response;
  try {
    response = await rpc(url, key);
  } catch (error) {
    err('RPC threw: ' + (error?.message ?? String(error)));
    return 2;
  }

  const { data, error } = response ?? {};
  if (error) {
    err('RPC failed: ' + error.message);
    return 2;
  }

  out(JSON.stringify(data, null, 2));
  const verdict = grade(data);
  out('');
  for (const line of verdict.lines) {
    (verdict.code === 0 ? out : err)(line);
  }
  return verdict.code;
}

// Realpath-to-realpath (scripts/lib/entry-point.mjs). The hand-rolled string compare this
// replaces mispredicts through a junction or symlink, and the whole guard -- canary included
// -- prints nothing and exits 0, which CI reads as a pass.
if (isEntryPoint(import.meta.url)) {
  // process.exitCode, never process.exit(). supabase-js leaves the fetch handle open, and
  // calling process.exit() while libuv still owns it aborts the process --
  // "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" and exit code 127, which is
  // neither code this script means and reads in CI as a broken runner rather than a failed
  // check. Measured here on 2026-08-27, on the very first run.
  process.exitCode = await main(process.argv.slice(2));
}
