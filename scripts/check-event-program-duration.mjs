#!/usr/bin/env node
/**
 * CI integrity check for the event-program duration contract.
 *
 * Calls public.check_event_program_duration_contract_v1() and reports
 * how many standard events have a duration drifted > 240 minutes from
 * their meta_data.program span.
 *
 * Exit policy:
 *   • drifted = 0 → exit 0 (pass)
 *   • drifted ≤ DRIFT_BASELINE → exit 0 (warn only)
 *   • drifted > DRIFT_BASELINE → exit 1 (fail; new drift introduced)
 *
 * The baseline starts at 1 (matching today's known legitimate-drift row,
 * "The Dominican Festival" at 0a723ebd-…). Bump this only after auditing
 * the new sample and confirming it is not a regression of the picker bug.
 *
 * Local:  node scripts/check-event-program-duration.mjs   (reads .env)
 * CI:     same script, env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See:
 *   admin repo migrations/20260429310000_event_times_server_derived_v1.sql
 *   admin repo migrations/20260429311000_admin_save_event_v2_impl_two_tier_derive.sql
 *   admin repo migrations/20260429320000_event_program_duration_contract_v1.sql
 *   plan_event_time_model_hardening.md
 *   .github/workflows/db-contract-check.yml
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DRIFT_BASELINE = 1;

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

const { data, error } = await sb.rpc('check_event_program_duration_contract_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

const drifted = Number.isFinite(data?.drifted) ? data.drifted : NaN;
const total   = Number.isFinite(data?.total_standard_with_program) ? data.total_standard_with_program : NaN;

if (!Number.isFinite(drifted) || !Number.isFinite(total)) {
  console.error('\nFAIL: contract RPC returned malformed payload.');
  process.exit(2);
}

if (drifted === 0) {
  console.log(`\nOK: 0 drifted of ${total} standard events with program. Contract holds.`);
  process.exit(0);
}

if (drifted <= DRIFT_BASELINE) {
  console.warn(
    `\nWARN: ${drifted} drifted of ${total} (baseline: ${DRIFT_BASELINE}). ` +
    `No regression. Sample IDs above for review.`,
  );
  process.exit(0);
}

console.error(
  `\nFAIL: ${drifted} drifted of ${total} (baseline: ${DRIFT_BASELINE}). ` +
  `New drift introduced — likely a client-side time-mutation regression. ` +
  `Investigate the sample IDs above.`,
);
process.exit(1);
