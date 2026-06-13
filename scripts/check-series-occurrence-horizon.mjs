#!/usr/bin/env node
/**
 * CI contract check — live series occurrence horizon (2026-06-05).
 * Calls public.check_live_series_occurrence_horizon_v1(), which detects LIVE
 * recurring series that have (nearly) run out of future occurrences and will
 * silently fall off the public calendar (get_calendar_events_v2 sources dates
 * from event_occurrence_p5; a live series with no future date just vanishes).
 *
 * GATING: the RPC's status is 'ok' iff open_ended_zero_future_count = 0 — i.e.
 * no series with an OPEN-ENDED rule (end.kind='none') has zero future dates. That
 * is the unambiguous bug: an open-ended rule must always have a materialised
 * future window; zero means materialisation lapsed/died and needs re-running.
 *
 * NON-GATING (reported): within_threshold_count + the sample list. These include
 * NULL-rule / manual / about-to-finish series (e.g. an ad-hoc monthly that needs
 * its next date added by hand, or a finite course ending this week). They are
 * surfaced for human attention but do NOT fail CI — gating on them would red the
 * build every time an intentionally-finite series reaches its end.
 *
 * Local:  node scripts/check-series-occurrence-horizon.mjs
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

const { data, error } = await sb.rpc('check_live_series_occurrence_horizon_v1');

if (error) {
  if (/function .* does not exist/i.test(error.message)) {
    console.error(`FAIL: check_live_series_occurrence_horizon_v1 not found (${error.message}) -- RPC is missing, contract broken.`);
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

// Digest mode: emit a compact markdown nudge and exit 0 (informational, never gates).
if (process.argv.includes('--markdown')) {
  const lines = ['### Live recurring series', ''];
  lines.push(`- ${data.total_live_recurring ?? '?'} live recurring series tracked`);
  const n = data.within_threshold_count ?? 0;
  if (n > 0) {
    lines.push(`- ${n} within ${data.threshold_days}d of running out of dates (or already none):`);
    for (const s of (data.sample || [])) {
      const when = s.last_future_date
        ? `last date ${s.last_future_date}${s.days_left != null ? ` (${s.days_left}d left)` : ''}`
        : 'no future date set';
      lines.push(`  - ${s.name} - ${when}${s.open_ended ? ' [open-ended]' : ''}`);
    }
  } else {
    lines.push('- none within threshold');
  }
  if (data.status && data.status !== 'ok') {
    lines.push(`- WARNING: status=${data.status} - an OPEN-ENDED series has zero future dates (materialisation lapsed); re-materialise`);
  }
  lines.push('');
  console.log(lines.join('\n'));
  process.exit(0);
}

console.log(JSON.stringify(data, null, 2));

// Always surface the soft early-warning list (non-gating).
if ((data?.within_threshold_count ?? 0) > 0) {
  console.warn(
    `\nNOTE: ${data.within_threshold_count} live recurring series are within ` +
    `${data.threshold_days} days of running out of dates (or already have none). ` +
    `Review the sample above — ruled series need re-materialising; ad-hoc/manual ` +
    `ones need their next date added by hand.`,
  );
}

if (data?.status !== 'ok') {
  console.error(
    `\nHORIZON GUARDRAIL FAIL: ${data?.open_ended_zero_future_count ?? '?'} live ` +
    `series with an OPEN-ENDED recurrence rule have ZERO future occurrences — their ` +
    `materialisation window has lapsed and they have silently dropped off the public ` +
    `calendar. Re-materialise each via _materialise_series_occurrences_p5_v1(series_id) ` +
    `(or set/refresh the rule in the editor). See the sample above.`,
  );
  process.exit(1);
}

console.log(
  `\nlive series occurrence horizon: ok (0 open-ended series with zero future dates; ` +
  `${data.total_live_recurring} live recurring series tracked).`,
);
process.exit(0);
