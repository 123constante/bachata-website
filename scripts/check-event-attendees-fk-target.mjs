#!/usr/bin/env node
/**
 * CI integrity check for the event_attendees.dancer_id FK target. Calls
 * public.check_event_attendees_fk_target_v1() and exits non-zero if the
 * FK is missing or repointed away from public.dancer_profiles (e.g. back
 * to the archived dancers_archive_april2026 table).
 *
 * Local:  node scripts/check-event-attendees-fk-target.mjs   (reads .env)
 * CI:     same script, env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See admin migrations
 *   20260512020000_event_attendees_dancer_fk_repoint_to_dancer_profiles_v1
 *   20260512030000_check_fk_indexes_and_attendees_target_v1
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

const { data, error } = await sb.rpc('check_event_attendees_fk_target_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (!data?.ok) {
  console.error(
    `\nFAIL: event_attendees_dancer_id_fkey target is "${data?.target_table ?? 'missing'}", expected "dancer_profiles".`,
  );
  if (data?.definition) {
    console.error(`  definition: ${data.definition}`);
  }
  process.exit(1);
}

console.log('\nOK: event_attendees_dancer_id_fkey targets dancer_profiles.');
process.exit(0);
