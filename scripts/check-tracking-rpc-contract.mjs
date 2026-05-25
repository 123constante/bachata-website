#!/usr/bin/env node
/**
 * CI contract check for the analytics tracking RPCs.
 *
 * WHY THIS EXISTS: in May 2026 event-view tracking silently died for 16 days.
 * The frontend sent `p_session_id` but the DB parameter had been renamed to
 * `p_viewer_session_id`, so every call 404'd on the signature and the error was
 * swallowed (fire-and-forget). Nothing caught it. This check calls each tracking
 * RPC with the EXACT parameter names the frontend sends and fails if PostgREST
 * can't match the signature — turning that whole class of silent breakage into a
 * red CI run.
 *
 * Safe to run against prod: every call uses a bot user-agent, so the RPCs'
 * bot-UA filter returns before any row is inserted (verified: record_event_view_v1
 * returns {ok:false, reason:'bot_ua'}; record_event_link_click_v1 returns void).
 *
 * The param sets below MUST mirror the frontend:
 *   - src/modules/event-page/useRecordEventView.ts  (record_event_view_v1)
 *   - src/lib/eventLinkClicks.ts                     (record_event_link_click_v1)
 * If you change the params there, change them here.
 *
 * Exit policy:
 *   all contracts hold            -> 0 (pass)
 *   a param set is rejected (404) -> 1 (fail; param drift or RPC missing)
 *   transport / unexpected error  -> 2
 *
 * Local:  node scripts/check-tracking-rpc-contract.mjs
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

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Bot UA → the RPC bot-filter short-circuits before any insert.
const BOT_UA = 'ci-contract-check-bot';
const ZERO = '00000000-0000-0000-0000-000000000000';

// Each entry's params object mirrors exactly what the frontend sends.
const CONTRACTS = [
  {
    rpc: 'record_event_view_v1',
    source: 'src/modules/event-page/useRecordEventView.ts',
    params: {
      p_event_id: ZERO,
      p_viewer_session_id: 'ci-contract-check',
      p_source: 'ci-contract-check',
      p_user_agent: BOT_UA,
      p_occurrence_id: null,
    },
  },
  {
    rpc: 'record_event_link_click_v1',
    source: 'src/lib/eventLinkClicks.ts',
    params: {
      p_event_id: ZERO,
      p_link_type: 'other',
      p_target_url: null,
      p_session_id: 'ci-contract-check',
      p_source: 'ci-contract-check',
      p_user_agent: BOT_UA,
    },
  },
];

const NOT_FOUND = /PGRST202|could not find the function|schema cache|does not exist/i;

let failed = false;
for (const c of CONTRACTS) {
  const { error } = await sb.rpc(c.rpc, c.params);
  if (!error) {
    console.log(`OK: ${c.rpc} accepts the frontend param set { ${Object.keys(c.params).join(', ')} }.`);
    continue;
  }
  const msg = `${error.code || ''} ${error.message || ''}`.trim();
  if (NOT_FOUND.test(msg)) {
    failed = true;
    console.error(
      `FAIL: ${c.rpc} rejected the frontend param set { ${Object.keys(c.params).join(', ')} }.\n` +
        `      PostgREST could not match the signature (${msg}).\n` +
        `      The DB parameter names drifted from ${c.source}, OR the RPC is missing.\n` +
        `      Tracking calls from the site will silently fail until these align.`,
    );
    continue;
  }
  console.error(`Transport/unexpected error calling ${c.rpc}: ${msg}`);
  process.exit(2);
}

if (failed) process.exit(1);
console.log('OK: tracking RPC param contracts intact (frontend ↔ live DB signatures match).');
process.exit(0);
