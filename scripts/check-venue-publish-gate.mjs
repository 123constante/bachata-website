#!/usr/bin/env node
/**
 * CI contract check for the canonical venue publish-state visibility gate.
 *
 * Calls public.check_venue_publish_gate_contract_v1() and exits non-zero if any
 * venue-as-destination read path (get_public_venues_list_v3,
 * get_public_venue_by_venues_id, get_venue_detail, search_public_v5) has drifted
 * off the canonical predicate public.venue_is_public(publish_state) — statically
 * (incl. did_you_mean gate, IN/ANY/reversed/IS-DISTINCT literal forms) and
 * behaviourally (executes each read path and asserts the gate holds).
 *
 * The guard's behavioural leg executes search_public_v5 + the directory RPC; a
 * cold backend could transiently hit the anon 3s statement_timeout (57014). That
 * is infra flakiness, not gate drift, so we retry once before failing.
 *
 * Local:  node scripts/check-venue-publish-gate.mjs      (reads .env)
 * CI:     env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See admin migration 20260627120000_venue_is_public_predicate_and_gate_v1 and
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

// A transient/timeout failure (e.g. the anon 3s statement_timeout, code 57014,
// or a network blip) is infra noise, not gate drift — retry once.
function isTransient(err) {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  return (
    code === '57014' ||
    msg.includes('statement timeout') ||
    msg.includes('canceling statement') ||
    msg.includes('timeout') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout')
  );
}

const callGuard = () => sb.rpc('check_venue_publish_gate_contract_v1');

let { data, error } = await callGuard();
if (error && isTransient(error)) {
  console.error(`Transient error (${error.code || '?'}: ${error.message}); retrying once in 2s...`);
  await new Promise((r) => setTimeout(r, 2000));
  ({ data, error } = await callGuard());
}

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (Array.isArray(data?.notes)) {
  for (const n of data.notes) console.warn(`  note: ${n}`);
}

if (!data?.ok) {
  const errs = Array.isArray(data?.errors) ? data.errors : [];
  console.error(`\nFAIL: venue publish-gate drift detected (${errs.length} issue(s)).`);
  for (const e of errs) console.error(`  - ${e}`);
  process.exit(1);
}

console.log('\nOK: every venue-as-destination read path gates via venue_is_public().');
process.exit(0);
