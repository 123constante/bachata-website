#!/usr/bin/env node
/**
 * CI integrity check for the 5 FK indexes added by admin migration
 * 20260512000000_add_missing_fk_indexes_v1. Calls
 * public.check_fk_indexes_v1() and exits non-zero if any of the indexes
 * has been dropped out-of-band.
 *
 * Local:  node scripts/check-fk-indexes.mjs   (reads .env)
 * CI:     same script, env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See admin migrations 20260512000000_add_missing_fk_indexes_v1 and
 * 20260512030000_check_fk_indexes_and_attendees_target_v1.
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

const { data, error } = await sb.rpc('check_fk_indexes_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (!data?.ok) {
  const missing = Array.isArray(data?.missing_indexes) ? data.missing_indexes : [];
  console.error(
    `\nFAIL: ${missing.length} of ${data?.expected_count ?? 5} FK indexes missing.`,
  );
  for (const m of missing) {
    console.error(`  - ${m.table}.${m.column}`);
  }
  process.exit(1);
}

console.log('\nOK: all Phase 1 FK indexes present.');
process.exit(0);
