#!/usr/bin/env node
/**
 * CI contract check — public time-pairing guard (the "in -1 days" family, 2026-07-02).
 * Calls public.check_public_time_pairing_contract_v1(), which asserts the public
 * "upcoming" RPCs measure "today/now" on the LONDON calendar:
 *
 *   1. get_organiser_next_event_dates() must never return a date before
 *      London-today. Its old `instance_start::date >= CURRENT_DATE` compared a
 *      London wall-clock date against the UTC date, so for the hour after London
 *      midnight during BST it returned YESTERDAY's events — which the Organisers
 *      page rendered as "in -1 days".
 *   2. get_public_venues_list_v3() next_event_iso (London wall-clock text) must
 *      not lag more than 24h behind London wall-clock now (grace for in-progress
 *      overnight events). Its old `>= now()` pairing ran an hour late all BST.
 *
 * Convention (admin CLAUDE.md "Time-pairing contract"): comparisons against
 * local-as-Z occurrence columns use (now() AT TIME ZONE 'Europe/London');
 * true-UTC columns compared to calendar dates must be projected into the
 * series timezone first. Fixed by admin migrations 20260702160000-20260702160300.
 *
 * GATING: ok=true required. Any violation fails the build.
 *
 * Local:  node scripts/check-time-pairing.mjs
 * CI:     same, env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
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

const { data, error } = await sb.rpc('check_public_time_pairing_contract_v1');

if (error) {
  if (/function .* does not exist|could not find/i.test(error.message)) {
    console.error(
      `FAIL: check_public_time_pairing_contract_v1 not found (${error.message}) — RPC is missing, contract broken.`,
    );
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.ok !== true) {
  console.error(
    `\nTIME-PAIRING GUARD FAIL: a public "upcoming" RPC is measuring today/now off the ` +
    `London calendar (see errors above). This is the "in -1 days" bug family — check the ` +
    `CURRENT_DATE/now() pairing of the named RPC against the local-as-Z convention.`,
  );
  process.exit(1);
}

console.log('\nPublic time-pairing guard: ok (organiser next-event dates and venue next_event_iso all on the London calendar).');
process.exit(0);
