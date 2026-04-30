#!/usr/bin/env node
/**
 * CI integrity check for the event_program_people.display_name_override
 * contract (Phase A.5 of the unified profile model plan). Calls
 * public.check_session_people_display_name_contract_v1() and exits non-zero
 * if any override matches the canonical render (which would indicate a
 * re-introduction of the snapshot pattern) or if any dancer-shaped row has
 * an override pointing at a missing dancer_profiles id.
 *
 * Local:  node scripts/check-session-people-display-name-contract.mjs
 * CI:     same script, env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See admin migrations:
 *   20260430180000_phase_a5_event_program_people_display_name_override_v1
 *   20260430180100_phase_a5_rpcs_use_display_name_override_v1
 *   20260430180200_phase_a5_drop_display_name_and_add_health_check_v1
 * and .github/workflows/db-contract-check.yml.
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

const { data, error } = await sb.rpc(
  'check_session_people_display_name_contract_v1',
);

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (!data?.healthy) {
  const matching = data?.overrides_matching_canonical ?? '?';
  const orphans = data?.orphan_overrides_dancer_shaped ?? '?';
  console.error(
    `\nFAIL: ${matching} override(s) match canonical, ${orphans} orphan(s).`,
  );
  process.exit(1);
}

console.log('\nOK: session-people display_name_override contract holding.');
process.exit(0);
