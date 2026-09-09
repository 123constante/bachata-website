#!/usr/bin/env node
/**
 * CI heartbeat check for analytics view tracking.
 *
 * WHY: event-view writes silently stopped for 16 days in May 2026 and nothing
 * noticed. This gate fails when event_views has received NO rows in 48h — on a
 * live site with traffic, that means tracking has died (broken RPC contract,
 * bad deploy, etc.). Turns silent capture-death into a red CI run within ~2 days.
 *
 * Reads check_event_tracking_health_v1() (admin migration 20260715030000).
 * Clicks are reported but do NOT gate — they legitimately run low-volume.
 *
 * Exit policy:
 *   views fresh (<48h)                 -> 0 (pass)
 *   views stale (no rows in 48h)       -> 1 (fail; tracking likely dead)
 *   RPC missing                        -> 1 (fail; RPC is live on prod)
 *   transport / unexpected error       -> 2
 *
 * Local:  node scripts/check-tracking-freshness.mjs
 * CI:     env VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { rpcWithRetry, exitTransient } from './lib/rpc-retry.mjs';

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

let data;
try {
  data = await rpcWithRetry(sb, 'check_event_tracking_health_v1');
} catch (e) {
  exitTransient(e, 'tracking freshness');
  const error = e.cause ?? e;
  const msg = `${error.code || ''} ${error.message || ''}`.trim();
  if (/PGRST202|could not find the function|schema cache|does not exist/i.test(msg)) {
    console.error(
      `FAIL: check_event_tracking_health_v1 not found (${msg}) -- RPC is missing, contract broken.`,
    );
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

const views = data?.event_views ?? {};
const clicks = data?.event_link_clicks ?? {};

console.log(
  `event_views: last_at=${views.last_at ?? 'never'} ` +
    `(${views.hours_since ?? '∞'}h ago), 48h=${views.count_48h ?? 0}, stale=${views.stale}`,
);
console.log(
  `event_link_clicks: last_at=${clicks.last_at ?? 'never'}, 48h=${clicks.count_48h ?? 0}, ` +
    `ever_recorded=${clicks.ever_recorded}`,
);

if (!clicks.ever_recorded) {
  // Informational only — surfaced so a never-wired click path is visible.
  console.warn('NOTE: event_link_clicks has never recorded a row (informational, non-gating).');
}

if (views.stale) {
  console.error(
    'FAIL: event view tracking is stale — no rows in 48h. On a live site this means ' +
      'capture has died (check the Website recordEventView path / RPC contract).',
  );
  process.exit(1);
}

console.log('OK: event view tracking is live (rows within the last 48h).');
process.exit(0);
