#!/usr/bin/env node
/**
 * CI contract check — occurrence integrity aggregator (Occurrence Integrity arc,
 * 2026-06-05). Calls public.check_occurrence_integrity_v1(), which folds every
 * occurrence date/time/program/mirror sub-check into one verdict:
 *   p5_legacy_date_sync, instance_time_canonical, instance_end_canonical,
 *   program_day_integrity, per_date_program, program_format, session_override_mirror.
 *
 * status='ok' means no invariant drifted above its baseline (currently 0 for all —
 * the arc cleared the 29 P5<->legacy date drifts). Any regression reds this gate.
 * This step is a backstop over the individual #19/#20/#25/#26 steps; it can never be
 * forgotten when a new sub-check is added to the aggregator.
 *
 * Local:  node scripts/check-occurrence-integrity.mjs
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

const { data, error } = await sb.rpc('check_occurrence_integrity_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.status !== 'ok') {
  const regressed = Array.isArray(data?.regressed) ? data.regressed.join(', ') : '?';
  console.error(
    `\nOCCURRENCE INTEGRITY REGRESSION: ${data?.drift_total ?? '?'} total drift; ` +
    `invariant(s) above baseline: ${regressed}.\n` +
    `Inspect the per-invariant breakdown above. Mechanical drift (instance times, ` +
    `program shadow, P5->legacy session/people mirror) can be repaired with ` +
    `public.self_heal_occurrence_integrity_v1(); P5<->legacy DATE direction is a ` +
    `human decision.`,
  );
  process.exit(1);
}

console.log(`\noccurrence integrity aggregator: ok (0 drift across all invariants).`);
process.exit(0);
