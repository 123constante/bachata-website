#!/usr/bin/env node
/**
 * CI contract check for the search_public_v5 RPC (replaces check-search-public-v3).
 * Verifies:
 *   1. The RPC exists and is callable as anon.
 *   2. It returns a jsonb object with the EIGHT expected section arrays
 *      (events, organisers, teachers, djs, dancers, venues, vendors, cities)
 *      plus total_count (number) and a did_you_mean key (string | null).
 *   3. Empty query returns total_count = 0 with all-empty sections.
 *   4. Nonsense query returns total_count = 0 and a null did_you_mean.
 *   5. Default p_include_past=false returns only upcoming events.
 *   6. p_include_past=true broadens to include past events.
 *   7. Fuzzy: a near-miss ("bachatta") still resolves (results OR a suggestion).
 *   8. Filters narrow: p_event_type constrains the events section
 *      (soft-passes when the unfiltered base is already empty).
 *
 * Local:  node scripts/check-search-public-v5.mjs   (reads .env)
 * CI:     env vars VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY.
 *
 * Admin migration 20260826002000_search_public_v5; see
 * .github/workflows/db-contract-check.yml.
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

const SECTION_KEYS = ['events', 'organisers', 'teachers', 'djs', 'dancers', 'venues', 'vendors', 'cities'];

function assertShape(payload, label) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`${label}: payload must be a jsonb object, got ${JSON.stringify(payload)}`);
  }
  for (const k of SECTION_KEYS) {
    if (!Array.isArray(payload[k])) {
      throw new Error(`${label}: section '${k}' must be an array, got ${JSON.stringify(payload[k])}`);
    }
  }
  if (typeof payload.total_count !== 'number') {
    throw new Error(`${label}: total_count must be a number, got ${typeof payload.total_count}`);
  }
  if (!('did_you_mean' in payload)) {
    throw new Error(`${label}: did_you_mean key must always be present`);
  }
  if (payload.did_you_mean !== null && typeof payload.did_you_mean !== 'string') {
    throw new Error(`${label}: did_you_mean must be string|null, got ${typeof payload.did_you_mean}`);
  }
}

async function callRpc(args, label) {
  const { data, error } = await sb.rpc('search_public_v5', args);
  if (error) {
    console.error(`${label}: RPC error: ${error.message}`);
    process.exit(2);
  }
  return data;
}

// Test 1: a known query that should match production data.
const known = await callRpc(
  { p_query: 'bachata', p_city_slug: null, p_section_limit: 5 },
  'search_public_v5("bachata")',
);
assertShape(known, 'bachata');
if (known.total_count === 0) {
  throw new Error('bachata query returned total_count=0 - DB has lost all bachata content?');
}

// Test 2: empty query returns all-empty sections.
const emptyResult = await callRpc(
  { p_query: '', p_city_slug: null, p_section_limit: 5 },
  'search_public_v5("")',
);
assertShape(emptyResult, 'empty-query');
if (emptyResult.total_count !== 0) {
  throw new Error(`empty query should return total_count=0, got ${emptyResult.total_count}`);
}
for (const k of SECTION_KEYS) {
  if (emptyResult[k].length !== 0) {
    throw new Error(`empty query: section '${k}' should be empty, got ${emptyResult[k].length} rows`);
  }
}

// Test 3: nonsense query returns empty sections AND a null did_you_mean.
const bogusResult = await callRpc(
  { p_query: 'zzxqwlllk', p_city_slug: null, p_section_limit: 5 },
  'search_public_v5("zzxqwlllk")',
);
assertShape(bogusResult, 'bogus');
if (bogusResult.total_count !== 0) {
  throw new Error(`bogus query should return total_count=0, got ${bogusResult.total_count}`);
}
if (bogusResult.did_you_mean !== null) {
  throw new Error(`bogus query should have did_you_mean=null, got ${JSON.stringify(bogusResult.did_you_mean)}`);
}

// Test 4: city scope works.
const londonResult = await callRpc(
  { p_query: 'bachata', p_city_slug: 'london-gb', p_section_limit: 5 },
  'search_public_v5("bachata","london-gb")',
);
assertShape(londonResult, 'bachata+london');

// Test 5: default (p_include_past=false) returns only upcoming events.
const upcomingOnly = await callRpc(
  { p_query: 'bachata', p_city_slug: null, p_section_limit: 12 },
  'search_public_v5("bachata",upcoming)',
);
assertShape(upcomingOnly, 'upcoming-only');
const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
for (const ev of upcomingOnly.events) {
  if (!ev.start_time) {
    throw new Error(`upcoming-only: event ${ev.id} (${ev.name}) has null start_time`);
  }
  const t = Date.parse(ev.start_time);
  if (Number.isNaN(t) || t < sixHoursAgo) {
    throw new Error(`upcoming-only: event ${ev.id} (${ev.name}) has past start_time ${ev.start_time}`);
  }
}

// Test 6: p_include_past=true returns >= the upcoming-only count.
const includePast = await callRpc(
  { p_query: 'bachata', p_city_slug: null, p_section_limit: 12, p_include_past: true },
  'search_public_v5("bachata",include_past)',
);
assertShape(includePast, 'include-past');
if (includePast.events.length < upcomingOnly.events.length) {
  throw new Error(`include_past returned fewer events (${includePast.events.length}) than upcoming-only (${upcomingOnly.events.length})`);
}

// Test 7: fuzzy / typo tolerance -- a near-miss resolves to results OR a suggestion.
const fuzzy = await callRpc(
  { p_query: 'bachatta', p_city_slug: null, p_section_limit: 5 },
  'search_public_v5("bachatta")',
);
assertShape(fuzzy, 'fuzzy');
if (fuzzy.total_count <= 0 && typeof fuzzy.did_you_mean !== 'string') {
  throw new Error('fuzzy "bachatta": expected results or a did_you_mean suggestion, got neither');
}

// Test 8: p_event_type narrows the events section (soft-pass when base is empty).
const baseEvents = upcomingOnly.events.length;
if (baseEvents > 0) {
  const filtered = await callRpc(
    { p_query: 'bachata', p_city_slug: null, p_section_limit: 12, p_event_type: ['festival'] },
    'search_public_v5("bachata",etype=festival)',
  );
  assertShape(filtered, 'etype-filter');
  if (filtered.events.length > baseEvents) {
    throw new Error(`etype filter widened events (${filtered.events.length} > ${baseEvents}) - filter not applied`);
  }
}

console.log(JSON.stringify({
  bachata_total: known.total_count,
  empty_total: emptyResult.total_count,
  bogus_total: bogusResult.total_count,
  bachata_london_total: londonResult.total_count,
  upcoming_only_events: upcomingOnly.events.length,
  include_past_events: includePast.events.length,
  fuzzy_total: fuzzy.total_count,
  fuzzy_did_you_mean: fuzzy.did_you_mean,
}, null, 2));
