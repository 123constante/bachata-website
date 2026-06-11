#!/usr/bin/env node
/**
 * CI contract check — P5 orphan-series guard (P5 ↔ legacy orphan integrity, 2026-06-05).
 * Calls public.check_p5_orphan_series_v1(), which detects LIVE event_series_p5 rows with
 * legacy_event_id IS NULL. These are public-visible via get_calendar_events_v2 (reads P5
 * directly) but INVISIBLE in the admin events list (admin_dashboard_events_list_v1 reads
 * legacy public.events) — the "BOS con SALSA! 2" class of bug, where an event shows on the
 * site yet can't be found/managed in admin. E2E test-named rows ('PW %', 'AUDIT-TEST%',
 * '(delete me)') are excluded so the gate tracks only real divergence.
 *
 * GATING: status is 'ok' iff orphaned_count = 0. Any real live orphan fails the build.
 *
 * Local:  node scripts/check-p5-orphan-series.mjs
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

const { data, error } = await sb.rpc('check_p5_orphan_series_v1');

if (error) {
  if (/function .* does not exist/i.test(error.message)) {
    console.error(`FAIL: check_p5_orphan_series_v1 not found (${error.message}) -- RPC is missing, contract broken.`);
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.status !== 'ok') {
  console.error(
    `\nP5 ORPHAN GUARD FAIL: ${data?.orphaned_count ?? '?'} LIVE P5 series have no legacy ` +
    `bridge (legacy_event_id IS NULL) — they render publicly but are invisible in the admin ` +
    `events list. Rescue each via admin_ensure_series_legacy_bridge_v1(series_id). See sample above.`,
  );
  process.exit(1);
}

console.log(
  `\nP5 orphan-series guard: ok (0 live orphans; ${data.total_live_series} live series tracked).`,
);
process.exit(0);
