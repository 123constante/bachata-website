#!/usr/bin/env node
/**
 * CI contract check #48 - anon-grant posture (raffle Phase 1, 2026-07-10).
 *
 * Calls public.check_anon_grants_contract_v1(), which asserts the six raffle /
 * guest self-signup tables stay locked down so public writes cannot bypass the
 * SECURITY DEFINER RPC chokepoint (submit_raffle_entry / submit_guest_list_entry).
 * The 2026-07-08 audit found anon holding INSERT/UPDATE/DELETE on all six tables
 * plus an anon-EXECUTE get_secret_value() Vault-exfiltration hole. Supabase's
 * default ALTER DEFAULT PRIVILEGES ... GRANT EXECUTE ... TO anon, authenticated
 * means the next migration can silently re-open this - hence the standing gate.
 *
 * Guarded dimensions (all must be 0):
 *   - table_dml_violations:       anon/authenticated hold table DML on a self-signup table
 *   - column_dml_violations:      ... or column-level DML
 *   - rls_posture_violations:     RLS disabled, or a permissive anon/PUBLIC write policy
 *   - secret_execute_violations:  anon-EXECUTE on a Vault-secret-reading SECURITY DEFINER fn
 *   - internal_writer_violations: anon/authenticated EXECUTE on an internal `_`-prefixed writer
 *
 * GATING: ok=true required. Any violation fails the build.
 *
 * Local:  node scripts/check-anon-grants.mjs   (reads .env)
 * CI:     env VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 * See:    admin repo migrations/20260710010000_check_anon_grants_contract_v1.sql
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

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

const { data, error } = await sb.rpc('check_anon_grants_contract_v1');

if (error) {
  if (/function .* does not exist|could not find/i.test(error.message)) {
    console.error(
      `FAIL: check_anon_grants_contract_v1 not found (${error.message}) - the anon-grant ` +
      `gate RPC is missing, contract broken.`,
    );
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.ok !== true) {
  console.error(
    `\nANON-GRANT POSTURE FAIL: anon/authenticated have regained write access to a raffle/` +
    `guest self-signup table (or EXECUTE on a secret-reading / internal writer). A GRANT ALL ` +
    `migration has bypassed the SECURITY DEFINER chokepoint. Fix: REVOKE ... FROM anon, ` +
    `authenticated, PUBLIC on the offending object(s) named above.`,
  );
  process.exit(1);
}

console.log('\nAnon-grant posture: ok (0 table/column DML, RLS, secret-exec, internal-writer violations).');
process.exit(0);
