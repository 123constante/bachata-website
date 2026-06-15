#!/usr/bin/env node
/**
 * CI contract check for the search-v5 telemetry RPCs.
 *
 * Mirrors check-tracking-rpc-contract.mjs: calls each RPC with the EXACT param
 * names the frontend sends and fails (red CI) if PostgREST can't match the
 * signature -- the silent-fire-and-forget breakage class.
 *
 * Safe against prod: record_search_result_click_v1 is called with a bot UA, so
 * the RPC's bot-filter returns before any row is inserted.
 *
 * Param sets MUST mirror:
 *   - src/lib/searchClickTelemetry.ts   (record_search_result_click_v1)
 *   - src/hooks/usePopularSearches.ts   (get_popular_searches_v1)
 *
 * Admin migrations 20260826001000_search_result_clicks_v1 and
 * 20260826003000_search_public_extras_v1.
 *
 * Local:  node scripts/check-search-telemetry-v1.mjs
 * CI:     env VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
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

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const BOT_UA = 'ci-contract-check-bot';
const ZERO = '00000000-0000-0000-0000-000000000000';
const NOT_FOUND = /PGRST202|could not find the function|schema cache|does not exist/i;

let failed = false;

// 1. record_search_result_click_v1 -- exact frontend param set, bot UA (no insert).
{
  const params = {
    p_query: 'ci-contract-check',
    p_entity_type: 'event',
    p_entity_id: ZERO,
    p_position: 1,
    p_session_id: 'ci-contract-check',
    p_user_agent: BOT_UA,
    p_source: 'ci-contract-check',
  };
  const { error } = await sb.rpc('record_search_result_click_v1', params);
  if (!error) {
    console.log(`OK: record_search_result_click_v1 accepts { ${Object.keys(params).join(', ')} }.`);
  } else {
    const msg = `${error.code || ''} ${error.message || ''}`.trim();
    if (NOT_FOUND.test(msg)) {
      failed = true;
      console.error(
        `FAIL: record_search_result_click_v1 rejected the frontend param set (${msg}).\n` +
          `      DB params drifted from src/lib/searchClickTelemetry.ts, or the RPC is missing.`,
      );
    } else {
      console.error(`Transport/unexpected error calling record_search_result_click_v1: ${msg}`);
      process.exit(2);
    }
  }
}

// 2. get_popular_searches_v1 -- anon callable; array of { query, search_count }.
{
  const { data, error } = await sb.rpc('get_popular_searches_v1', { p_city_slug: null, p_limit: 8 });
  if (error) {
    const msg = `${error.code || ''} ${error.message || ''}`.trim();
    if (NOT_FOUND.test(msg)) {
      failed = true;
      console.error(`FAIL: get_popular_searches_v1 missing or signature drift (${msg}).`);
    } else {
      console.error(`Transport/unexpected error calling get_popular_searches_v1: ${msg}`);
      process.exit(2);
    }
  } else if (!Array.isArray(data)) {
    failed = true;
    console.error(`FAIL: get_popular_searches_v1 must return an array, got ${typeof data}.`);
  } else {
    for (const row of data) {
      const countOk = typeof row.search_count === 'number' || (typeof row.search_count === 'string' && !Number.isNaN(Number(row.search_count)));
      if (typeof row.query !== 'string' || row.query.length === 0 || !countOk) {
        failed = true;
        console.error(`FAIL: get_popular_searches_v1 row shape invalid: ${JSON.stringify(row)}`);
        break;
      }
    }
    if (!failed) console.log(`OK: get_popular_searches_v1 returned ${data.length} well-shaped row(s).`);
  }
}

if (failed) process.exit(1);
console.log('OK: search telemetry RPC contracts intact (frontend params match live DB signatures).');
process.exit(0);
