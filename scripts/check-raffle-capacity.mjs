#!/usr/bin/env node
/**
 * CI contract check #51 - raffle/guest capacity ceiling (raffle Phase 5, 2026-07-11).
 *
 * Calls public.check_raffle_capacity_contract_v1(), which asserts no scope holds
 * more active rows than its capacity_max. Phase 5 closed S4 (a capacity TOCTOU:
 * each insert path re-derived "count actives" by hand, one path skipped it, none
 * took the advisory lock) by routing every writer through one chokepoint
 * (_claim_entry_slot_v1). This check is the byte-aligned health probe.
 *
 * Guarded dimensions (both must be 0):
 *   - raffle_over_capacity: event-wide active raffle entries exceed capacity_max
 *   - guest_over_capacity:  a guest occurrence's signups + active permanent VIPs exceed capacity_max
 *   - raffle_offenders / guest_offenders: the offending scopes (for triage)
 *
 * NOTE: dormant/preventative today - 0 events have capacity_max set in prod, so the
 * TOCTOU is latent-armed, not live; this check starts (and should stay) green.
 *
 * GATING: ok=true required. Any over-capacity scope fails the build.
 *
 * Local:  node scripts/check-raffle-capacity.mjs   (reads .env)
 * CI:     env VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 * See:    admin repo migrations/20260711010000_raffle_capacity_chokepoint_v1.sql
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

const { data, error } = await sb.rpc('check_raffle_capacity_contract_v1');

if (error) {
  if (/function .* does not exist|could not find/i.test(error.message)) {
    console.error(
      `FAIL: check_raffle_capacity_contract_v1 not found (${error.message}) - the capacity ` +
      `ceiling RPC is missing, contract broken.`,
    );
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.ok !== true) {
  console.error(
    `\nCAPACITY CEILING FAIL: ${data?.raffle_over_capacity ?? '?'} raffle + ` +
    `${data?.guest_over_capacity ?? '?'} guest scope(s) are over capacity_max (ids above). ` +
    `A writer INSERTed status='active' without going through _claim_entry_slot_v1 - the S4 ` +
    `TOCTOU has re-opened.`,
  );
  process.exit(1);
}

console.log('\nCapacity ceiling: ok (no raffle/guest scope exceeds capacity_max).');
process.exit(0);
