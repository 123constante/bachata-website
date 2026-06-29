#!/usr/bin/env node
/**
 * CI contract check for the canonical venue publish-state visibility gate.
 *
 * Calls public.check_venue_publish_gate_contract_v1() and exits non-zero if any
 * venue-as-destination read path (get_public_venues_list_v3,
 * get_public_venue_by_venues_id, get_venue_detail, search_public_v5) has drifted
 * off the canonical predicate public.venue_is_public(publish_state) — e.g. by
 * re-introducing a hard-coded `publish_state = 'dancer_ready'` literal, which is
 * exactly the bug that once hid `published` venues from the /venues directory.
 *
 * Local:  node scripts/check-venue-publish-gate.mjs      (reads .env)
 * CI:     same script, env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See admin migration 20260627120000_venue_is_public_predicate_and_gate_v1 and
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

const { data, error } = await sb.rpc('check_venue_publish_gate_contract_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (!data?.ok) {
  const errs = Array.isArray(data?.errors) ? data.errors : [];
  console.error(`\nFAIL: venue publish-gate drift detected (${errs.length} issue(s)).`);
  for (const e of errs) console.error(`  - ${e}`);
  process.exit(1);
}

console.log('\nOK: every venue-as-destination read path gates via venue_is_public().');
process.exit(0);
