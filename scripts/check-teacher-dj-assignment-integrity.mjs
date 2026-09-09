#!/usr/bin/env node
/**
 * CI integrity check for the teacher / DJ event-program assignment contract.
 *
 * Calls public.check_teacher_dj_assignment_integrity_v1() and reports how
 * many active teachers / active DJs (per person_roles) are NOT linked to
 * any event_program_people row in their matching capacity (profile_type or
 * role).
 *
 * STATUS: the RPC is live on prod (migration
 *   bachata-admin-11april/supabase/migrations/
 *     20260513070000_check_teacher_dj_assignment_integrity_v1.sql)
 * and this check GATES on a hand-maintained ceiling
 * (BASELINE_TEACHERS_UNASSIGNED / BASELINE_DJS_UNASSIGNED, currently 36/6).
 * The ceiling is a known-imperfect proxy for "nobody lost an assignment" --
 * it counts a TOTAL that grows on ordinary roster growth too, so it needs an
 * occasional re-baseline commit (#339, 2026-09-04, 32->36). The correct
 * replacement (a lost-assignment predicate, not a ceiling) is queued but not
 * built -- docs/ci-guard-notes.md #17,
 * ~/.claude/plans/queued-teacher-dj-lost-assignment-detector.md.
 *
 * Exit policy:
 *   • RPC missing on prod        → exit 0 (warn; tolerates an un-pushed migration)
 *   • RPC call transient (57014) → exit 0 (warn; a cold-instance timeout is
 *                                   infra noise, not a contract violation)
 *   • status = 'ok'              → exit 0 (pass)
 *   • baselines unset (null)     → exit 0 (warn, print payload)
 *   • both counts ≤ baselines    → exit 0 (warn, no regression)
 *   • any count >  baseline      → exit 1 (FAIL -- see docs/ci-guard-notes.md #17)
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
import { rpcWithRetry, exitTransient } from './lib/rpc-retry.mjs';

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
//
// 2026-07-24: re-baselined BOTH ceilings to the measured live counts, 35/5 ->
// 32/6. Teachers FELL 35 -> 32 (three of the 2026-06-12 couples have since
// picked up a lineup), so leaving the ceiling at 35 would have let three
// genuine regressions land unnoticed -- a ratchet that only ever loosens stops
// guarding anything. DJs rose 5 -> 6: six active DJs hold no
// event_program_people row (Richards, Carbonero, Davids, Sobolewska, Somos,
// Quinonez). That is ordinary roster churn -- a DJ is listed in the directory
// before their first booking -- not a dropped assignment.
//
// 2026-09-04: teacher ceiling 32 -> 36. Measured live the same day: 36 active
// teachers hold no event_program_people row, and EXACTLY 32 of them carry a
// teaching role created on or before the 2026-07-24 re-baseline. The four
// above it were all created after it -- "York & Lisa" (23 Aug), Gabriel Bravo
// and Mauricio Reyes (27 Aug), Sarah "La Morena" (31 Aug) -- so this is the
// same directory expansion the two notes above describe: a teacher listed
// before their first lineup. Nothing was DROPPED; a dropped assignment would
// have had to be masked by a pre-baseline profile picking one up in the same
// window, and the pre-baseline count is unmoved at 32.
//
// DJ ceiling unchanged at 6. It read 7 for the whole 2026-08-27 -> 2026-09-03
// red streak and fell back to 6 on 2026-09-03 when one DJ picked up a lineup:
// drift moving DOWN on unchanged code is what roster churn looks like, and it
// is why this ceiling is not raised to the streak's high-water mark.
const BASELINE_TEACHERS_UNASSIGNED = 36; // active teachers with no epp row
const BASELINE_DJS_UNASSIGNED = 6;       // active DJs with no epp row

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

let data;
try {
  data = await rpcWithRetry(sb, 'check_teacher_dj_assignment_integrity_v1');
} catch (e) {
  // A cold-instance timeout is "could not verify", not "no drift" -- exit 2,
  // never exit 0, now that this check gates on real drift below. Matches
  // check-slug-column.mjs's convention: exitTransient no-ops on a
  // NON-transient cause and falls through to the classification below.
  exitTransient(e, 'teacher/DJ assignment integrity');
  // Tolerate the function not yet being on prod (admin migration is local-only).
  const error = e.cause ?? e;
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

// GATING RESTORED 2026-09-09. A "GATING SUSPENDED" block sat here briefly --
// it was written 2026-09-02 against pre-#339 main (baseline 32/6, ceiling
// reding on ordinary roster growth) and never merged on its original branch
// (PR #330, closed unmerged). #339 (ef2487f, 2026-09-04) fixed the real
// problem on main instead -- re-baselined to 36/6 AND kept real gating
// (process.exit(1) below) -- and queued-teacher-dj-lost-assignment-detector.md
// (2026-09-07) explicitly struck the "report-only" framing as false, verified
// three ways against main at the time. When this file's transient-retry
// branch (PR #402) was revived and merged 2026-09-09, it silently replayed
// the stale 2026-09-02 patch on top of current main, re-suspending a gate
// #339 had already restored five days earlier -- caught in review of an
// UNRELATED diff (the honest-claims P7 guard), not by this branch's own
// review, which instead reinforced it. See docs/ci-guard-notes.md #17.
//
// The underlying ceiling-on-a-growing-total problem this was trying to solve
// is real and still open -- ~/.claude/plans/queued-teacher-dj-lost-assignment-
// detector.md carries the actual fix (a lost-assignment predicate, not a
// ceiling). Until that lands, a ceiling that gates is still the better of two
// imperfect options: it reds on ordinary growth (a false positive, fixed by a
// re-baseline commit), where an ungated check that LOOKS gated silently stops
// catching a real dropped assignment (a false negative, fixed by nothing).
console.error(
  `\nFAIL: ${tu} teacher / ${du} DJ unassigned ` +
  `(baseline: ${BASELINE_TEACHERS_UNASSIGNED}/${BASELINE_DJS_UNASSIGNED}). ` +
  `New drift introduced -- investigate the sample profiles above.`,
);
process.exit(1);
