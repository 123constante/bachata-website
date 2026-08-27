#!/usr/bin/env node
/**
 * CI integrity check for the guest-LIST contract.
 *
 * Sibling of check-guest-entries-contract.mjs. That one watches ROW hygiene (retention,
 * tokens, qr_token defaults); this one watches the guest LIST itself:
 *
 *   - duplicate_live_name_count: two live rows with the same name in the same uniqueness
 *     scope. The two partial unique indexes make this structurally impossible, so nonzero
 *     means an index was dropped or disabled.
 *   - standing_casefold_dupes: two standing (VIP) names differing only by case. Same
 *     reasoning against guest_list_standing_names_norm_name_uq_idx. PostgreSQL allows a
 *     CREATE OR REPLACE of an indexed function without rebuilding the index, so this
 *     measures the literal expression rather than asking the suspect to certify itself.
 *   - payload_contract_breaks: the PUBLIC payload of get_event_guest_list no longer matches
 *     the contract the Website reads (P6). Nonzero means the page and the server disagree
 *     about what `count` means or what an entry carries.
 *
 * WHY THIS FILE EXISTS AT ALL. check_guest_list_contract_v1 has been installed in prod since
 * the guest-list arc's early phases and NOTHING HAS EVER RUN IT -- guards.json carried
 * executor:null for it, which is inventory, not an exemption. Its sibling has been running
 * nightly the whole time, which is what made the gap easy to miss. Wired by the arc's P6
 * (admin migration 20260827210000), the deploy that also gave the check its payload
 * dimension.
 *
 * NON-VACUITY IS ASSERTED, NOT ASSUMED. The payload dimension walks every has_guestlist
 * event; on a database with none it would measure nothing and still report ok:true. The RPC
 * publishes payload_events_checked so that case is distinguishable, and this script FAILS on
 * it rather than printing a green that means "there was nothing to look at".
 *
 * Local:  node scripts/check-guest-list-contract.mjs
 * CI:     env vars VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See: admin repo migrations/20260826210000_guestlist_p3_name_identity_chokepoint_v1.sql
 *      admin repo migrations/20260827210000_guestlist_p6_public_truth_contract_v1.sql
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DRIFT_BASELINE = 0;
/** Prod holds 6 guest-list events. Require at least one, so an empty read is not a pass. */
const MIN_PAYLOAD_EVENTS = 1;

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

const { data, error } = await sb.rpc('check_guest_list_contract_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : NaN);

const driftCount = num(data?.drift_count);
const payloadChecked = num(data?.payload_events_checked);
const payloadBreaks = num(data?.payload_contract_breaks);

/**
 * `process.exitCode`, never `process.exit()`.
 *
 * supabase-js leaves the fetch handle open, and calling process.exit() while libuv still owns
 * it aborts the process -- "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" and exit
 * code 127, which is neither of the codes this script means and reads in CI as a broken
 * runner rather than a failed check. Measured here on 2026-08-27, on the very first run.
 */
const finish = (code, log) => {
  log();
  process.exitCode = code;
};

// ORDER MATTERS. The absent-key case is diagnosed BEFORE the generic malformed-payload one:
// a prod that predates the P6 migration has no payload_* keys at all, and grading that as
// "malformed" sends the reader hunting for a corrupt response instead of telling them the
// public read contract simply is not being checked yet.
if (!Number.isFinite(payloadChecked) || !Number.isFinite(payloadBreaks)) {
  finish(2, () =>
    console.error(
      '\nFAIL: check_guest_list_contract_v1 published no payload dimension ' +
      '(payload_events_checked / payload_contract_breaks are absent). The database predates ' +
      'admin migration 20260827210000, so the public read contract is NOT being checked.',
    ),
  );
} else if (!Number.isFinite(driftCount)) {
  finish(2, () => console.error('\nFAIL: contract RPC returned a malformed payload.'));
} else if (payloadChecked < MIN_PAYLOAD_EVENTS) {
  finish(2, () =>
    console.error(
      `\nFAIL: the payload dimension evaluated ${payloadChecked} events (expected at least ` +
      `${MIN_PAYLOAD_EVENTS}). Nothing was measured, so ok:true means nothing. Either every ` +
      'event lost has_guestlist, or this is pointed at the wrong database.',
    ),
  );
} else if (driftCount === 0) {
  finish(0, () => {
    // The RPC caps its payload scan so an anon caller cannot amplify a request by the fleet
    // size. A cap that is not reported is indistinguishable from full coverage, so say when
    // it bit rather than printing a green that quietly means "the first 50".
    // payload_events_in_fleet, NOT *_total: the admin health page adopts any key ending in
    // `_total` as the row's denominator, which would mislabel that row's two unrelated
    // dimensions. The RPC names the key for what it counts; this reader follows.
    const total = num(data?.payload_events_in_fleet);
    if (Number.isFinite(total) && total > payloadChecked) {
      console.warn(
        `\nNOTE: the payload dimension checked ${payloadChecked} of ${total} guest-list ` +
        'events (the RPC\'s scan cap was reached). The remainder were NOT checked.',
      );
    }
    console.log(
      '\nOK: 0 drift across all dimensions. Contract holds ' +
      `(payload dimension checked ${payloadChecked} event(s)).`,
    );
  });
} else if (driftCount <= DRIFT_BASELINE) {
  finish(0, () =>
    console.warn(`\nWARN: ${driftCount} drift (baseline: ${DRIFT_BASELINE}). No regression.`),
  );
} else {
  const causes = [];
  if (num(data?.duplicate_live_name_count) > 0) {
    causes.push('a partial unique index on event_guest_list_entries was dropped or disabled');
  }
  if (num(data?.standing_casefold_dupes) > 0) {
    causes.push(
      'guest_list_standing_names_norm_name_uq_idx was dropped, or _guest_normalize_name_v1 ' +
      'was replaced under it',
    );
  }
  if (payloadBreaks > 0) {
    causes.push(
      'get_event_guest_list no longer matches the public payload contract the Website reads ' +
      '-- see payload_sample above for the offending event(s)',
    );
  }
  finish(1, () =>
    console.error(
      `\nFAIL: ${driftCount} drift (baseline: ${DRIFT_BASELINE}). Likely: ${causes.join('; ')}.`,
    ),
  );
}
