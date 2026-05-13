#!/usr/bin/env node
/**
 * CI integrity check for the event_program_people.avatar_url drift contract.
 * Calls public.check_epp_avatar_url_drift_v1() and exits non-zero if any
 * public routine body still references the dropped column.
 *
 * Sibling of the display-name drift check (admin scripts/check-epp-display-name-drift.mjs).
 * On 2026-05-09 four live RPCs were found referencing the dropped column —
 * see admin migrations 20260527020000 / 20260527030000 / 20260527040000.
 *
 * Local:  node scripts/check-epp-avatar-url-drift.mjs
 * CI:     same script, env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
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

const { data, error } = await sb.rpc('check_epp_avatar_url_drift_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (!data?.healthy) {
  const offenders = Array.isArray(data?.offenders) ? data.offenders.join(', ') : '<unknown>';
  console.error(
    `\nDRIFT DETECTED: ${data?.offender_count ?? '?'} public routine(s) still reference ` +
    `event_program_people.avatar_url (dropped Phase A.5).\nOffenders: ${offenders}\n` +
    `Fix: replace epp.avatar_url with NULL::text in the SELECT list / aggregate. ` +
    `The avatar comes from the canonical profile (dp.avatar_url, etc.) via the ` +
    `outer COALESCE chain — the EPP slot has been null-only since the column drop.`,
  );
  process.exit(1);
}

console.log('\nepp.avatar_url drift check: healthy (0 offenders).');
process.exit(0);
