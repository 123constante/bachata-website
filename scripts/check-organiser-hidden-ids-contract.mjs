#!/usr/bin/env node
/**
 * CI contract check -- organiser_directory_hidden_ids_v1 (2026-10-27).
 *
 * WHY THIS EXISTS. organiser_directory_hidden_ids_v1() (admin migration
 * 20270304210000; anon EXECUTE; returns uuid[], never NULL, {} when none) is
 * the ONE source of directory rule D3: a self-started organiser page that is
 * not yet visible is left out of every public directory read. Three public
 * reads call it through src/lib/organiserDirectoryHiddenIds.ts -- the
 * /organisers list, the sitemap and the homepage head count -- and each one
 * THROWS on an RPC error, on purpose (a directory that failed open would list
 * pages meant to be hidden). So a rename, a revoked anon grant or a changed
 * return type does not degrade quietly: /organisers errors and the sitemap
 * 500s. Before this step nothing in db-contract-check.yml would have noticed.
 *
 * GATING (exit 1): the anon call fails as missing (PGRST202 / a 42883 naming
 * the RPC) or as permission denied (42501 -- the revoke); the payload is NULL
 * or not an array; any element is not a uuid string; any id appears twice.
 * An EMPTY array is GREEN: 0 hidden pages is the normal state today, and the
 * call succeeding with the declared type is the measurement. The counts line
 * says so out loud, so a quiet green is never read as a broad one.
 *
 * Prints COUNTS ONLY, never ids -- the hidden pages are the ones the public is
 * not meant to find.
 *
 * Exit codes (repo convention, R3): 0 contract holds, 1 contract violated,
 * 2 the check could not run (credentials, network, timeout, unknown flag).
 *
 * Local:  node scripts/check-organiser-hidden-ids-contract.mjs     (reads .env)
 * Canary: node scripts/check-organiser-hidden-ids-contract.mjs --self-test
 * CI:     env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 */
import fs from 'node:fs';
import { isEntryPoint } from './lib/entry-point.mjs';

const RPC = 'organiser_directory_hidden_ids_v1';

/** Hard ceiling on the round trip. The RPC is one small set query, but the job
 *  budget is shared with every sibling step, so a stall is infrastructure. */
const RPC_TIMEOUT_MS = 20_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function loadEnv(base = process.env, readFile = null) {
  const env = { ...base };
  const read =
    readFile ?? ((p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null));
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

// The anon statement_timeout (57014) and network blips are infra noise, not
// contract drift -- retry once. Same narrow helper as
// check-added-session-room-contract.mjs, so a bare "timeout" substring cannot
// over-match a genuine error.
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
    msg.includes('network') ||
    // Our own RPC_TIMEOUT_MS abort: postgrest-js returns it as an error
    // ({ code: '', message: 'AbortError: ...' }) rather than throwing.
    msg.includes('aborterror')
  );
}

/**
 * Is this the RPC itself gone (renamed or dropped), as opposed to an error
 * raised from INSIDE its body? Narrow for the reason
 * check-added-session-room-contract.mjs records: a 42883 or "does not exist"
 * that names some OTHER object (a helper, a table) is not a missing RPC.
 */
export function isFunctionMissing(err) {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  if (code === 'PGRST202') return true; // PostgREST: no such function in schema cache
  const namesTheRpc = msg.includes(RPC);
  if (code === '42883') return namesTheRpc;
  return namesTheRpc && /does not exist|could not find the function|schema cache/i.test(msg);
}

/** A revoked anon EXECUTE grant. Every public caller is anon, so this breaks them all. */
export function isPermissionDenied(err) {
  if (!err) return false;
  return String(err.code || '') === '42501' || /permission denied/i.test(String(err.message || ''));
}

/**
 * Pure verdict over the RPC payload. Returns { code, lines }. Exercised by the
 * canary; main() only does I/O. Never puts an id in a line.
 */
export function check(payload) {
  if (payload === null || payload === undefined) {
    return { code: 1, lines: [`FAIL: ${RPC} returned NULL. The contract is uuid[] never NULL ({} when none); the callers read NULL as "none hidden", which fails OPEN.`] };
  }
  if (!Array.isArray(payload)) {
    return { code: 1, lines: [`FAIL: ${RPC} returned a ${typeof payload} payload, not an array. fetchOrganiserDirectoryHiddenIds throws on that, so /organisers errors and the sitemap 500s.`] };
  }
  const notUuid = payload.filter((v) => typeof v !== 'string' || !UUID_RE.test(v)).length;
  if (notUuid > 0) {
    return { code: 1, lines: [`FAIL: ${notUuid} of ${payload.length} element(s) of ${RPC} are not uuid strings. The callers compare them against organiser ids, so a wrong type hides nothing.`] };
  }
  const duplicates = payload.length - new Set(payload.map((v) => v.toLowerCase())).size;
  if (duplicates > 0) {
    return { code: 1, lines: [`FAIL: ${RPC} returned ${duplicates} duplicate id(s) over ${payload.length} element(s). The rule's set logic is broken.`] };
  }
  const lines = [`organiser hidden-ids contract: ok (${payload.length} hidden id(s), all uuid strings, 0 duplicates).`];
  if (payload.length === 0) {
    lines.push('note: 0 hidden ids -- the normal state today. What passed is the anon call and the uuid[] type; the element arms compared nothing this run.');
  }
  return { code: 0, lines };
}

function makeCall(url, key, createClient) {
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return () => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), RPC_TIMEOUT_MS);
    return sb
      .rpc(RPC)
      .abortSignal(ac.signal)
      .then((r) => r)
      .finally(() => clearTimeout(timer));
  };
}

/** Owns the exit code: it RETURNS the integer and the CLI tail assigns it (R5). */
export async function main(argv = [], deps = {}) {
  const {
    env: baseEnv = process.env,
    readEnvFile = null,
    makeRpcCall = null,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    out = console.log,
    err = console.error,
  } = deps ?? {};

  const KNOWN_FLAGS = ['--self-test'];
  const unknown = argv.filter((a) => !KNOWN_FLAGS.includes(a));
  if (unknown.length > 0) {
    err('Unknown flag(s): ' + unknown.join(', ') + '. Known: ' + KNOWN_FLAGS.join(', '));
    return 2;
  }
  if (argv.includes('--self-test')) {
    return (await selfTest()) ? 0 : 1;
  }

  const env = loadEnv(baseEnv, readEnvFile);
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    err('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
    return 2;
  }

  let call;
  try {
    if (makeRpcCall) {
      call = makeRpcCall(url, key);
    } else {
      // Imported dynamically so a missing dependency is exit 2, not a load-time throw.
      const { createClient } = await import('@supabase/supabase-js');
      call = makeCall(url, key, createClient);
    }
  } catch (e) {
    err('Could not set up the client: ' + (e?.message ?? String(e)));
    return 2;
  }

  let data;
  let error;
  try {
    ({ data, error } = await call());
    if (error && isTransient(error)) {
      err(`Transient error (${error.code || '?'}: ${error.message}); retrying once in 2s...`);
      await sleep(2000);
      ({ data, error } = await call());
    }
  } catch (e) {
    err('Transport/unexpected error: ' + (e?.message ?? String(e)));
    return 2;
  }

  if (error) {
    if (isFunctionMissing(error)) {
      err(`FAIL: ${RPC} not found as anon (${error.code ?? '?'}: ${error.message}).\n` +
        '      Renamed or dropped. /organisers, the sitemap and the head count all call it\n' +
        '      through src/lib/organiserDirectoryHiddenIds.ts and THROW. Restore it in the\n' +
        '      ADMIN repo (shipped by 20270304210000) or move every caller in the same change.');
      return 1;
    }
    if (isPermissionDenied(error)) {
      // Either way anon cannot use the RPC, so both are exit 1; only the
      // remediation differs (a body reading a table anon cannot read is not a revoke).
      const revoked = /permission denied for function/i.test(String(error.message || ''));
      err(`FAIL: anon ${revoked ? 'may no longer execute' : 'hits a permission error inside'} ${RPC} (${error.code ?? '?'}: ${error.message}).\n` +
        '      Every public caller is anon, so /organisers errors and the sitemap 500s.\n' +
        (revoked
          ? '      Restore the anon EXECUTE grant in the ADMIN repo.'
          : '      The function body reads something anon cannot (SECURITY DEFINER lost?); fix it in the ADMIN repo.'));
      return 1;
    }
    err(`Transport/unexpected error: ${error.code ?? '?'}: ${error.message}`);
    return 2;
  }

  const verdict = check(data);
  for (const line of verdict.lines) (verdict.code === 0 ? out : err)(line);
  return verdict.code;
}

/**
 * Canary (R4/R5): prove the verdict can FAIL before trusting it to pass, and
 * drive main() -- the exit owner -- through every branch. Pure: no network, no
 * credentials, no .env read.
 */
const MIN_CASES = 25;

export async function selfTest(log = console.log) {
  const A = '0b8f3c1e-5d2a-4f6b-9c7d-1e2f3a4b5c6d';
  const B = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const cases = [];
  const add = (name, fn, expected) => {
    let actual;
    try { actual = fn(); } catch (e) { actual = `THREW ${e?.message ?? e}`; }
    cases.push({ name, actual, expected });
  };

  // --- the verdict, both directions ---
  add('null is a violation', () => check(null).code, 1);
  add('undefined is a violation', () => check(undefined).code, 1);
  add('an object is a violation (non-array)', () => check({ ids: [A] }).code, 1);
  add('a string is a violation (non-array)', () => check(`{${A}}`).code, 1);
  add('a number element is a violation', () => check([A, 42]).code, 1);
  add('a non-uuid string element is a violation', () => check([A, 'not-a-uuid']).code, 1);
  add('a null element is a violation', () => check([null]).code, 1);
  add('a duplicate is a violation', () => check([A, B, A]).code, 1);
  add('a case-only duplicate is a violation', () => check([A, A.toUpperCase()]).code, 1);
  add('empty is GREEN', () => check([]).code, 0);
  add('empty says it compared nothing', () => check([]).lines.join('\n').includes('compared nothing'), true);
  add('valid ids are GREEN', () => check([A, B]).code, 0);
  add('the green line carries the count', () => check([A, B]).lines[0].includes('2 hidden id(s)'), true);
  add('no line ever prints an id (green)', () => check([A, B]).lines.join('\n').includes(A), false);
  add('no line ever prints an id (red)', () => check([A, A]).lines.join('\n').includes(A), false);

  // --- error classification, both directions ---
  add('57014 is transient', () => isTransient({ code: '57014', message: 'x' }), true);
  add('our own abort timeout is transient', () => isTransient({ code: '', message: 'AbortError: This operation was aborted' }), true);
  add('a genuine SQL error is NOT transient', () => isTransient({ code: '42883', message: 'operator does not exist' }), false);
  add('PGRST202 is function-missing', () => isFunctionMissing({ code: 'PGRST202', message: 'x' }), true);
  add('a 42883 naming the RPC is function-missing', () => isFunctionMissing({ code: '42883', message: `function public.${RPC}() does not exist` }), true);
  add('a 42883 naming a helper is NOT function-missing', () => isFunctionMissing({ code: '42883', message: 'function public._helper(uuid) does not exist' }), false);
  add('a relation error is NOT function-missing', () => isFunctionMissing({ code: '42P01', message: 'relation "organisers" does not exist' }), false);
  add('42501 is permission-denied', () => isPermissionDenied({ code: '42501', message: `permission denied for function ${RPC}` }), true);
  add('a timeout is NOT permission-denied', () => isPermissionDenied({ code: '57014', message: 'canceling statement' }), false);

  // --- THE EXIT-CODE CONTRACT ITSELF: drive main(), pin the branch ---
  const CREDS = { VITE_SUPABASE_URL: 'https://example.invalid', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' };
  const drive = async (responses, extra = {}) => {
    const errs = [];
    const outs = [];
    let calls = 0;
    const code = await main([], {
      env: CREDS,
      readEnvFile: () => null,
      sleep: async () => {},
      out: (l) => outs.push(l),
      err: (l) => errs.push(l),
      makeRpcCall: () => async () => {
        const r = responses[Math.min(calls, responses.length - 1)];
        calls += 1;
        if (r instanceof Error) throw r;
        return r;
      },
      ...extra,
    });
    return { code, text: [...outs, ...errs].join('\n'), calls };
  };
  const exitCases = [
    ['green payload is 0', [{ data: [A, B], error: null }], 0, 'contract: ok'],
    ['empty payload is 0', [{ data: [], error: null }], 0, 'compared nothing'],
    ['null payload is 1', [{ data: null, error: null }], 1, 'returned NULL'],
    ['non-array payload is 1', [{ data: { a: 1 }, error: null }], 1, 'not an array'],
    ['non-uuid element is 1', [{ data: ['x'], error: null }], 1, 'not uuid strings'],
    ['duplicate is 1', [{ data: [A, A], error: null }], 1, 'duplicate'],
    ['missing RPC is 1', [{ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }], 1, 'not found as anon'],
    ['revoked grant is 1', [{ data: null, error: { code: '42501', message: `permission denied for function ${RPC}` } }], 1, 'may no longer execute'],
    ['a body permission error is 1, not called a revoke', [{ data: null, error: { code: '42501', message: 'permission denied for table organisers' } }], 1, 'inside'],
    ['abort timeout twice is 2', [{ data: null, error: { code: '', message: 'AbortError: This operation was aborted' } }], 2, 'retrying once'],
    ['unknown DB error is 2', [{ data: null, error: { code: 'XX000', message: 'internal' } }], 2, 'Transport/unexpected error: XX000'],
    ['transient twice is 2', [{ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }], 2, 'retrying once'],
    ['transient then green is 0', [{ data: null, error: { code: '57014', message: 'canceling statement' } }, { data: [], error: null }], 0, 'contract: ok'],
    ['a thrown transport error is 2', [new Error('fetch failed')], 2, 'fetch failed'],
  ];
  const exitResults = [];
  for (const [name, responses, wantCode, wantText] of exitCases) {
    // A throw is recorded as a failure, never allowed to abort the canary
    // before any result prints (a mutant with zero FAIL lines is a finding).
    const r = await drive(responses).catch((e) => ({ code: `THREW ${e?.message ?? e}`, text: '' }));
    exitResults.push({ name, actual: r.code === wantCode && r.text.includes(wantText) ? 'ok' : `code ${r.code}: ${r.text}`, expected: 'ok' });
  }
  const retried = await drive([{ data: null, error: { code: '57014', message: 'x' } }, { data: [], error: null }]);
  exitResults.push({ name: 'a transient error is retried exactly once', actual: retried.calls, expected: 2 });
  const noCreds = await main([], { env: {}, readEnvFile: () => null, out: () => {}, err: () => {} });
  exitResults.push({ name: 'missing credentials is 2', actual: noCreds, expected: 2 });
  const badFlag = await main(['--bogus'], { out: () => {}, err: () => {} });
  exitResults.push({ name: 'an unknown flag is 2', actual: badFlag, expected: 2 });
  const badSetup = await drive([], { makeRpcCall: () => { throw new Error('no module'); } });
  exitResults.push({ name: 'a client that cannot be built is 2', actual: badSetup.code, expected: 2 });

  let failed = 0;
  const all = [...cases, ...exitResults];
  for (const c of all) {
    const ok = c.actual === c.expected;
    if (!ok) failed++;
    log(`${ok ? '  ok  ' : '  FAIL'} ${c.name}${ok ? '' : ` (got ${JSON.stringify(c.actual)}, want ${JSON.stringify(c.expected)})`}`);
  }
  // Non-vacuity on the canary itself: "PASS -- 0 cases" must be impossible.
  if (all.length < MIN_CASES) {
    log(`  FAIL non-vacuity: ran ${all.length} case(s), expected at least ${MIN_CASES}`);
    failed++;
  }
  log(failed === 0
    ? `PASS self-test -- ${all.length} cases, the contract proven in both directions.`
    : `FAIL self-test -- ${failed} failure(s) over ${all.length} case(s).`);
  return failed === 0;
}

if (isEntryPoint(import.meta.url)) {
  // process.exitCode, never process.exit(): supabase-js leaves a fetch handle open.
  process.exitCode = await main(process.argv.slice(2));
}
