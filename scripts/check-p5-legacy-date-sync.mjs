#!/usr/bin/env node
/**
 * CI integrity check for the p5 <-> legacy occurrence DATE sync contract.
 * Calls public.check_p5_legacy_date_sync_v1() and exits non-zero if any
 * event_occurrence_p5 row's occurrence_date disagrees with the calendar DAY of
 * its bridged calendar_occurrences.instance_start.
 *
 * Background: the public event page (get_event_page_snapshot_v2) reads the
 * occurrence date from legacy calendar_occurrences, while the admin editor and
 * the public calendar read event_occurrence_p5. The two are linked by
 * event_occurrence_p5.legacy_occurrence_id, but nothing kept the legacy DAY in
 * step with the p5 occurrence_date -- so the event page could render a stale
 * date (El Grande, 2026-06-01: p5 said 6 Jun, legacy said 28 Oct).
 *
 * Forward writes are now realigned by trigger trg_p5_writeback_legacy_date
 * (admin migration 20260601170000_p5_legacy_date_writeback_and_drift_check_v1);
 * this check is the catch-all safety net for drift introduced by any other
 * path (e.g. a raw legacy-side bulk write bypassing p5). TIME-of-day is a
 * separate contract (#20, check_occurrence_instance_time_canonical_v1).
 *
 * Local:  node scripts/check-p5-legacy-date-sync.mjs
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

const { data, error } = await sb.rpc('check_p5_legacy_date_sync_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.status !== 'ok') {
  const drift = data?.drift_count ?? '?';
  const total = data?.bridged_total ?? '?';
  console.error(
    `\nDRIFT DETECTED: ${drift}/${total} bridged occurrence(s) have a p5 ` +
    `occurrence_date that disagrees with the legacy calendar_occurrences day.\n` +
    `Effect: the public event page (get_event_page_snapshot_v2) renders the ` +
    `stale legacy date while the calendar shows the p5 date.\n` +
    `Fix: touch each affected event_occurrence_p5 row (trigger ` +
    `trg_p5_writeback_legacy_date realigns the legacy day), or call ` +
    `admin_set_occurrence_time_v1 on the legacy occurrence. If many rows ` +
    `drifted at once, suspect a legacy-side bulk write bypassing p5.`,
  );
  process.exit(1);
}

console.log(`\np5<->legacy occurrence date sync check: ok (0/${data.bridged_total} drift).`);
process.exit(0);
