#!/usr/bin/env node
/**
 * CI contract check — series-materialisation horizon watchdog.
 *
 * Calls public.check_series_materialisation_contract_v1(), which compares each
 * live/paused recurring/course series' recurrence-rule dates against its
 * materialised event_occurrence_p5 rows over the [today, today+11mo] window (with
 * the D1 same-ISO-week reschedule excuse). status = 'ok' iff no series has a net
 * unexplained shortfall.
 *
 * WHY THIS IS A WATCHDOG. Occurrence materialisation is now kept fresh by the admin
 * pg_cron job `nightly-series-horizon-topup` (admin migration
 * 20260718090000_series_horizon_nightly_topup_v1), which re-materialises the tail to
 * today+12mo nightly. This check's 11mo-vs-12mo grace band means it stays green while
 * the cron runs and reds within ~1 month if the cron ever dies. A red here almost
 * always means "the nightly top-up cron stopped" — verify with
 *   SELECT jobname, active FROM cron.job WHERE jobname = 'nightly-series-horizon-topup';
 * A red can also be a genuine interior materialisation gap (a rule date missing inside
 * the window with no offsetting same-week extra); see the `sample` array.
 *
 * GATING: status is 'ok' iff divergent = 0.
 *
 * Local:  node scripts/check-series-materialisation.mjs
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

const { data, error } = await sb.rpc('check_series_materialisation_contract_v1');

if (error) {
  if (/function .* does not exist/i.test(error.message)) {
    console.error(`FAIL: check_series_materialisation_contract_v1 not found (${error.message}) -- RPC is missing, contract broken.`);
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.status !== 'ok') {
  console.error(
    `\nSERIES-MATERIALISATION WATCHDOG FAIL: ${data?.divergent ?? '?'} of ${data?.checked ?? '?'} ` +
    `series short of the 11-month horizon. Most likely the nightly top-up cron stopped -- check ` +
    `cron.job for 'nightly-series-horizon-topup' (admin migration 20260718090000) and re-run ` +
    `SELECT public.topup_series_materialisation_horizon_v1(); to heal. If the cron is healthy, this ` +
    `is a genuine interior materialisation gap -- see the sample above.`,
  );
  process.exit(1);
}

console.log(
  `\nSeries-materialisation watchdog: ok (0 divergent of ${data.checked} series; nightly top-up cron healthy).`,
);
process.exit(0);
