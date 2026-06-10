#!/usr/bin/env node
/**
 * CI contract check for get_map_events_v1 (Festival Map homepage RPC).
 *
 * Anon-calls public.get_map_events_v1(city_slug_param, range_start, range_end)
 * for London over the next 90 days and asserts:
 *   - the function exists (PGRST202 / not-found => hard fail; the homepage map
 *     silently empties without it)
 *   - the result is an array of rows with the full MapEvent shape (every key the
 *     frontend reads from src/modules/home-map/mapTypes.ts is present)
 *   - required identity/time fields are non-null
 *   - freshness_kind is one of 'added' | 'updated' | null
 *   - start_time/end_time are naive wall-clock strings (NOT tz-converted) --
 *     the frontend reads HH:MM by regex and must never see an offset shift
 *   - at least one row resolves to coords (lat/lng non-null) so the map has pins
 *
 * London is the flagship city and get_calendar_events_v2 reliably returns
 * hundreds of rows over 90d; 0 rows therefore signals the v2 wrapper broke.
 *
 * Local:  node scripts/check-map-events-rpc.mjs        (reads .env)
 * CI:     env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See admin migration 20260810000000_get_map_events_v1.sql,
 * src/hooks/useMapEvents.ts and .github/workflows/db-contract-check.yml.
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

const CITY = 'london-gb';
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = new Date();
const rangeStart = dateStr(today);
const end = new Date(today);
end.setDate(end.getDate() + 90);
const rangeEnd = dateStr(end);

const { data, error } = await sb.rpc('get_map_events_v1', {
  city_slug_param: CITY,
  range_start: rangeStart,
  range_end: rangeEnd,
});

const NOT_FOUND = /PGRST202|could not find the function|schema cache|does not exist/i;

if (error) {
  const msg = `${error.code || ''} ${error.message || ''}`.trim();
  if (NOT_FOUND.test(msg)) {
    console.error(
      `FAIL: get_map_events_v1 is not callable (${msg}).\n` +
        '      The Festival Map homepage map silently empties without it.\n' +
        '      Apply admin migration 20260810000000_get_map_events_v1.sql.',
    );
    process.exit(1);
  }
  console.error(`Transport/unexpected error calling get_map_events_v1: ${msg}`);
  process.exit(2);
}

if (!Array.isArray(data)) {
  console.error('FAIL: get_map_events_v1 did not return an array.');
  process.exit(1);
}

if (data.length === 0) {
  console.error(
    `FAIL: get_map_events_v1 returned 0 rows for ${CITY} over 90 days. ` +
      'London always has upcoming events; the get_calendar_events_v2 wrapper ' +
      'is likely broken.',
  );
  process.exit(1);
}

const REQUIRED_KEYS = [
  'occurrence_id', 'event_id', 'name', 'cover_image_url',
  'venue_name', 'area', 'city_slug', 'lat', 'lng',
  'instance_date', 'start_time', 'end_time',
  'type', 'has_party', 'has_class',
  'created_at', 'updated_at', 'freshness_kind',
  'is_cancelled', 'cancellation_reason_label',
];
// Present AND non-null on every row.
const NON_NULL_KEYS = [
  'occurrence_id', 'event_id', 'name', 'city_slug',
  'instance_date', 'start_time', 'type', 'has_party', 'has_class',
];
const WALLCLOCK = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/;

const problems = [];
let withCoords = 0;

for (let i = 0; i < data.length; i++) {
  const row = data[i];
  for (const k of REQUIRED_KEYS) {
    if (!(k in row)) problems.push(`row ${i}: missing key '${k}'`);
  }
  for (const k of NON_NULL_KEYS) {
    if (row[k] === null || row[k] === undefined) {
      problems.push(`row ${i} (${row.name ?? '?'}): '${k}' is null`);
    }
  }
  if (!['added', 'updated', null].includes(row.freshness_kind)) {
    problems.push(
      `row ${i}: freshness_kind='${row.freshness_kind}' (expected added|updated|null)`,
    );
  }
  if (typeof row.start_time === 'string' && !WALLCLOCK.test(row.start_time)) {
    problems.push(
      `row ${i}: start_time='${row.start_time}' not a wall-clock 'YYYY-MM-DD HH:MM' string`,
    );
  }
  if (
    row.lat !== null && row.lat !== undefined &&
    row.lng !== null && row.lng !== undefined
  ) {
    withCoords++;
  }
  if (problems.length > 20) break;
}

if (withCoords === 0) {
  problems.push(
    `0 of ${data.length} rows have non-null lat/lng -- no map pins. The venue ` +
      'coords coalesce / projection is broken.',
  );
}

if (problems.length > 0) {
  console.error(
    `\nFAIL: get_map_events_v1 contract violated (${problems.length} issue(s)):`,
  );
  for (const p of problems.slice(0, 20)) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(
  `OK: get_map_events_v1 returned ${data.length} rows for ${CITY} ` +
    `(${withCoords} with coords). Shape, freshness and wall-clock times intact.`,
);
process.exit(0);
