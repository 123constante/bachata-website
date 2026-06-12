#!/usr/bin/env node
/**
 * CI integrity check for the teacher / DJ event-program assignment contract.
 *
 * Calls public.check_teacher_dj_assignment_integrity_v1() and reports how
 * many active teachers / active DJs (per person_roles) are NOT linked to
 * any event_program_people row in their matching capacity (profile_type or
 * role).
 *
 * STATUS (today): the admin migration
 *   bachata-admin-11april/supabase/migrations/
 *     20260513070000_check_teacher_dj_assignment_integrity_v1.sql
 * is LOCAL-ONLY. Prod does NOT yet have the RPC, and Website attendance
 * readers have not migrated to canonical-person joins. Until both ship:
 *   - missing RPC on prod        → soft-pass (exit 0, warn)
 *   - baselines null below       → soft-pass on any drift (exit 0, warn)
 *
 * Once the admin migration is pushed AND Website readers cut over, bump
 * BASELINE_TEACHERS_UNASSIGNED / BASELINE_DJS_UNASSIGNED to the values
 * captured by the migration's RAISE NOTICE baseline log to enable hard
 * fails on regression.
 *
 * Exit policy:
 *   • RPC missing on prod        → exit 0 (warn)
 *   • status = 'ok'              → exit 0 (pass)
 *   • baselines unset (null)     → exit 0 (warn, print payload)
 *   • both counts ≤ baselines    → exit 0 (warn, no regression)
 *   • any count >  baseline      → exit 1 (fail; new drift)
 *
 * Local:  node scripts/check-teacher-dj-assignment-integrity.mjs   (reads .env)
 * CI:     same script, env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See:
 *   admin repo migrations/20260513070000_check_teacher_dj_assignment_integrity_v1.sql
 *   .github/workflows/db-contract-check.yml
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Locked to prod snapshot 2026-06-12. Increase if roles are intentionally expanded;
// never decrease without investigating why new unassigned rows appeared.
//
// 2026-06-12: bumped teacher floor 21 -> 35. A roster of 14 teacher COUPLES
// ("Ronald & Alba", "Dario & Sara", …) was bulk-imported at 12:21 UTC as
// display_name-only dancer_profiles (first_name/surname NULL, slug unclaimed-*)
// with an active teaching role but no event lineup yet — a legitimate directory
// expansion, not a dropped-assignment regression (20 of the unassigned predate
// the import and are stable vs the old baseline). DJ floor unchanged: unassigned
// DJs actually fell to 4 (<= 5), so the existing ceiling still holds.
const BASELINE_TEACHERS_UNASSIGNED = 35; // active teachers with no epp row
const BASELINE_DJS_UNASSIGNED = 5;       // active DJs with no epp row

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

const { data, error } = await sb.rpc('check_teacher_dj_assignment_integrity_v1');

if (error) {
  // Tolerate the function not yet being on prod (admin migration is local-only).
  const msg = error.message || '';
  const code = error.code || '';
  if (
    /check_teacher_dj_assignment_integrity_v1/i.test(msg) &&
    (/does not exist/i.test(msg) || /Could not find the function/i.test(msg) || code === 'PGRST202' || code === '42883')
  ) {
    console.warn(
      'WARN: check_teacher_dj_assignment_integrity_v1 is not yet deployed to this project. ' +
      'Soft-pass until the admin migration ships.',
    );
    process.exit(0);
  }
  console.error('RPC failed:', msg);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

const tu = Number.isFinite(data?.active_teachers_unassigned) ? data.active_teachers_unassigned : NaN;
const du = Number.isFinite(data?.active_djs_unassigned)      ? data.active_djs_unassigned      : NaN;
const ta = Number.isFinite(data?.active_teachers_assigned)   ? data.active_teachers_assigned   : NaN;
const da = Number.isFinite(data?.active_djs_assigned)        ? data.active_djs_assigned        : NaN;

if (!Number.isFinite(tu) || !Number.isFinite(du) || !Number.isFinite(ta) || !Number.isFinite(da)) {
  console.error('\nFAIL: contract RPC returned malformed payload.');
  process.exit(2);
}

if (data.status === 'ok') {
  console.log(
    `\nOK: every active teacher (${ta}) and DJ (${da}) is assigned to at least ` +
    `one event_program_people row in matching capacity. Contract holds.`,
  );
  process.exit(0);
}


if (tu <= BASELINE_TEACHERS_UNASSIGNED && du <= BASELINE_DJS_UNASSIGNED) {
  console.warn(
    `\nWARN: ${tu} teacher / ${du} DJ unassigned ` +
    `(baseline: ${BASELINE_TEACHERS_UNASSIGNED}/${BASELINE_DJS_UNASSIGNED}). ` +
    `No regression. Sample profiles above for review.`,
  );
  process.exit(0);
}

console.error(
  `\nFAIL: ${tu} teacher / ${du} DJ unassigned ` +
  `(baseline: ${BASELINE_TEACHERS_UNASSIGNED}/${BASELINE_DJS_UNASSIGNED}). ` +
  `New drift introduced — investigate the sample profiles above.`,
);
process.exit(1);
