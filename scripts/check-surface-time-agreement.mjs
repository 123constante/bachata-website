#!/usr/bin/env node
/**
 * CI contract check: the event page and search echo the STORED occurrence start.
 *
 * event_view_p5(snapshot_compat) and search_public_v5 both READ
 * event_occurrence_p5.materialised_start_utc -- a naive London wall clock stamped
 * +00. In 2026-07 both silently diverged +1h in BST by re-casting it through the
 * series tz (double AT TIME ZONE); nothing compared their output to the stored
 * value, so it shipped (fixed: admin 20260726010000 / 20260726015000). This guard
 * asserts the two column-readers echo the canonical value to the millisecond, for
 * the next-upcoming occurrence of a sample of live series.
 *
 * The reference is the CANONICAL column (via the anon-callable sampler
 * _public_time_agreement_sample_v1), NOT the calendar/map/venue-dto: those RE-DERIVE
 * the time from the program/default and can legitimately differ from a stale column
 * (that is materialised drift -- check_occurrence_p5_materialised_canonical_v1's
 * job, not this guard's). Any future column-reader that reintroduces the bad cast is
 * also caught statically by check-pgproc-materialised-cast.mjs.
 *
 * Local:  node scripts/check-surface-time-agreement.mjs      (reads .env)
 * CI:     VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY as repo secrets.
 *
 * See admin migrations 20260726010000 / 20260726015000 / 20260726041000 and
 * .github/workflows/db-contract-check.yml.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { rpcWithRetry, exitTransient } from './lib/rpc-retry.mjs';

const SAMPLE = 40;

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
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(2);
}
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Classification and retry live in scripts/lib/rpc-retry.mjs so this check and
// its siblings agree on what a 57014 means. What stood here retried once
// and then threw a BARE Error -- which the catch blocks below folded into
// `mismatches`, reporting a cold search RPC as a reader disagreeing with the
// canonical wall clock and exiting 1 for a contract violation that never
// happened. Observed on main 2026-09-01 (runs 33564348040, 33564636783):
// "mismatches: 1", the sole entry being a statement timeout.
const rpc = (fn, args) => rpcWithRetry(sb, fn, args);

// Epoch millis of a wall-stamped timestamp; every column-reader emits the wall clock
// tagged +00, so equal wall clock => equal instant. null-safe.
const epoch = (v) => (v == null ? null : Date.parse(v));

// The sampler is the call MOST likely to time out: it is the only aggregate
// scan in this file, and every downstream call depends on it. Left as a bare
// top-level await, an exhausted retry became an unhandled rejection and Node
// exited 1 -- reinstating, on the single most vulnerable call, the exact
// mis-typing this file was changed to remove. Found at review 2026-09-01.
let sample;
try {
  sample = await rpc('_public_time_agreement_sample_v1', { p_limit: SAMPLE });
} catch (e) {
  exitTransient(e, 'surface time-agreement (sampler)');
  console.error(`surface time-agreement: sampler RPC failed: ${e.message}`);
  process.exit(2);
}

const mismatches = [];
let compared = 0;
let searchMatched = 0;

for (const row of sample || []) {
  const ref = epoch(row.canonical_start);
  const occ = row.occurrence_id;

  // Event page (compat), pinned to this exact occurrence.
  let compatStart = null;
  try {
    const ev = await rpc('event_view_p5', {
      p_target: { series_id: row.event_id, occurrence_id: occ },
      p_viewer: { role: 'anon', shape: 'snapshot_compat' },
    });
    compatStart = epoch(ev?.occurrence_effective?.starts_at);
  } catch (e) {
    // A timeout is infrastructure, not a disagreement -- exit 2 and say so.
    // Any OTHER RPC failure is still a genuine reader problem and is reported.
    exitTransient(e, 'surface time-agreement (event page)');
    mismatches.push(`${row.series_name} [${occ}]: compat RPC error: ${e.message}`);
  }

  // Search: its anchor is this same next-upcoming occurrence.
  let searchStart = null;
  try {
    const s = await rpc('search_public_v5', {
      p_query: row.series_name, p_city_slug: null, p_section_limit: 12, p_include_past: false,
      p_event_type: null, p_styles: null, p_date_from: null, p_date_to: null, p_format: null, p_category: null,
    });
    const hit = (s?.events || []).find((e) => e.id === row.event_id);
    if (hit) { searchStart = epoch(hit.start_time); searchMatched++; }
  } catch (e) {
    exitTransient(e, 'surface time-agreement (search)');
    mismatches.push(`${row.series_name} [${occ}]: search RPC error: ${e.message}`);
  }

  const check = (label, val) => {
    if (val == null) return; // reader didn't surface this occurrence -> not a disagreement
    if (val !== ref) {
      const d = Math.round((val - ref) / 60000);
      mismatches.push(`${row.series_name} [${occ}]: ${label}=${new Date(val).toISOString()} vs canonical=${new Date(ref).toISOString()} (${d >= 0 ? '+' : ''}${d}m)`);
    }
  };
  check('compat', compatStart);
  check('search', searchStart);
  compared++;
}

console.log(JSON.stringify({
  live_series_sampled: (sample || []).length, compared, search_matched: searchMatched, mismatches: mismatches.length,
}, null, 2));

if (mismatches.length) {
  console.error(`\nFAIL: ${mismatches.length} reader(s) disagree with the canonical materialised_start_utc:`);
  for (const m of mismatches) console.error(`  - ${m}`);
  console.error('\nThe event page and search must echo the stored wall clock as-is. A +1h skew means a double tz-cast (see check-pgproc-materialised-cast.mjs).');
  process.exit(1);
}

if (compared === 0) {
  console.warn('\nWARN: no upcoming occurrences to compare (empty sample) -- nothing asserted.');
  process.exit(0);
}

console.log(`\nOK: ${compared} occurrence(s) -- event page + search both echo canonical materialised_start_utc (search matched ${searchMatched}).`);
process.exit(0);
