#!/usr/bin/env node
/**
 * CI integrity check for the "ghost override" drift class on
 * calendar_occurrences: is_override = true left behind after the P5 override
 * row emptied, with no real override content anywhere (no venue/city, empty
 * payload, no session/added-session overrides) -- the "ghost OVR badge" class.
 * Calls public.check_override_mirror_ghost_v1().
 *
 * Local:  node scripts/check-override-mirror-ghost.mjs             (reads .env)
 *         node scripts/check-override-mirror-ghost.mjs --self-test (prove it fails)
 * CI:     .github/workflows/db-contract-check.yml, with repo secrets
 *           VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * Exit: 0 pass, 1 ghost rows present, 2 infrastructure (creds, RPC, or the
 * check measured nothing). Anon-callable; no Docker.
 *
 * See admin migration 20260704140000_check_override_mirror_ghost_and_heal_v1.
 * Retires with the legacy mirror at single-engine convergence Lever 1E.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

/**
 * The whole verdict, as a pure function of the RPC's two outputs -- so the
 * canary below can drive every branch without a database.
 *
 * The `total_is_override === 0` branch is the point of the exercise. A guard
 * that says "no ghosts" when it examined no rows has measured nothing and is
 * reporting green from its own blind spot -- the exact failure class this
 * repo's R1 rule exists to catch. Prod carries hundreds of is_override rows,
 * so zero means the read broke, not that the data got clean.
 */
export function verdict(data, error) {
  if (error) return { code: 2, message: `RPC failed: ${error.message}` };
  if (!data || typeof data !== 'object') {
    return { code: 2, message: 'RPC returned no payload -- nothing was measured.' };
  }
  if (data.total_is_override === 0) {
    return {
      code: 2,
      message:
        'Measured 0 rows with is_override=true. Prod always carries some, so this is a broken read, not a clean result.',
    };
  }
  if (!data.ok) {
    return {
      code: 1,
      message: `FAIL: ${data.ghost_count ?? '?'} ghost override row(s) found (is_override=true with no override content).`,
    };
  }
  return {
    code: 0,
    message: `OK: no ghost override rows (checked ${data.total_is_override} with is_override=true).`,
  };
}

/**
 * Canary (R4). Proves the verdict can return each code -- a guard nobody has
 * seen fail is not a guard. Both directions per branch, not just the happy one.
 */
function selfTest() {
  const cases = [
    ['healthy data passes', { ok: true, ghost_count: 0, total_is_override: 335 }, null, 0],
    ['ghost rows fail', { ok: false, ghost_count: 7, total_is_override: 335 }, null, 1],
    ['rpc error is infrastructure', null, { message: 'boom' }, 2],
    ['null payload is not green', null, null, 2],
    ['zero rows measured is not green', { ok: true, ghost_count: 0, total_is_override: 0 }, null, 2],
  ];

  let failed = 0;
  for (const [name, data, error, want] of cases) {
    const got = verdict(data, error).code;
    const ok = got === want;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name} (want ${want}, got ${got})`);
  }

  if (failed) {
    console.error(`\nself-test FAILED: ${failed} case(s).`);
    process.exitCode = 1;
  } else {
    console.log(`\nself-test passed (${cases.length} cases).`);
  }
}

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

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY;

  // Missing creds is infrastructure, not a clean bill of health (R3). Safe to
  // process.exit() here: nothing has opened a socket yet.
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
    process.exit(2);
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await sb.rpc('check_override_mirror_ghost_v1');

  if (data) console.log(JSON.stringify(data, null, 2));

  const { code, message } = verdict(data, error);
  if (code === 0) console.log('\n' + message);
  else console.error('\n' + message);

  // Set process.exitCode; do NOT process.exit() past the RPC. supabase-js
  // leaves an undici fetch handle open and process.exit() tears the loop down
  // mid-close -- on Windows node aborts with
  //   Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src\win\async.c:76
  // exiting -1073740791 AFTER printing "OK". A green check that fails its own
  // invocation reads as a real red. Reproduced on this script before the fix.
  process.exitCode = code;
}

if (process.argv.includes('--self-test')) selfTest();
else await main();
