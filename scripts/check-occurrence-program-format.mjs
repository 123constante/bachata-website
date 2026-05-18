#!/usr/bin/env node
/**
 * CI integrity check for the get_occurrence_program_v1 output format.
 * Calls public.check_occurrence_program_format_v1() and exits non-zero
 * if any session's start_time / end_time deviates from naive-local ISO
 * (YYYY-MM-DDTHH:MM:SS, no offset, no Z, no fractional seconds).
 *
 * Background (ADR-007 Phase 8 H3): the public Website's `toMins` parser
 * strips the offset and reads HH:MM verbatim. Any RPC change that
 * re-introduces a UTC offset on the JSON output would silently shift
 * the displayed time by the local-to-UTC delta (e.g. 1 h during BST).
 * This check catches such drift on every push, every PR, and daily.
 *
 * Local:  node scripts/check-occurrence-program-format.mjs
 * CI:     same script, env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
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

const { data, error } = await sb.rpc('check_occurrence_program_format_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.status !== 'ok') {
  const v = data?.format_violations ?? '?';
  const total = data?.sessions_checked ?? '?';
  console.error(
    `\nFORMAT DRIFT: ${v}/${total} session timestamps do not match the expected ` +
    `naive-local ISO shape (YYYY-MM-DDTHH:MM:SS).\n` +
    `Fix: ensure get_occurrence_program_v1's start_time / end_time fields are ` +
    `\`timestamp without time zone\` values in their JSON output — not timestamptz, ` +
    `not strings with offsets or Z suffix. See admin migration 20260624030000 ` +
    `(initial fix) and 20260625030000 (multi-day day_event_date anchoring).`,
  );
  process.exit(1);
}

console.log(`\noccurrence_program_format check: ok (0/${data.sessions_checked} violations).`);
process.exit(0);
