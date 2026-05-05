#!/usr/bin/env node
/**
 * CI integrity check for the Phase 1 v2 admin_save_program_v2 contract.
 *
 * Calls public.check_program_save_v2_idempotency_v1() and reports the health
 * of the program-save audit invariants introduced by admin migration
 * 20260505010000_admin_save_program_v2_v1.sql.
 *
 * Exit policy:
 *   - duplicate_success_tokens > 0                  -> exit 1 (FAIL)
 *       Two or more 'success' rows share the same (event_id, token); the
 *       advisory-lock guard on admin_save_program_v2 has been bypassed and
 *       idempotency is broken. Hard contract failure.
 *
 *   - failed_saves_last_24h > FAILED_SAVES_24H_BASELINE -> exit 1 (FAIL)
 *       Informational signal that crossed the soak threshold. Start at 0;
 *       raise the baseline if a benign cause is identified (e.g. genuine
 *       end-user concurrent_edit during a 3-way collaborative edit).
 *
 *   - both within bounds                             -> exit 0 (OK)
 *
 * Baseline established 2026-05-05 from check_program_save_v2_idempotency_v1
 * immediately after migration apply: {duplicate_success_tokens: 0,
 * failed_saves_last_24h: 0, audit_rows_total: 28}.
 *
 * Local:  node scripts/check-program-save-idempotency-contract.mjs   (reads .env)
 * CI:     same script, env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See:
 *   admin repo migrations/20260505010000_admin_save_program_v2_v1.sql
 *   .github/workflows/db-contract-check.yml
 *   plan_program_editor_production_grade.md (Phase 1 v2 / Track A)
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const FAILED_SAVES_24H_BASELINE = 0;

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

const { data, error } = await sb.rpc('check_program_save_v2_idempotency_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

const dupTokens     = Number.isFinite(data?.duplicate_success_tokens) ? data.duplicate_success_tokens : NaN;
const failed24h     = Number.isFinite(data?.failed_saves_last_24h)    ? data.failed_saves_last_24h    : NaN;
const auditRows     = Number.isFinite(data?.audit_rows_total)         ? data.audit_rows_total         : NaN;

if (
  !Number.isFinite(dupTokens) ||
  !Number.isFinite(failed24h) ||
  !Number.isFinite(auditRows)
) {
  console.error('\nFAIL: contract RPC returned malformed payload.');
  process.exit(2);
}

let failed = false;

if (dupTokens > 0) {
  console.error(
    `\nFAIL: ${dupTokens} (event_id, idempotency_token) pair(s) have multiple ` +
    `'success' audit rows. The advisory-lock guard on admin_save_program_v2 ` +
    `has been bypassed; idempotency replay is broken.`,
  );
  failed = true;
}

if (failed24h > FAILED_SAVES_24H_BASELINE) {
  console.error(
    `\nFAIL: ${failed24h} failed save(s) in the last 24h ` +
    `(baseline: ${FAILED_SAVES_24H_BASELINE}). Inspect event_save_audit ` +
    `WHERE outcome='failed' to identify the error_code.`,
  );
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log(
  `\nOK: ${auditRows} audit rows total, ` +
  `${dupTokens} duplicate-success-tokens, ` +
  `${failed24h} failed-saves-last-24h (baseline: ${FAILED_SAVES_24H_BASELINE}). ` +
  `Contract holds.`,
);
process.exit(0);
