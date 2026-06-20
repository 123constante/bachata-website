#!/usr/bin/env node
/**
 * CI contract check — occurrence-time stamping convention guardrail (2026-06-20).
 * Calls public.check_occurrence_time_stamping_convention_v1(), which scans pg_proc
 * for any function that writes the occurrence tables (event_occurrence_p5 /
 * calendar_occurrences) and stamps a naive timestamp with a NON-'UTC' timezone —
 * the local-as-UTC convention violation that shifted every BST-dated occurrence -1h
 * (207 rows / 30 series before the 2026-06-20 durable fix; admin migrations
 * 20260908000000..20260912000000). Occurrence/program times must be stamped via
 * stash_local_as_utc()/(date+local_time)::timestamp AT TIME ZONE 'UTC', never with a
 * real timezone (that re-introduces the DST shift).
 *
 * GATING: status must be 'ok' (offenders == []). The festival/standalone anchor seed
 * (_ensure_festival_legacy_bridge_v1, admin_ensure_series_legacy_bridge_v1) is
 * allowlisted in the RPC (writes events.start_time true-UTC; deferred nuance B).
 *
 * Local:  node scripts/check-occurrence-time-stamping-convention.mjs
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

const { data, error } = await sb.rpc('check_occurrence_time_stamping_convention_v1');

if (error) {
  if (/function .* does not exist/i.test(error.message)) {
    console.error(`FAIL: check_occurrence_time_stamping_convention_v1 not found (${error.message}) -- guardrail RPC missing, contract broken.`);
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.status !== 'ok') {
  console.error(
    `\nSTAMPING-CONVENTION FAIL: ${JSON.stringify(data?.offenders)} write occurrence ` +
    `times with a non-UTC timezone. Occurrence/program times are a local-as-UTC stash — ` +
    `use stash_local_as_utc()/AT TIME ZONE 'UTC', never AT TIME ZONE <series.timezone>.`,
  );
  process.exit(1);
}

console.log('\noccurrence time-stamping convention: ok (no writer stamps with a non-UTC timezone).');
process.exit(0);
