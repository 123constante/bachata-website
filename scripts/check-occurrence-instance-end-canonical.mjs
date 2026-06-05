#!/usr/bin/env node
/**
 * CI contract check — occurrence instance_END canonical.
 *
 * Sibling of check-occurrence-instance-time-canonical.mjs (which validates
 * instance_START). Calls public.check_occurrence_instance_end_canonical_v1()
 * and exits non-zero if any occurrence's stored instance_end disagrees with the
 * program-canonical latest-session end, re-anchored to the occurrence local
 * date (the start+24h span class of bug — the start check never validated end).
 *
 * The DB fn anchors on day_id + time-of-day (like recompute_occurrence_times_v1),
 * so it is immune to the legacy sentinel-start-date pollution that the
 * start-anchored check suffers from.
 *
 * Local:  node scripts/check-occurrence-instance-end-canonical.mjs
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

const { data, error } = await sb.rpc('check_occurrence_instance_end_canonical_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.status !== 'ok') {
  const drift = data?.drift_count ?? '?';
  const total = data?.occurrences_total ?? '?';
  console.error(
    `\nINSTANCE_END DRIFT: ${drift}/${total} occurrence(s) have instance_end ` +
    `that disagrees with the canonical program span (start+24h or stale-day ` +
    `smell).\nFix: re-file any misfiled program day (see ` +
    `check_program_day_integrity_v1), then run ` +
    `public.recompute_occurrence_times_v1(<occurrence_id>) on each affected row.`,
  );
  process.exit(1);
}

console.log(`\noccurrence instance_end canonical check: ok (0/${data.occurrences_total} drift).`);
process.exit(0);
