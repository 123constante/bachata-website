#!/usr/bin/env node
/**
 * CI contract check — festival publish readiness (atomic publish arc, 2026-06-14).
 * Calls public.check_festival_publish_readiness_v1(), which flags LIVE
 * event_series_p5 festivals whose legacy public.events row is NOT 'published'
 * (or missing). That split-brain renders the festival on the calendar list (P5
 * read) while its DETAIL page 404s (get_public_festival_detail requires the
 * legacy row at lifecycle_status='published') — the AB International Congress
 * Barcelona bug. Each flagged row carries a blocking_reason (missing
 * venue/city/start/name, or a city with no country_code on file).
 *
 * Since the publish path is now atomic + hard-blocked (admin migration
 * 20260825000000), this should stay at 0 for app-driven publishes; the gate is
 * the canary for raw-SQL / import drift outside the publish RPC.
 *
 * GATING: status is 'ok' iff mismatched_count = 0. Any split-brain fails the build.
 *
 * Local:  node scripts/check-festival-publish-readiness.mjs
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

const { data, error } = await sb.rpc('check_festival_publish_readiness_v1');

if (error) {
  if (/function .* does not exist/i.test(error.message)) {
    console.error(`FAIL: check_festival_publish_readiness_v1 not found (${error.message}) -- RPC is missing, contract broken.`);
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.status !== 'ok') {
  console.error(
    `\nFESTIVAL PUBLISH READINESS FAIL: ${data?.mismatched_count ?? '?'} LIVE P5 festival(s) ` +
    `are not published on the legacy row — they show on the calendar but their detail page 404s. ` +
    `Fix the blocking_reason per row (sample above), then re-publish (or call ` +
    `admin_ensure_festival_legacy_bridge_v1(series_id)).`,
  );
  process.exit(1);
}

console.log(
  `\nFestival publish readiness: ok (0 split-brain; ${data.total_live_festivals} live festivals tracked).`,
);
process.exit(0);
