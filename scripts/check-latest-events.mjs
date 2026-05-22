#!/usr/bin/env node
/**
 * CI contract check for get_latest_events_v1 (homepage "Just added" feed).
 *
 * Asserts the public RPC:
 *   - is anon-callable,
 *   - returns at most the requested number of rows,
 *   - is ordered by created_at DESC (newest uploads first),
 *   - carries the fields the wheel renders.
 *
 * Exit policy:
 *   ok                                 -> 0 (pass)
 *   ordering / shape violation         -> 1 (fail)
 *   RPC missing (migration not pushed) -> 0 (warn; admin 20260707140000 not live yet)
 *   transport / unexpected RPC error   -> 2
 *
 * Local:  node scripts/check-latest-events.mjs
 * CI:     env VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See: admin migration 20260707140000_get_latest_events_v1.sql,
 *      src/hooks/useLatestEvents.ts, src/components/LatestEventsWheel.tsx
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

const LIMIT = 6;
const { data, error } = await sb.rpc('get_latest_events_v1', {
  p_city_slug: null,
  p_limit: LIMIT,
});

if (error) {
  const msg = `${error.code || ''} ${error.message || ''}`.trim();
  if (/PGRST202|Could not find the function|schema cache|does not exist/i.test(msg)) {
    console.warn(
      `WARN: get_latest_events_v1 not found (${msg}). Admin migration ` +
        `20260707140000 not pushed yet -- skipping (not a regression).`,
    );
    process.exit(0);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

if (!Array.isArray(data)) {
  console.error('FAIL: expected get_latest_events_v1 to return an array.');
  process.exit(1);
}

console.log(`get_latest_events_v1 returned ${data.length} row(s).`);

if (data.length > LIMIT) {
  console.error(`FAIL: ${data.length} rows exceeds requested limit ${LIMIT}.`);
  process.exit(1);
}

for (let i = 1; i < data.length; i++) {
  const prev = new Date(data[i - 1].created_at).getTime();
  const cur = new Date(data[i].created_at).getTime();
  if (cur > prev) {
    console.error(
      `FAIL: not ordered by created_at DESC at index ${i} ` +
        `(${data[i].created_at} is newer than ${data[i - 1].created_at}).`,
    );
    process.exit(1);
  }
}

const REQUIRED = [
  'event_id',
  'name',
  'created_at',
  'cover_image_url',
  'location',
  'instance_date',
  'has_class',
  'has_party',
];
for (const row of data) {
  for (const field of REQUIRED) {
    if (!(field in row)) {
      console.error(`FAIL: row missing field "${field}": ${JSON.stringify(row)}`);
      process.exit(1);
    }
  }
}

console.log('OK: get_latest_events_v1 is anon-callable, within limit, ordered DESC, shape intact.');
process.exit(0);
