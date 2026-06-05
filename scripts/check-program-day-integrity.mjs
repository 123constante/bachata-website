#!/usr/bin/env node
/**
 * CI contract check — program-day / day_id integrity.
 *
 * Calls public.check_program_day_integrity_v1() and exits non-zero if any
 * event_program_item with a real start_time (>= 2020; legacy 2000-01-01
 * sentinels excluded) is filed under a day whose event_date != the item's
 * rollover-resolved display day (src/lib/programDayRollover.ts rule). Misfiled
 * days leak template/stale dates into re-anchored occurrence schedules (the
 * "FRI 8 / SAT 9" class of bug).
 *
 * Local:  node scripts/check-program-day-integrity.mjs
 * CI:     same, env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
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

const { data, error } = await sb.rpc('check_program_day_integrity_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.status !== 'ok') {
  const drift = data?.mismatch_count ?? '?';
  const total = data?.items_total ?? '?';
  console.error(
    `\nPROGRAM-DAY DRIFT: ${drift}/${total} item(s) filed under a day_id whose ` +
    `event_date != the item's canonical display-day.\nFix: re-file via the admin ` +
    `program editor or merge the stale day; see the day-rollover rule ` +
    `(src/lib/programDayRollover.ts).`,
  );
  process.exit(1);
}

console.log(`\nprogram-day integrity check: ok (0/${data.items_total} mismatch).`);
process.exit(0);
