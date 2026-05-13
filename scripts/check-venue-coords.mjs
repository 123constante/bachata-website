#!/usr/bin/env node
/**
 * CI integrity check for the venue lat/lng contract.
 *
 * Calls public.check_venue_coords_contract_v1() and fails if:
 *   - any venue has raw location data (postcode / google_maps_link /
 *     google_maps_url) but NULL lat / lng (would sort to the end of "near me")
 *   - the BEFORE INSERT/UPDATE trigger trg_venue_extract_coords_from_url is
 *     missing or disabled
 *   - the CHECK constraint venues_coords_required_when_resolvable is missing
 *     or never validated
 *
 * "Hopeless" venues (no raw location data at all) are allowed to have NULL
 * coords and do NOT count as violations — the contract says you must have
 * coords IFF you have raw data to derive them from.
 *
 * Local:  node scripts/check-venue-coords.mjs   (reads .env)
 * CI:     same script, env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See:
 *   admin repo migrations/20260601040000_venue_coords_contract_v1.sql
 *   admin repo migrations/20260601040100_check_venue_coords_contract_rpc_v1.sql
 *   admin repo migrations/20260601040200_venue_coords_validate_constraint_v1.sql
 *   admin repo scripts/backfill-venue-coords.mjs
 *   admin repo supabase/functions/venue-resolve-coords/index.ts
 *   .github/workflows/db-contract-check.yml
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

const { data, error } = await sb.rpc('check_venue_coords_contract_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

const ok                       = data?.ok === true;
const totalVenues              = Number(data?.total_venues);
const withCoords               = Number(data?.with_coords);
const withoutCoordsResolvable  = Number(data?.without_coords_resolvable);
const withoutCoordsHopeless    = Number(data?.without_coords_hopeless);
const triggerPresent           = data?.trigger_present === true;
const checkConstraintPresent   = data?.check_constraint_present === true;
const checkConstraintValidated = data?.check_constraint_validated === true;

if (!Number.isFinite(totalVenues) || !Number.isFinite(withCoords)) {
  console.error('\nFAIL: contract RPC returned malformed payload.');
  process.exit(2);
}

if (ok) {
  console.log(
    `\nOK: ${withCoords}/${totalVenues} venues with coords. ` +
    `${withoutCoordsHopeless} hopeless (no raw data). ` +
    `Trigger present: ${triggerPresent}. CHECK validated: ${checkConstraintValidated}.`,
  );
  process.exit(0);
}

console.error('\nFAIL: venue coords contract violated.');
if (withoutCoordsResolvable > 0) {
  console.error(
    `  • ${withoutCoordsResolvable} venue(s) have raw location data (postcode / ` +
    `google_maps_link / google_maps_url) but NULL lat/lng. Run ` +
    `admin/scripts/backfill-venue-coords.mjs.`,
  );
}
if (!triggerPresent) {
  console.error('  • Trigger trg_venue_extract_coords_from_url is missing or disabled.');
}
if (!checkConstraintPresent) {
  console.error('  • CHECK constraint venues_coords_required_when_resolvable is missing.');
}
if (Array.isArray(data?.samples) && data.samples.length > 0) {
  console.error('\n  Sample violations:');
  for (const s of data.samples) {
    console.error(
      `    - ${s.name} (${s.id}): ` +
      `postcode=${s.postcode || '—'}, link=${s.google_maps_link || '—'}`,
    );
  }
}
process.exit(1);
