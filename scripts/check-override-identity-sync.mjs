#!/usr/bin/env node
/**
 * CI contract check — per-occurrence override identity sync (P5 typed columns ->
 * legacy override_payload), 2026-06-22.
 *
 * calendar_occurrences.override_payload is the legacy shape the public event-detail
 * read (get_event_page_snapshot_v2) consumes. Its identity keys (name, poster_url,
 * ticket_url, description, level) are now a PURE DERIVED PROJECTION of the
 * event_occurrence_override_p5 typed columns, maintained by a single trigger
 * (trg_mirror_p5_override_identity_to_legacy, admin migration 20260925000000).
 *
 * The bug it locks: the old per-writer, dirty-key-gated mirror left a partial edit
 * (e.g. retitling one date of a recurring series) with a stale payload — so the
 * date's overridden cover / ticket / title silently never reached the website
 * (the "Antoni y Belen - Poolside Glam" report).
 *
 * Calls public.check_override_payload_identity_sync_v1(), which returns:
 *   - forward_drift_count   GATED: must be 0 (payload identity != typed columns)
 *   - reverse_orphan_count  informational (payload identity with no typed row;
 *                           e.g. legacy admin_bulk_patch_occurrences_v1 writes)
 *
 * GATING: forward_drift_count === 0.
 *
 * Local:  node scripts/check-override-identity-sync.mjs
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

const { data, error } = await sb.rpc('check_override_payload_identity_sync_v1');

if (error) {
  if (/function .* does not exist/i.test(error.message)) {
    console.error(`FAIL: check_override_payload_identity_sync_v1 not found (${error.message}) -- RPC is missing, contract broken.`);
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

const forward = data?.forward_drift_count ?? null;
const reverse = data?.reverse_orphan_count ?? 0;

if (forward === null) {
  console.error('FAIL: forward_drift_count missing from RPC response -- contract shape changed.');
  process.exit(1);
}

if (forward !== 0) {
  console.error(
    `\nOVERRIDE IDENTITY SYNC FAIL: ${forward} legacy override_payload row(s) drifted from ` +
    `their event_occurrence_override_p5 typed columns. A per-occurrence override (cover / ` +
    `ticket / title / description / level) will not match what the website renders. See ` +
    `sample_forward_drift above. Likely cause: a write reached calendar_occurrences.override_payload ` +
    `or the typed columns outside the projection trigger.`,
  );
  process.exit(1);
}

if (reverse > 0) {
  // GATED since admin migration 20260925020000 neutralized the two legacy writers
  // (admin_bulk_patch_occurrences_v1 / admin_set_occurrence_override_v1). With the
  // app-level write vector closed, a reverse-orphan (payload identity with no P5 typed
  // row) can only come from a raw-SQL / out-of-band write — which is what we want to catch.
  console.error(
    `\nOVERRIDE IDENTITY SYNC FAIL: ${reverse} reverse-orphan row(s) (override_payload identity ` +
    `with no event_occurrence_override_p5 row). See sample_reverse_orphan above. Likely cause: ` +
    `a raw-SQL write set calendar_occurrences.override_payload identity directly. Write the P5 ` +
    `typed table instead; the projection trigger maintains the payload.`,
  );
  process.exit(1);
}

console.log('\nOverride identity sync: ok (status=ok, forward_drift=0, reverse_orphan=0).');
process.exit(0);
