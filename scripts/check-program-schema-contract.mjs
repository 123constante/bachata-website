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
 *   - sections_with_zero_rooms_but_items > BASELINE        -> exit 1 (fail; new regression)
 *   - sections_with_zero_rooms_but_items <= BASELINE       -> exit 0 (pass)
 *   - sections_with_zero_items, orphan_days                -> informational only
 *
 * Items that legitimately predate the venue_rooms table or were never migrated
 * to use venue_room_id. Phase 0 backfill cannot derive event_program_section_rooms
 * for these items because there's no FK to derive from. Phase 2 (room redesign)
 * will migrate or explicitly mark these as roomless and drive this baseline to 0.
 *
 * Baseline established 2026-05-05 from check_event_program_section_consistency_v1.
 * Any regression above this fails CI.
 *
 * TODO(Phase 2): drive SECTION_ROOMS_MISSING_BASELINE to 0 once room
 * redesign migrates legacy items into proper venue_rooms or marks them
 * as explicitly roomless. Tracked in project_program_editor_phase0_shipped.md.
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

const SECTION_ROOMS_MISSING_BASELINE = 64;

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

if (sectionsZeroRooms > SECTION_ROOMS_MISSING_BASELINE) {
  console.error(
    `\nFAIL: ${sectionsZeroRooms} sections have items but no row in ` +
    `event_program_section_rooms (baseline: ${SECTION_ROOMS_MISSING_BASELINE}). ` +
    `New regression introduced.`,
  );
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log(
  `\nOK: ${totalItems} program items, ` +
  `${sectionsZeroRooms} sections-without-rooms (baseline: ${SECTION_ROOMS_MISSING_BASELINE}). ` +
  `Contract holds.`,
);
process.exit(0);
