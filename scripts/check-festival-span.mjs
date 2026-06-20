#!/usr/bin/env node
/**
 * CI contract check #40 — festival multi-day span (2026-06-20).
 * Calls public.check_festival_occurrence_span_v1(), which asserts that every
 * LIVE festival renders exactly its program-day span via get_calendar_events_v2:
 *   - single-occurrence festival -> max(date_offset_days)+1 program days
 *   - multi-occurrence festival  -> scheduled occurrence count
 * and flags single-occurrence festivals with NO program-day structure
 * (indeterminate span — the root data-entry error, e.g. a festival created with
 * a NULL events.end_time and no program days).
 *
 * Origin: "why isn't London Sensual Days appearing on the Sunday" (2026-06-20).
 * London Sensual lost its Sunday because get_calendar_events_v2 fanned festivals
 * off a duration-derived materialised_end_utc instead of the program-day
 * structure; the read path now derives days from event_series_program_day_p5
 * (admin migration 20260904000000). This guard stops it silently regressing.
 *
 * GATING: status must be 'ok' (drift_count = 0 AND indeterminate_count = 0).
 *
 * Local:  node scripts/check-festival-span.mjs        (reads .env)
 * CI:     env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
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

const { data, error } = await sb.rpc('check_festival_occurrence_span_v1');

if (error) {
  if (/PGRST202|could not find the function|schema cache|does not exist/i.test(error.message)) {
    console.error(
      `FAIL: check_festival_occurrence_span_v1 not found (${error.message}).\n` +
        '      Apply admin migration 20260905000000_check_festival_occurrence_span_v1.sql.',
    );
    process.exit(1);
  }
  console.error(`Transport/unexpected error: ${error.message}`);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.status !== 'ok') {
  if ((data?.drift_count ?? 0) > 0) {
    console.error(
      `\nFESTIVAL SPAN FAIL: ${data.drift_count} live festival(s) render the wrong ` +
        'number of days. The calendar day-count no longer matches the program-day ' +
        'structure (event_series_program_day_p5). See drift_sample above. Likely a ' +
        'regression in get_calendar_events_v2 day-expansion or program-day data drift.',
    );
  }
  if ((data?.indeterminate_count ?? 0) > 0) {
    console.error(
      `\nFESTIVAL SPAN FAIL: ${data.indeterminate_count} live single-occurrence ` +
        'festival(s) have NO program days, so their multi-day span is indeterminate. ' +
        'Add the festival program days in the admin editor. See indeterminate_sample above.',
    );
  }
  process.exit(1);
}

console.log(
  `\nfestival span: ok (${data.festivals_total} live festivals, ` +
    '0 drift, 0 indeterminate; each renders its program-day span).',
);
process.exit(0);
