#!/usr/bin/env node
/**
 * CI contract check: slug column on get_calendar_events_v2 and get_map_events_v1.
 *
 * SEO plan 1.2 added `slug text` to both RPCs (admin migrations
 * 20260829074000 / 20260829075000 / 20260829076000). Without it, every
 * internal event link degrades to the UUID fallback -- no slug URLs on the
 * calendar, map, venue pages, or the Tonight / ComingUp feeds.
 *
 * Asserts:
 *   - get_calendar_events_v2 rows have a `slug` key (nullable is fine)
 *   - get_map_events_v1 rows have a `slug` key (nullable is fine)
 *   - At least one row in each RPC has a non-null slug (London always has
 *     published events with slugs; 0 non-null = migration was never applied)
 *
 * Local:  node scripts/check-slug-column.mjs        (reads .env)
 * CI:     env vars supplied as repo secrets
 *
 * See admin migrations 20260829074000 / 20260829075000 / 20260829076000
 * and .github/workflows/db-contract-check.yml check #38.
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
end.setDate(end.getDate() + 14);
const rangeEnd = dateStr(end);

const NOT_FOUND = /PGRST202|could not find the function|schema cache|does not exist/i;

async function checkRpc(rpcName, params) {
  const { data, error } = await sb.rpc(rpcName, params);
  if (error) {
    const msg = `${error.code || ''} ${error.message || ''}`.trim();
    if (NOT_FOUND.test(msg)) {
      console.error(`FAIL: ${rpcName} is not callable (${msg}).`);
      return null;
    }
    console.error(`Transport error calling ${rpcName}: ${msg}`);
    return null;
  }
  if (!Array.isArray(data)) {
    console.error(`FAIL: ${rpcName} did not return an array.`);
    return null;
  }
  return data;
}

const calData = await checkRpc('get_calendar_events_v2', {
  city_slug_param: CITY,
  range_start: rangeStart,
  range_end: rangeEnd,
});

const mapData = await checkRpc('get_map_events_v1', {
  city_slug_param: CITY,
  range_start: rangeStart,
  range_end: rangeEnd,
});

if (calData === null || mapData === null) {
  process.exit(1);
}

const problems = [];

function checkSlug(data, rpcName) {
  if (data.length === 0) {
    problems.push(`${rpcName}: 0 rows returned for ${CITY} over 14d -- cannot verify slug presence`);
    return;
  }
  const sample = data[0];
  if (!('slug' in sample)) {
    problems.push(
      `${rpcName}: 'slug' key missing from returned rows. ` +
        'Admin migration 20260829074000 (or 75000) was not applied.',
    );
    return;
  }
  const withSlug = data.filter((r) => r.slug != null).length;
  if (withSlug === 0) {
    problems.push(
      `${rpcName}: 'slug' key present but null on every row. ` +
        `${data.length} rows checked; at least one London event should have a slug.`,
    );
    return;
  }
  console.log(
    `  ${rpcName}: OK (${withSlug}/${data.length} rows have non-null slug)`,
  );
}

console.log('Checking slug column contract:');
checkSlug(calData, 'get_calendar_events_v2');
checkSlug(mapData, 'get_map_events_v1');

if (problems.length > 0) {
  console.error(`\nFAIL: slug column contract violated (${problems.length} issue(s)):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log('\nOK: slug column present and populated on both calendar and map RPCs.');
process.exit(0);
