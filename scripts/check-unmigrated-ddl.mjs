#!/usr/bin/env node
/**
 * CI drift gate: out-of-band schema changes on prod.
 *
 * Calls public.check_unmigrated_schema_changes_contract_v1(), which counts DDL
 * recorded in ddl_audit_log since the last MIGRATION_BOUNDARY sentinel
 * (mark_migration_complete), excluding pg_temp transients and privilege-only
 * GRANT/REVOKE. A nonzero drift_count means real structural DDL hit prod WITHOUT
 * a committed migration that ended with mark_migration_complete() — i.e. the
 * out-of-band-change class that breaks migration replay (admin ADR-009).
 *
 * Local:  node scripts/check-unmigrated-ddl.mjs        (reads .env)
 * CI:     env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * Fix when this fails: wrap the change in a versioned migration in the admin repo
 * (supabase/migrations, dated after the current max) and end its body with
 * SELECT public.mark_migration_complete('<version>'); then re-run.
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

const { data, error } = await sb.rpc('check_unmigrated_schema_changes_contract_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

const drift = Number(data?.drift_count ?? 0);
if (drift > 0) {
  console.error(
    `\nFAIL: ${drift} unmigrated structural DDL change(s) on prod since boundary ` +
    `${data?.boundary_version ?? '(none)'}. Wrap them in a migration that ends with ` +
    `mark_migration_complete().`,
  );
  process.exit(1);
}

console.log('\nOK: no out-of-band schema drift since the last migration boundary.');
process.exit(0);
