#!/usr/bin/env node
/**
 * CI integrity check for the per-date program canonical-vs-JSON-shadow contract.
 * Calls public.check_per_date_program_canonical_consistency_v1() and exits
 * non-zero if any occurrence's calendar_occurrences.override_payload.program[]
 * JSON shadow has drifted from the canonical join
 * (event_program_items + calendar_occurrence_session_overrides +
 *  calendar_occurrence_added_sessions).
 *
 * Background: ADR-007. The JSON shadow is maintained by trigger
 * trg_sync_override_payload_program_from_canonical_v1 (admin migration
 * 20260623030000) plus the people-table extension and BEFORE-UPDATE lock
 * (admin migration 20260623060000). Any drift means a write path bypassed
 * the canonical layer or the trigger silently failed.
 *
 * Local:  node scripts/check-per-date-program-canonical.mjs
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

const { data, error } = await sb.rpc('check_per_date_program_canonical_consistency_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.status !== 'ok') {
  const drift = data?.drift_count ?? '?';
  const total = data?.occurrences_total ?? '?';
  console.error(
    `\nDRIFT DETECTED: ${drift}/${total} occurrence(s) have override_payload.program ` +
    `that disagrees with the canonical layer.\n` +
    `Fix: investigate the sample, identify the write path that bypassed the canonical ` +
    `layer (event_program_item_overrides / calendar_occurrence_added_sessions), and ` +
    `re-run public.recompute_override_payload_program_v1(<occurrence_id>) to repair. ` +
    `If a trigger is failing, look at admin migration 20260623060000 (lock + people-table ext).`,
  );
  process.exit(1);
}

console.log(`\nper-date program canonical check: ok (0/${data.occurrences_total} drift).`);
process.exit(0);
