#!/usr/bin/env node
/**
 * CI contract check #50 - raffle draw snapshot shape (raffle Phase 4, 2026-07-10).
 *
 * Calls public.check_raffle_draw_snapshot_contract_v1(), which asserts every
 * event_raffle_draws.entries_snapshot has the canonical {pool, chosen, method}
 * shape. Draw and pick used to write divergent snapshot shapes ({pool,chosen}
 * vs a bare array), a booby-trap for any report reader; Phase 4 routed both
 * through one recorder (_raffle_record_draw_v1) and backfilled the 4 legacy draws.
 *
 * Guarded dimensions:
 *   - offender_count: draws whose entries_snapshot is not the canonical shape (must be 0)
 *   - offender_ids:   the offending draw ids (for triage)
 *   - total_draws:    total ledgered draws (context; 0 draw/pick rows is normal - redraw
 *                     DELETEs them on supersede, only backfill+manual persist)
 *
 * GATING: ok=true required. Any offender fails the build.
 *
 * Local:  node scripts/check-raffle-draw-snapshot.mjs   (reads .env)
 * CI:     env VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 * See:    admin repo migrations/20260710070000_raffle_drawable_pool_setfn_v1.sql
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

const { data, error } = await sb.rpc('check_raffle_draw_snapshot_contract_v1');

if (error) {
  if (/function .* does not exist|could not find/i.test(error.message)) {
    console.error(
      `FAIL: check_raffle_draw_snapshot_contract_v1 not found (${error.message}) - the ` +
      `snapshot-shape RPC is missing, contract broken.`,
    );
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.ok !== true) {
  console.error(
    `\nRAFFLE DRAW SNAPSHOT FAIL: ${data?.offender_count ?? '?'} draw(s) have a non-canonical ` +
    `entries_snapshot (ids above). Every draw/pick must record {pool, chosen, method} via ` +
    `_raffle_record_draw_v1 - a new write path is stamping a divergent shape.`,
  );
  process.exit(1);
}

console.log('\nRaffle draw snapshot: ok (all entries_snapshot rows are the canonical {pool,chosen,method}).');
process.exit(0);
