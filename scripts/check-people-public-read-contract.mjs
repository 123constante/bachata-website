#!/usr/bin/env node
/**
 * CI contract check — people public-read guard (M3 Phase 0, 2026-07-18).
 * Calls public.check_people_public_read_contract_v1(), which asserts what the
 * people-backed public read surfaces actually RETURN: /teachers, /djs,
 * /all-profiles and site search.
 *
 * Why it exists: nothing watched these surfaces at all. That gap is how the M3
 * plan came to specify a change that would have deleted three teachers from the
 * live site. Phase A strips legacy COALESCE arms (COALESCE(avatar_url,
 * photo_url) -> avatar_url) from the public read RPCs and was described as
 * non-destructive. On the three teacher RPCs that COALESCE sits in the WHERE
 * clause, so it gates ROW MEMBERSHIP, not display: measured against prod,
 * get_public_teachers_list_v1 would have gone 34 rows -> 31. Three teachers
 * vanish from /teachers, their detail pages 404, the directory count drops and
 * their sitemap URLs orphan. Silently.
 *
 * Every existing guard would have stayed green:
 *   - check-search-public-v5.mjs probes search_public_v5 while production runs
 *     search_public_v4 (VITE_ENABLE_SEARCH_V5 is unset), and asserts SHAPE only:
 *     that the section keys exist and are arrays. It never asserts that any
 *     specific person comes back.
 *   - check_dancer_profiles_legacy_col_drift_v1 was wired into nothing, was
 *     already non-zero, and could not tell dp.x from drd.x, so it went red on
 *     correct work. (Superseded by _v2, admin migration 20260718130000.)
 *   - check:rpc-snapshots is an md5 of the body: red on ANY rewrite, correct or
 *     not.
 *   - No E2E spec covers /teachers, /djs, /dancers, /search or /all-profiles.
 *
 * Assertions (admin migration 20260718120000):
 *   1. SURVIVOR_VIOLATIONS   — no profile has a survivor column empty while its
 *      legacy column is populated. This is the precondition that makes a
 *      COALESCE strip a genuine no-op. Four rows violated it before the heal,
 *      because trg_sync_avatar_to_photo is BEFORE UPDATE only and never fires on
 *      INSERT.
 *   2. TEACHER_GATE_PARITY   — the teacher membership gate returns the same count
 *      with and without the legacy arm. Self-maintaining: no pinned count to rot
 *      as Ricky adds teachers.
 *   3. SIDECAR_COVERAGE      — no visible person has non-empty legacy dance-root
 *      data with a NULL dancing_role_details counterpart. Fires if a writer
 *      starts stranding data again.
 *   4. WRITER_NOT_ROLE_GATED — admin_save_person_v1 must not reacquire the
 *      role-gated sidecar DELETE. It used to delete a person's sidecar whenever
 *      the matching role was absent, while admin_get_person_v1 emitted that same
 *      sidecar from ROW EXISTENCE — so 70 of 111 rows were one round-trip save
 *      away from silent deletion. Fixed in admin migration 20260718110000.
 *   5. SEARCH_RECALL         — a person whose ONLY match route is favorite_styles
 *      must still come back from search_public_v4, the LIVE search path. The
 *      probe is self-discovering, so editing any one profile cannot make it
 *      spuriously red.
 *   6. VACUOUS_CHECK         — every assertion above passes on an empty set, so
 *      the RPC fails if a surface returns nothing or no search probe exists.
 *
 * All five failure modes were verified reachable: each bug was re-introduced
 * against prod inside a rolled-back transaction and this check went red naming
 * the right offender. Injection 1 reproduced the vanishing-teacher diagnosis
 * exactly ("1 teacher(s) are visible ONLY via the legacy photo_url arm").
 *
 * GATING: ok=true required. Any violation fails the build.
 *
 * Local:  node scripts/check-people-public-read-contract.mjs
 * CI:     same, env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { rpcWithRetry, exitTransient } from './lib/rpc-retry.mjs';

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

const supabase = createClient(url, key, { auth: { persistSession: false } });

let data;
try {
  data = await rpcWithRetry(supabase, 'check_people_public_read_contract_v1');
} catch (e) {
  exitTransient(e, 'people public-read contract');
  console.error('RPC failed:', e.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.ok !== true) {
  console.error(
    `\nPEOPLE PUBLIC-READ GUARD FAIL: a people surface is dropping rows it must ` +
    `return, or a writer is stranding profile data (see errors above). Each error ` +
    `names the check and the offending count. If teacher_gate_parity is red, do NOT ` +
    `strip any legacy COALESCE arm until the survivor columns are backfilled — the ` +
    `COALESCE on the teacher RPCs is in the WHERE clause and gates row membership. ` +
    `Health-check RPC: check_people_public_read_contract_v1 (admin migration ` +
    `20260718120000); the survivor heal is 20260718100000 and the writer fix is ` +
    `20260718110000.`,
  );
  process.exit(1);
}

const s = data.surfaces ?? {};
const a = data.assertions ?? {};
const r = data.reported_not_gated ?? {};

// The RPC is SECURITY INVOKER, so its public-surface probes reflect whichever role
// called it. In CI that must be anon -- if it is not, the counts are some other
// role's view and the run proves nothing about what the public sees. This is not
// hypothetical: run as postgres, all_profiles reads 277; as anon it reads 261,
// because RLS filters 16 rows. The previous SECURITY DEFINER version reported the
// 277 as though it were the public's view, which is the defect this replaced.
if (data.measured_as !== 'anon') {
  console.error(
    `\nPEOPLE PUBLIC-READ GUARD: refusing to pass -- measured as ` +
    `'${data.measured_as}', not 'anon'. The surface counts are that role's view, not ` +
    `the public's. Check that VITE_SUPABASE_PUBLISHABLE_KEY is the anon key.`,
  );
  process.exit(1);
}

console.log(
  `\nPeople public-read guard: ok as ${data.measured_as} (teachers ${s.teachers_list}, ` +
  `all-profiles ${s.all_profiles}, djs ${s.djs_list}; teacher gate ` +
  `${a.teacher_gate_with_legacy}/${a.teacher_gate_survivor_only} legacy/survivor, ` +
  `sidecar drift ${a.sidecar_drift_gating}, search probe "${a.search_probe_style}" found ` +
  `${a.search_probe_found}; reported-not-gated: ` +
  `${r.sidecar_absent_with_legacy_data} with legacy dance-root data and no sidecar row).`,
);
process.exit(0);
