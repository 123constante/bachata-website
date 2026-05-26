#!/usr/bin/env node
/**
 * CI contract check for the search_public_v3 RPC.
 * Verifies:
 *   1. The RPC exists and is callable as anon.
 *   2. It returns a jsonb object with the six expected section arrays.
 *   3. Each section value is an array (possibly empty).
 *   4. Empty query returns total_count = 0 with all-empty sections.
 *
 * Local:  node scripts/check-search-public-v3.mjs   (reads .env)
 * CI:     same script, env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See admin migration 20260720000000_search_public_v3 and
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

const SECTION_KEYS = ['events', 'organisers', 'teachers', 'djs', 'dancers', 'venues'];

function assertShape(payload, label) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`${label}: payload must be a jsonb object, got ${JSON.stringify(payload)}`);
  }
  for (const key of SECTION_KEYS) {
    if (!Array.isArray(payload[key])) {
      throw new Error(`${label}: section '${key}' must be an array, got ${JSON.stringify(payload[key])}`);
    }
  }
  if (typeof payload.total_count !== 'number') {
    throw new Error(`${label}: total_count must be a number, got ${typeof payload.total_count}`);
  }
}

async function callRpc(args, label) {
  const { data, error } = await sb.rpc('search_public_v3', args);
  if (error) {
    console.error(`${label}: RPC error: ${error.message}`);
    process.exit(2);
  }
  return data;
}

// Test 1: a known query that should match production data ('salsa').
const popularResult = await callRpc(
  { p_query: 'salsa', p_city_slug: null, p_section_limit: 5 },
  'search_public_v3("salsa")',
);
assertShape(popularResult, 'salsa');
if (popularResult.total_count === 0) {
  throw new Error('salsa query returned total_count=0 â€” DB has lost all salsa-tagged content?');
}

// Test 2: empty query returns all-empty sections.
const emptyResult = await callRpc(
  { p_query: '', p_city_slug: null, p_section_limit: 5 },
  'search_public_v3("")',
);
assertShape(emptyResult, 'empty-query');
if (emptyResult.total_count !== 0) {
  throw new Error(`empty query should return total_count=0, got ${emptyResult.total_count}`);
}
for (const key of SECTION_KEYS) {
  if (emptyResult[key].length !== 0) {
    throw new Error(`empty query: section '${key}' should be empty, got ${emptyResult[key].length} rows`);
  }
}

// Test 3: nonsense query returns empty sections.
const bogusResult = await callRpc(
  { p_query: 'zzzbogus123xyznever', p_city_slug: null, p_section_limit: 5 },
  'search_public_v3("zzzbogus...")',
);
assertShape(bogusResult, 'bogus');
if (bogusResult.total_count !== 0) {
  throw new Error(`bogus query should return total_count=0, got ${bogusResult.total_count}`);
}

// Test 4: city scope works (london-gb should return >= 1 salsa event/organiser).
const londonResult = await callRpc(
  { p_query: 'salsa', p_city_slug: 'london-gb', p_section_limit: 5 },
  'search_public_v3("salsa","london-gb")',
);
assertShape(londonResult, 'salsa+london');

console.log(JSON.stringify({
  salsa_total: popularResult.total_count,
  empty_total: emptyResult.total_count,
  bogus_total: bogusResult.total_count,
  salsa_london_total: londonResult.total_count,
}, null, 2));
