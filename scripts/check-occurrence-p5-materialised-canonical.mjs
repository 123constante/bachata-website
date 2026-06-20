#!/usr/bin/env node
/**
 * CI contract check — P5 occurrence materialised-time canonical (2026-06-20).
 * Calls public.check_occurrence_p5_materialised_canonical_v1(). The check was
 * date-only (blind to the hour), which is why 207 BST-shifted P5 materialised_start_utc
 * rows went undetected while the legacy checks (read off the healed mirror) saw only 52.
 * It now also asserts the TIME-of-day for non-festival series: materialised_start_utc must
 * equal the local-as-UTC stash of (occurrence_date + COALESCE(per-occurrence custom start,
 * series default)). Festivals keep date-only handling. Admin migration
 * 20260911000000_tighten_p5_materialised_canonical_check_v1.
 *
 * GATING: drift_count must be 0 (date_drift + time_drift). Pairs with the
 * stamping-convention guardrail (code regression) — this catches DATA regression.
 *
 * Local:  node scripts/check-occurrence-p5-materialised-canonical.mjs
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

const { data, error } = await sb.rpc('check_occurrence_p5_materialised_canonical_v1');

if (error) {
  if (/function .* does not exist/i.test(error.message)) {
    console.error(`FAIL: check_occurrence_p5_materialised_canonical_v1 not found (${error.message}) -- RPC missing, contract broken.`);
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (Number(data?.drift_count ?? 0) !== 0) {
  console.error(
    `\nP5 MATERIALISED CANONICAL FAIL: drift_count=${data?.drift_count} ` +
    `(date_drift=${data?.date_drift_count}, time_drift=${data?.time_drift_count}). ` +
    `event_occurrence_p5.materialised_start_utc has drifted from the local-as-UTC stash. ` +
    `Re-anchor via stash_local_as_utc(occurrence_date, default_local_start_time). Sample above.`,
  );
  process.exit(1);
}

console.log('\nP5 occurrence materialised canonical: ok (0 date/time drift).');
process.exit(0);
