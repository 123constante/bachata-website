#!/usr/bin/env node
/**
 * CI integrity check for the event-program relational tree / meta_data.program
 * canvas consistency contract.
 *
 * Calls public.check_replace_event_program_canvas_consistency_v1() and
 * asserts that every event's meta_data.program session count matches its
 * event_program_items count. Drift means the relational program tree fell
 * out of sync with the meta_data snapshot — typically caused by a regression
 * in replace_event_program or the admin save path.
 *
 * Exit policy:
 *   • events_with_drift = 0             → exit 0 (pass)
 *   • events_with_drift ≤ DRIFT_BASELINE → exit 0 (warn only)
 *   • events_with_drift > DRIFT_BASELINE → exit 1 (fail; new drift)
 *   • RPC error                          → exit 2
 *
 * Baseline: 0 (Phase F backfill on 2026-05-07 cleared all pre-existing drift;
 * drift must stay at zero going forward).
 *
 * Local:  node scripts/check-replace-event-program-canvas-consistency.mjs
 * CI:     same script, env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See:
 *   admin repo migrations/20260510010000_replace_event_program_start_time_fallback.sql
 *   admin repo migrations/20260510030000_check_replace_event_program_canvas_consistency_v1.sql
 *   admin repo migrations/20260510040000_backfill_event_program_relational_drift_v1.sql
 *   admin repo migrations/20260510050000_delete_untitled_null_date_draft_v1.sql
 *   .github/workflows/db-contract-check.yml
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DRIFT_BASELINE = 0;

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

const { data, error } = await sb.rpc('check_replace_event_program_canvas_consistency_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

const drifted = Number.isFinite(data?.events_with_drift) ? data.events_with_drift : NaN;
const clean   = Number.isFinite(data?.events_clean) ? data.events_clean : NaN;

if (!Number.isFinite(drifted) || !Number.isFinite(clean)) {
  console.error('\nFAIL: contract RPC returned malformed payload.');
  process.exit(2);
}

if (drifted === 0) {
  console.log(`\nOK: 0 drifted of ${clean + drifted} events with program. Contract holds.`);
  process.exit(0);
}

if (drifted <= DRIFT_BASELINE) {
  console.warn(
    `\nWARN: ${drifted} drifted of ${clean + drifted} events (baseline: ${DRIFT_BASELINE}). ` +
    `No regression. Sample IDs above for review.`,
  );
  process.exit(0);
}

console.error(
  `\nFAIL: ${drifted} drifted of ${clean + drifted} events (baseline: ${DRIFT_BASELINE}). ` +
  `New drift introduced — meta_data.program and event_program_items are out of sync. ` +
  `Check replace_event_program or the admin save path. Sample IDs above.`,
);
process.exit(1);