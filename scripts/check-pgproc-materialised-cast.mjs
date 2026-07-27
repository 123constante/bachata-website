#!/usr/bin/env node
/**
 * CI contract check: no public function miscasts materialised_(start|end)_utc.
 *
 * materialised_start_utc / materialised_end_utc hold a NAIVE London wall clock
 * stamped +00 (stash_local_as_utc STAMPS, it does not convert). The ONLY correct
 * way to unstamp is `AT TIME ZONE 'UTC'`; any other zone re-applies the offset and
 * yields the +1h double-cast that shipped in search_public_v5 and
 * _event_view_snapshot_compat_v1 (fixed by admin migrations 20260726010000 /
 * 20260726015000). This is the SQL analogue of the client's WallClock brand lint.
 *
 * Calls public.check_no_materialised_utc_miscast_v1() (anon-callable; scans
 * pg_proc.prosrc for `materialised_%_utc AT TIME ZONE <not 'UTC'>`) and fails if
 * any offender exists.
 *
 * Local:  node scripts/check-pgproc-materialised-cast.mjs      (reads .env)
 * CI:     VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY as repo secrets.
 *
 * See admin migration 20260726040000_check_no_materialised_utc_miscast_v1 and
 * .github/workflows/db-contract-check.yml.
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

function isTransient(err) {
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
    msg.includes('network')
  );
}

const callGuard = () => sb.rpc('check_no_materialised_utc_miscast_v1');

let { data, error } = await callGuard();
if (error && isTransient(error)) {
  console.error(`Transient error (${error.code || '?'}: ${error.message}); retrying once in 2s...`);
  await new Promise((r) => setTimeout(r, 2000));
  ({ data, error } = await callGuard());
}

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.status !== 'ok') {
  const offenders = Array.isArray(data?.offenders) ? data.offenders : [];
  console.error(`\nFAIL: ${data?.drift_count ?? '?'} function(s) miscast materialised_*_utc through a non-UTC zone:`);
  for (const o of offenders) console.error(`  - ${o}`);
  console.error('\nFix: the stored value is a wall clock stamped +00. Unstamp with AT TIME ZONE \'UTC\' (or pass it through); never re-convert through the series/city tz.');
  process.exit(1);
}

console.log('\nOK: no public function miscasts materialised_*_utc (0 offenders).');
process.exit(0);
