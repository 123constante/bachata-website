#!/usr/bin/env node
/**
 * CI integrity check for the guest-entries contract (Phase 6).
 *
 * Calls public.check_guest_entries_contract_v1() and fails if the aggregate
 * anomaly count exceeds RAFFLE_GUEST_BASELINE (default 0).
 *
 * Tracked anomalies:
 *   - past_retention_unpurged: entries on events ended >90 days ago that
 *     the daily cron has not yet purged. >0 means the cron is not running
 *     or is failing.
 *   - stale_unconsumed_tokens: erasure tokens issued >30 days ago without
 *     consumed_at. >0 may indicate a UX dead-end (admin generated link but
 *     dancer never used it). Not strictly a defect; included for visibility.
 *   - active_with_ineligible_reason: rows with status='active' AND
 *     ineligible_reason set. Should be impossible after the Phase 3 atomic
 *     status flip patch.
 *   - raffle_null_qr_token / guest_list_null_qr_token: rows missing the
 *     auto-issued qr_token. Should be impossible after Phase 1 default.
 *
 * Local:  node scripts/check-guest-entries-contract.mjs
 * CI:     env vars VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See:
 *   admin repo migrations/20260502120000_guest_entries_extend_v1.sql
 *   admin repo migrations/20260502130000_event_capacity_v1.sql
 *   admin repo migrations/20260502140000_raffle_ineligible_reason_check_v1.sql
 *   admin repo migrations/20260502150000_guest_entries_admin_surface_v1.sql
 *   admin repo migrations/20260502160000_guest_entry_erasure_v1.sql
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const RAFFLE_GUEST_BASELINE = 0;

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

const { data, error } = await sb.rpc('check_guest_entries_contract_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

const anomalyCount = Number.isFinite(data?.anomaly_count) ? data.anomaly_count : NaN;

if (!Number.isFinite(anomalyCount)) {
  console.error('\nFAIL: contract RPC returned malformed payload.');
  process.exit(2);
}

if (anomalyCount === 0) {
  console.log('\nOK: 0 anomalies. Contract holds.');
  process.exit(0);
}

if (anomalyCount <= RAFFLE_GUEST_BASELINE) {
  console.warn(
    `\nWARN: ${anomalyCount} anomalies (baseline: ${RAFFLE_GUEST_BASELINE}). No regression.`,
  );
  process.exit(0);
}

console.error(
  `\nFAIL: ${anomalyCount} anomalies (baseline: ${RAFFLE_GUEST_BASELINE}). ` +
  `Investigate per-field counts above. Likely the daily purge cron is not running, ` +
  `or an admin RPC bypassed the Phase 3 atomic status flip.`,
);
process.exit(1);
