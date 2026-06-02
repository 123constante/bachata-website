#!/usr/bin/env node
/**
 * CI contract check for get_latest_events_v2 (homepage "Recently added" wheel).
 *
 * Asserts the public RPC:
 *   - is anon-callable,
 *   - returns at most the requested number of rows,
 *   - is ordered by created_at DESC (freshest first),
 *   - only surfaces still-attendable events (no clearly past-dated rows),
 *   - tags each row freshness_kind in {added, updated},
 *   - carries the fields the wheel renders.
 *
 * Exit policy:
 *   ok                                 -> 0 (pass)
 *   ordering / shape / gate violation  -> 1 (fail)
 *   RPC missing (migration not pushed) -> 0 (warn; admin 20260806000000 not live yet)
 *   transport / unexpected RPC error   -> 2
 *
 * Local:  node scripts/check-latest-events.mjs
 * CI:     env VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See: admin migration 20260806000000_get_latest_events_v2_smart_freshness.sql,
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
const { data, error } = await sb.rpc('get_latest_events_v2', {
  p_city_slug: null,
  p_limit: LIMIT,
});

if (error) {
  const msg = `${error.code || ''} ${error.message || ''}`.trim();
  if (/PGRST202|Could not find the function|schema cache|does not exist/i.test(msg)) {
    console.warn(
      `WARN: get_latest_events_v2 not found (${msg}). Admin migration ` +
        `20260806000000 not pushed yet -- skipping (not a regression).`,
    );
    process.exit(0);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

if (!Array.isArray(data)) {
  console.error('FAIL: expected get_latest_events_v2 to return an array.');
  process.exit(1);
}

console.log(`get_latest_events_v2 returned ${data.length} row(s).`);

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

// Future-relevance gate: a "recently added" event must still be attendable, so
// its displayed occurrence date may not be clearly in the past. A 2-day grace
// absorbs city-tz vs UTC and the RPC's 6h "just finished" window.
const cutoff = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
for (const row of data) {
  if (row.instance_date && row.instance_date < cutoff) {
    console.error(
      `FAIL: past-dated row leaked through the future gate: ` +
        `"${row.name}" instance_date=${row.instance_date} < ${cutoff}.`,
    );
    process.exit(1);
  }
  if (row.freshness_kind !== 'added' && row.freshness_kind !== 'updated') {
    console.error(
      `FAIL: invalid freshness_kind "${row.freshness_kind}" on "${row.name}".`,
    );
    process.exit(1);
  }
}

const REQUIRED = [
  'event_id',
  'name',
  'created_at',
  'freshness_kind',
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

console.log('OK: get_latest_events_v2 anon-callable, within limit, DESC, future-gated, shape intact.');
process.exit(0);
