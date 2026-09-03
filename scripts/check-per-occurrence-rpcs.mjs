#!/usr/bin/env node
/**
 * CI integrity check for the per-occurrence editing RPCs (Phase 1/1.1/1B/2A/2B/2C
 * + production-grade hardening items 1-7).
 *
 * Calls public.test_per_occurrence_v1() and public.test_per_occurrence_actor_kind_v1()
 * and exits non-zero on any failure across either suite.
 *
 * Both functions are self-contained: they create fixtures inside sub-transactions
 * and roll back via a sentinel exception, so calling them never leaves data behind.
 *
 * Local:  node scripts/check-per-occurrence-rpcs.mjs   (reads .env)
 * CI:     same script, env vars supplied as repo secrets.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { rpcOnce, exitTransient } from './lib/rpc-retry.mjs';

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

const suites = [
  { name: 'core', rpc: 'test_per_occurrence_v1' },
  { name: 'actor_kind', rpc: 'test_per_occurrence_actor_kind_v1' },
];

let totalRun = 0;
let totalFailed = 0;

for (const suite of suites) {
  // rpcOnce: these test_* suites write inside the RPC, so they are not safe to
  // repeat blindly. Classification still routes a timeout to exit 2.
  let data;
  try {
    data = await rpcOnce(sb, suite.rpc);
  } catch (e) {
    exitTransient(e, `[${suite.name}]`);
    console.error(`[${suite.name}] RPC failed: ${e.message}`);
    process.exit(2);
  }
  const tests = Array.isArray(data?.tests) ? data.tests : [];
  const failed = tests.filter((t) => !t.pass);
  totalRun += tests.length;
  totalFailed += failed.length;
  console.log(`[${suite.name}] ${tests.length} run, ${failed.length} failed`);
  for (const t of tests) {
    console.log(`  ${t.pass ? 'PASS' : 'FAIL'}  ${t.test}${t.msg ? '  — ' + t.msg : ''}`);
  }
  if (!data?.ok) {
    console.error(`[${suite.name}] FAIL`);
  }
}

console.log(`\nTotal: ${totalRun} run, ${totalFailed} failed across ${suites.length} suites`);

if (totalFailed > 0) {
  process.exit(1);
}

console.log('OK: all per-occurrence invariants holding.');
process.exit(0);
