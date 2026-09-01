#!/usr/bin/env node
/**
 * CI mutation contract check for the ADR-007 sync trigger family.
 * Calls public.test_per_date_program_sync_mutation_v1() and exits
 * non-zero if any of the six trigger scenarios fail to propagate
 * to calendar_occurrences.override_payload.program.
 *
 * Why: the static contract checks
 * (check_per_date_program_canonical_consistency_v1,
 *  check_occurrence_instance_time_canonical_v1) verify a snapshot. A
 * silent AFTER-trigger failure on a single mutation can ship to the
 * public site for up to 24h before the daily 06:00 UTC run catches
 * the resulting drift. This RPC writes synthetic test data, exercises
 * every trigger path (cso INSERT/UPDATE/DELETE, added-session
 * INSERT/DELETE, event_program_items UPDATE fan-out), and always
 * tears down — surfacing trigger health on every CI run.
 *
 * The test event is `lifecycle='draft' is_active=false`, created with
 * a sentinel name (`adr007-sync-test-<epoch>`); not visible to the
 * public website at any point.
 *
 * Local:  node scripts/check-per-date-program-sync-mutation.mjs
 * CI:     same script, env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { rpcOnce, exitTransient } from './lib/rpc-retry.mjs';

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

const env = loadEnv();
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.SUPABASE_PUBLISHABLE_KEY ||
  env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(2);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// rpcOnce, NOT rpcWithRetry: this RPC mutates. A timeout leaves you unable to
// say whether the write landed, so a second attempt risks applying it twice.
// The transient classification still routes a 57014 to exit 2 -- what it does
// not do is pretend the call is safe to repeat.
let data;
try {
  data = await rpcOnce(sb, 'test_per_date_program_sync_mutation_v1');
} catch (e) {
  exitTransient(e, 'per-date program sync mutation');
  console.error('RPC failed:', e.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.status !== 'ok') {
  const fails = Array.isArray(data?.failures) ? data.failures.join('\n  - ') : '<unknown>';
  console.error(
    `\nTRIGGER SYNC MUTATION FAILED:\n  - ${fails}\n\n` +
    `Fix: investigate which AFTER trigger silently failed. Likely culprits:\n` +
    `  * trg_sync_override_payload_program_v1 (on cso / added_sessions)\n` +
    `  * trg_sync_override_payload_program_from_program_items_v1 (admin migration 20260625010000)\n` +
    `  * recompute_override_payload_program_v1 + recompute_override_payload_program_for_event_v1`,
  );
  process.exit(1);
}

console.log('\nper_date_program_sync_mutation check: ok (all 6 trigger scenarios verified).');
process.exit(0);
