#!/usr/bin/env node
/**
 * CI contract check #61 — P5 occurrence materialise-leak guard (2026-07-26).
 * Calls public.check_occurrence_p5_unmaterialised_v1(), which counts scheduled
 * event_occurrence_p5 rows in LIVE, non-festival series that are MATERIALISABLE
 * (the canonical resolver _p5_occurrence_effective_headline_v1 yields a headline)
 * but still carry a NULL materialised_start_utc.
 *
 * WHY a second guard: check_occurrence_p5_materialised_canonical_v1() filters
 * materialised_start_utc IS NOT NULL BEFORE it counts, so it is structurally
 * blind to this class. Such an occurrence is INVISIBLE to search_public_v5 (which
 * also filters materialised_start_utc IS NOT NULL) while the calendar/map render
 * it fine. The writer that leaked these rows (_cmd_series_add_date_p5) was fixed
 * in admin migration 20260726020000; the guard RPC is 20260726030000. The
 * 305-row dead orphan-series blob is deliberately OUT of scope (series not live),
 * so this guard is born green and stays green.
 *
 * GATING: status='ok' AND drift_count=0 required. Any offender fails the build.
 * Heal a flagged row with
 *   SELECT public._recompute_occurrence_headline_time_from_sessions_v1('<id>');
 * (canonical resolver-backed; NULL-safe; no version bump).
 *
 * Local:  node scripts/check-p5-unmaterialised.mjs   (reads .env)
 * CI:     env vars VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY.
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

const { data, error } = await sb.rpc('check_occurrence_p5_unmaterialised_v1');

if (error) {
  if (/function .* does not exist|could not find/i.test(error.message)) {
    console.error(
      `FAIL: check_occurrence_p5_unmaterialised_v1 not found (${error.message}) — RPC is missing, contract broken.`,
    );
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.status !== 'ok' || (data?.drift_count ?? 0) !== 0) {
  console.error(
    `\nP5 UNMATERIALISED GUARD FAIL: ${data?.drift_count} live, materialisable occurrence(s) ` +
    `carry a NULL materialised_start_utc — invisible to search_public_v5. A write path left ` +
    `them unmaterialised (see the sample above). Heal each with ` +
    `SELECT public._recompute_occurrence_headline_time_from_sessions_v1('<id>'); ` +
    `and fix the offending writer (cf. admin 20260726020000).`,
  );
  process.exit(1);
}

console.log(
  `\nP5 unmaterialised guard: ok (${data.occurrences_total} scoped occurrences, 0 materialisable-but-unmaterialised).`,
);
process.exit(0);
