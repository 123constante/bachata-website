#!/usr/bin/env node
/**
 * CI integrity check for the Program editor Phase 0 schema contract.
 *
 * Calls public.check_event_program_section_consistency_v1() and reports the
 * health of the Day/Section/Section-Room schema introduced by admin migration
 * 20260504050000_program_editor_phase0_schema_v1.sql.
 *
 * Exit policy:
 *   - items_missing_day > 0                                -> exit 1 (fail; backfill broken)
 *   - items_missing_section > 0                            -> exit 1 (fail; backfill broken)
 *   - sections_with_zero_rooms_but_items > 0               -> exit 1 (fail; actionable drift)
 *   - sections_with_zero_rooms_but_items = 0               -> exit 0 (pass)
 *   - sections_with_zero_items, orphan_days,
 *     sections_roomless_by_design                          -> informational only
 *
 * 2026-05-13 — the contract was narrowed (admin migration 20260601040600) so
 * `sections_with_zero_rooms_but_items` now only counts ACTIONABLE drift:
 * sections whose event venue has at least one venue_room. Sections whose
 * event has no venue, or whose venue has zero venue_rooms, are surfaced
 * separately as `sections_roomless_by_design` — the schema's NOT-NULL
 * venue_room_id FK gives them nothing to point at until Phase 2 room
 * redesign lands, so they're observable but no longer count as violations.
 * Baseline tolerance was dropped at the same time; strict zero is required.
 *
 * Local:  node scripts/check-program-schema-contract.mjs   (reads .env)
 * CI:     same script, env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See:
 *   admin repo migrations/20260504050000_program_editor_phase0_schema_v1.sql
 *   admin repo migrations/20260504050001_program_editor_phase0_performance_classification_fix.sql
 *   plan_program_editor_production_grade.md (Phase 0)
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

// Baseline retired 2026-05-13 — contract narrowed to actionable drift only
// (admin migration 20260601040600). Strict zero required.
const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await sb.rpc('check_event_program_section_consistency_v1');

if (error) {
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

const itemsMissingDay     = Number.isFinite(data?.items_missing_day) ? data.items_missing_day : NaN;
const itemsMissingSection = Number.isFinite(data?.items_missing_section) ? data.items_missing_section : NaN;
const sectionsZeroRooms   = Number.isFinite(data?.sections_with_zero_rooms_but_items) ? data.sections_with_zero_rooms_but_items : NaN;
const totalItems          = Number.isFinite(data?.total_items) ? data.total_items : NaN;

if (
  !Number.isFinite(itemsMissingDay) ||
  !Number.isFinite(itemsMissingSection) ||
  !Number.isFinite(sectionsZeroRooms) ||
  !Number.isFinite(totalItems)
) {
  console.error('\nFAIL: contract RPC returned malformed payload.');
  process.exit(2);
}

let failed = false;

if (itemsMissingDay > 0) {
  console.error(
    `\nFAIL: ${itemsMissingDay} event_program_items have NULL day_id. ` +
    `Phase 0 backfill is broken or a write path bypassed the schema.`,
  );
  failed = true;
}

if (itemsMissingSection > 0) {
  console.error(
    `\nFAIL: ${itemsMissingSection} event_program_items have NULL section_id. ` +
    `Phase 0 backfill is broken or a write path bypassed the schema.`,
  );
  failed = true;
}

if (sectionsZeroRooms > 0) {
  console.error(
    `\nFAIL: ${sectionsZeroRooms} actionable section(s) have items but no row ` +
    `in event_program_section_rooms (strict zero required after the ` +
    `2026-05-13 contract narrowing — actionable = event venue has venue_rooms).`,
  );
  failed = true;
}

if (failed) {
  process.exit(1);
}

const roomlessByDesign = Number.isFinite(data?.sections_roomless_by_design)
  ? data.sections_roomless_by_design
  : 0;
console.log(
  `\nOK: ${totalItems} program items, ` +
  `0 actionable section_rooms violations, ` +
  `${roomlessByDesign} sections roomless-by-design (venue has no venue_rooms — Phase 2 territory). ` +
  `Contract holds.`,
);
process.exit(0);
