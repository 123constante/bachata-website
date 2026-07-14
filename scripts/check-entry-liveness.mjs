#!/usr/bin/env node
/**
 * CI contract check #52 - entry liveness + waitlist strand (raffle Phase 6, 2026-07-12).
 *
 * Calls public.check_entry_liveness_contract_v1(), which asserts the unified
 * liveness model (is_live := deleted_at IS NULL) holds and that no waitlister is
 * stranded. Phase 6 dropped the global AFTER UPDATE promotion triggers (which
 * promoted soft-deleted rows and fired N unrequested promotions) in favour of
 * explicit, scoped promotion routed through the Phase-5 chokepoint.
 *
 * Guarded dimensions (both must be 0):
 *   - deleted_but_live:   a row with status IN ('active','waitlist') AND deleted_at set
 *                         (the two liveness signals disagree)
 *   - stranded_waitlist:  free capacity in scope yet a row is still 'waitlist' - the
 *                         missed-callsite detector (a slot-freeing writer forgot to promote)
 *   - deleted_but_live_rows / stranded_waitlist_rows: the offending rows (for triage)
 *
 * GATING: ok=true required. Either anomaly fails the build.
 *
 * Local:  node scripts/check-entry-liveness.mjs   (reads .env)
 * CI:     env VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 * See:    admin repo migrations/20260712010000_raffle_phase6_explicit_waitlist_promotion_v1.sql
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

const { data, error } = await sb.rpc('check_entry_liveness_contract_v1');

if (error) {
  if (/function .* does not exist|could not find/i.test(error.message)) {
    console.error(
      `FAIL: check_entry_liveness_contract_v1 not found (${error.message}) - the liveness ` +
      `RPC is missing, contract broken.`,
    );
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.ok !== true) {
  console.error(
    `\nENTRY LIVENESS FAIL: ${data?.deleted_but_live ?? '?'} deleted-but-live + ` +
    `${data?.stranded_waitlist ?? '?'} stranded-waitlist row(s) (see rows above). ` +
    `deleted_but_live>0 means a soft-delete left status active/waitlist; stranded_waitlist>0 ` +
    `means a slot-freeing writer forgot to call _promote_waitlist_v1.`,
  );
  process.exit(1);
}

console.log('\nEntry liveness: ok (no deleted-but-live rows, no stranded waitlisters).');
process.exit(0);
