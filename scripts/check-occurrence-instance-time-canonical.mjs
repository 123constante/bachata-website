#!/usr/bin/env node
/**
 * CI integrity check for the occurrence instance_start/end vs canonical
 * program time contract. Calls
 * public.check_occurrence_instance_time_canonical_v1() and exits non-zero
 * if any calendar_occurrence's materialised UTC bounds disagree with the
 * earliest/latest session derived from the canonical join.
 *
 * Background: ADR-007 Phase 5. instance_start/end is a UTC mirror of the
 * canonical program (event_program_items shifted to the occurrence's local
 * date, then converted via the series timezone). Maintained by
 * recompute_occurrence_times_v1 (admin migration 20260623070000), fixed
 * for tz-extraction (20260623080000) and midnight-crossing events
 * (20260623090000). Drift here surfaces as wrong sort order on the public
 * calendar and incorrect ICS exports.
 *
 * Local:  node scripts/check-occurrence-instance-time-canonical.mjs
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

const { data, error } = await sb.rpc('check_occurrence_instance_time_canonical_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.status !== 'ok') {
  const drift = data?.drift_count ?? '?';
  const total = data?.occurrences_total ?? '?';
  console.error(
    `\nDRIFT DETECTED: ${drift}/${total} occurrence(s) have instance_start/end ` +
    `that disagrees with the canonical program join.\n` +
    `Fix: run public.recompute_occurrence_times_v1(<occurrence_id>) on each ` +
    `affected row. If many rows drifted at once, suspect a regression in ` +
    `the canonical → UTC mapping (tz extraction, midnight-cross arithmetic, ` +
    `or the trigger). See admin migrations 20260623070000/080000/090000.`,
  );
  process.exit(1);
}

console.log(`\noccurrence instance_time canonical check: ok (0/${data.occurrences_total} drift).`);
process.exit(0);
