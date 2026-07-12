#!/usr/bin/env node
/**
 * CI contract check #49 - raffle winner ledger integrity (raffle Phase 3, 2026-07-10).
 *
 * Calls public.check_raffle_winners_contract_v1(), which asserts the raffle_winners
 * ledger stays keyed on the business fact ("this phone won at this event/venue").
 * This is the check that catches the live tc-02 drift class the ledger shipped
 * without: active-draw winners with no ledger row (they could win again at the
 * same venue).
 *
 * Guarded dimensions (all must be 0):
 *   - duplicate_phone_event:            more than one ledger row per (phone_e164, event_id)
 *   - active_draw_winner_without_ledger: a live winning draw whose winner has no ledger row (tc-02)
 *   - orphan_manual_no_entry:           source='manual' with entry_id IS NULL
 *   - venue_null_on_venued_event:       NULL venue_id on an event that has a venue
 *   - bad_source:                       source outside {manual,draw,pick,backfill}
 *
 * GATING: ok=true required. Any drift fails the build.
 *
 * Local:  node scripts/check-raffle-winners.mjs   (reads .env)
 * CI:     env VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 * See:    admin repo migrations/20260710040000_raffle_winner_ledger_rekey_v1.sql
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

const { data, error } = await sb.rpc('check_raffle_winners_contract_v1');

if (error) {
  if (/function .* does not exist|could not find/i.test(error.message)) {
    console.error(
      `FAIL: check_raffle_winners_contract_v1 not found (${error.message}) - the ledger ` +
      `integrity RPC is missing, contract broken.`,
    );
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.ok !== true) {
  console.error(
    `\nRAFFLE WINNER LEDGER FAIL: raffle_winners has drifted (see per-field counts above). ` +
    `active_draw_winner_without_ledger>0 is the tc-02 incident (a winner can win again at ` +
    `the same venue); duplicate_phone_event>0 breaks the (phone,event) business key. Route ` +
    `all winner writes through record_raffle_win_v1 and heal the offending rows.`,
  );
  process.exit(1);
}

console.log('\nRaffle winner ledger: ok (no dup/orphan/unledgered-winner/null-venue/bad-source rows).');
process.exit(0);
