#!/usr/bin/env node
/**
 * CI integrity check for the teacher / DJ event-program assignment contract.
 *
 * Calls public.check_teacher_dj_assignment_integrity_v1() (P5 line-up credits,
 * admin migration 20260513070000 + later revisions) for the assigned and
 * unassigned counts of active teachers / DJs, and counts -- straight from
 * person_roles, anon-readable -- how many of those active roles were created
 * ON OR BEFORE the 2026-07-24 re-baseline (BASELINE_CUTOFF_UTC).
 *
 * WHAT IT GATES ON (since 2026-11-04). Not the unassigned TOTAL any more: that
 * grows every time a teacher or DJ joins the directory before their first
 * booking, and it needed a hand re-baseline commit each time (#339, #1337, ...).
 * It gates on the ASSIGNMENT DEFICIT:
 *
 *     deficit = (active roles created on/before the cutoff) - (assigned total)
 *             = (pre-baseline people with no assignment)
 *               - (post-baseline people WITH an assignment)
 *
 * The identity holds because unassigned = pre + post - assigned. Why not the
 * pre-baseline unassigned count itself? Anon cannot see per-person credits (the
 * P5 people tables are is_admin()-only and the RPC returns names to admins
 * only), so CI cannot split the unassigned count by person. The deficit is the
 * closest thing anon CAN compute, and it moves the right way:
 *   - a new person joins with no line-up    -> unchanged    (WARN, exit 0)
 *   - a new person joins WITH a line-up     -> falls        (exit 0)
 *   - anyone picks up a first line-up       -> falls        (exit 0)
 *   - a pre-baseline person loses their     -> rises by 1   (FAIL, exit 1)
 *     last assignment
 *   - a post-baseline person loses theirs   -> rises by 1   (FAIL, exit 1 --
 *                                              still a lost assignment)
 * Known gaps, said plainly:
 *   (a) SLACK ACCUMULATES. Every fall in the deficit (a first booking, an
 *       unassigned pre-baseline role deactivated) is headroom a LATER loss can
 *       hide in, because the baseline does not move on its own. The check
 *       prints a `RATCHET:` line naming the new value whenever a deficit is
 *       below its baseline -- lower the constant (dated note) when you see it.
 *       Until someone does, losses up to the slack exit 0.
 *   (b) an ASSIGNED post-baseline role being deactivated also raises it (false
 *       red, fixed by a dated re-baseline note below, as before).
 *   (c) the anon row count is trusted: if RLS ever hid person_roles rows from
 *       anon, the deficit would fall (green). Only an over-count is caught.
 *
 * Exit policy (0 pass / 1 contract violated / 2 could not check):
 *   - RPC missing on prod            -> exit 0 (warn; tolerates an un-pushed migration)
 *   - RPC or count call transient    -> exit 2 (could not verify)
 *   - any other RPC / count error    -> exit 2
 *   - malformed payload              -> exit 2
 *   - status = 'ok'                  -> exit 0 (pass)
 *   - both deficits <= baselines     -> exit 0 (WARN line + payload; growth is new people)
 *   - any deficit >  its baseline    -> exit 1 (FAIL -- see docs/ci-guard-notes.md #17)
 *
 * Local:  node scripts/check-teacher-dj-assignment-integrity.mjs   (reads .env)
 *         node scripts/check-teacher-dj-assignment-integrity.mjs --self-test
 * CI:     same script, env vars supplied as repo secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
 * Test:   node --test scripts/__tests__/check-teacher-dj-assignment-integrity.test.mjs
 *
 * See:
 *   admin repo migrations/20260513070000_check_teacher_dj_assignment_integrity_v1.sql
 *   .github/workflows/db-contract-check.yml
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { rpcWithRetry, isTransient } from './lib/rpc-retry.mjs';
import { isEntryPoint } from './lib/entry-point.mjs';

// HISTORY OF THE OLD UNASSIGNED-TOTAL CEILING (kept: the dated-note convention
// is how this guard's numbers have always been explained).
//
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
//
// 2026-09-15: DJ ceiling 6 -> 8. Measured live: 8 active DJs hold no
// event_program_people row. Five of them (Kal, Roberta, Anna Galenda, Brandy
// Colores, Sergio Suavez) have djing roles created 2026-08-14 through
// 2026-09-14, all strictly after the 2026-07-24 re-baseline -- the same
// "listed before first booking" pattern as every prior re-baseline. The
// three from the old baseline (Carbonero, Davids, Sobolewska) are still
// present and unmoved. Nothing dropped an assignment.
//
// 2026-10-02: re-baselined 36/8 -> 33/7 to the P5 reading. Since admin M5 Stage E
// step C7b the guard reads the P5 programme (event_series_program_people_p5 +
// event_occurrence_added_session_people_p5) instead of the frozen legacy
// event_program_people mirror. Measured live after the C7b apply: 33 teachers /
// 7 DJs unassigned (legacy read 36/7). The P5 line-up credits more people, so the
// ceiling falls; nothing gained or lost an assignment.
//
// 2026-10-24: DJ ceiling 7 -> 8 (owner call). Live read 33/8: one more active DJ with
// no P5 line-up credit -- ordinary roster growth, red on main too, not a lost assignment.
//
// 2026-11-03: DJ ceiling 8 -> 9. Live read 33/9 (contract-check run 41666265616,
// first visible once admin #1191 cleared the guest-entries step above it). The ninth
// is profile bebc8933: an existing teacher (profile 2026-09-26, teacher line-up credit
// 2026-10-16) whose djing role was created 2026-11-03 13:55 UTC, two hours before the
// red run, with no DJ credit ever -- the same "listed before first booking" pattern as
// 2026-07-24 / 2026-09-15 / 2026-10-24. The other eight are unmoved; nothing dropped an
// assignment. sample_profiles reads [] in CI because the RPC returns names only to
// is_admin() callers (admin 20261122240000, review R1 B1) and CI calls it as anon.
//
// 2026-11-04: ceilings 33/9 -> 34/10. Live read 34/10 (red on main too, run 41815691763). Assigned counts
// are unchanged (94 teachers, 33 DJs): one more teacher and one more DJ were listed with no line-up yet,
// ordinary roster growth, not a dropped assignment. Same pattern as the 2026-10-24 and 2026-11-03 bumps.
//
// 2026-11-04 (later the same day): the ceiling is RETIRED, replaced by the
// assignment deficit described in the header. The 2026-07-24 re-baseline date
// is the cutoff because every note since then splits the count there. Measured
// live, read-only, against prod the same day: teachers 128 active roles, 104
// created on/before 2026-07-24, 94 assigned, 34 unassigned (28 pre-baseline + 6
// post); DJs 43 active roles, 29 pre-baseline, 33 assigned, 10 unassigned (2
// pre + 8 post). Deficits: teachers 104 - 94 = 10, DJs 29 - 33 = -4. The DJ
// figure is negative because more post-baseline DJs hold a booking (6) than
// pre-baseline DJs lack one (2); it is still a ceiling that rises by exactly 1
// per lost assignment. The 6 + 8 people who joined after the cutoff with no
// line-up are the growth that used to red this check; they now WARN.
//
// Re-baseline only with a dated note here saying who lost what, and why that
// is not a regression. Never raise a deficit to make a red run green.
export const BASELINE_CUTOFF_UTC = '2026-07-25T00:00:00Z'; // created_at < this = "on or before 2026-07-24"
export const BASELINE_TEACHERS_DEFICIT = 10; // pre-baseline teacher roles - assigned teachers
export const BASELINE_DJS_DEFICIT = -4;      // pre-baseline DJ roles - assigned DJs

const RPC = 'check_teacher_dj_assignment_integrity_v1';
const num = (v) => (Number.isFinite(v) ? v : NaN);

/**
 * Pure verdict. `payload` is the RPC result; `pre` is
 * { teachers, djs } -- active roles created before BASELINE_CUTOFF_UTC.
 * Returns { exit, level, message }.
 */
export function judge(payload, pre, baselines = {
  teachers: BASELINE_TEACHERS_DEFICIT,
  djs: BASELINE_DJS_DEFICIT,
}) {
  const tu = num(payload?.active_teachers_unassigned);
  const du = num(payload?.active_djs_unassigned);
  const ta = num(payload?.active_teachers_assigned);
  const da = num(payload?.active_djs_assigned);
  const tp = num(pre?.teachers);
  const dp = num(pre?.djs);
  if ([tu, du, ta, da, tp, dp].some((n) => !Number.isFinite(n))) {
    return { exit: 2, level: 'error', message: 'FAIL: contract RPC or pre-baseline count returned a malformed payload.' };
  }
  // A pre-baseline count above the active total means the two reads disagree
  // about what "active" means -- the deficit would be meaningless.
  if (tp > ta + tu || dp > da + du) {
    return {
      exit: 2,
      level: 'error',
      message: `FAIL: pre-baseline role count (${tp}/${dp}) exceeds the RPC's active total ` +
        `(${ta + tu}/${da + du}); the two reads disagree, cannot judge.`,
    };
  }
  if (payload.status === 'ok') {
    return {
      exit: 0,
      level: 'log',
      message: `OK: every active teacher (${ta}) and DJ (${da}) holds a P5 line-up credit in matching capacity.`,
    };
  }
  const td = tp - ta;
  const dd = dp - da;
  const split =
    `${tu} teacher / ${du} DJ unassigned; ` +
    'deficit (roles created on/before 2026-07-24 - assigned): ' +
    `teachers ${tp}-${ta}=${td} (baseline ${baselines.teachers}), ` +
    `DJs ${dp}-${da}=${dd} (baseline ${baselines.djs})`;
  if (td > baselines.teachers || dd > baselines.djs) {
    return {
      exit: 1,
      level: 'error',
      message: `FAIL: ${split}. A deficit rose: someone lost their last line-up credit ` +
        '(or an assigned role was deactivated) -- see docs/ci-guard-notes.md #17.',
    };
  }
  const slack = [];
  if (td < baselines.teachers) slack.push(`BASELINE_TEACHERS_DEFICIT ${baselines.teachers} -> ${td}`);
  if (dd < baselines.djs) slack.push(`BASELINE_DJS_DEFICIT ${baselines.djs} -> ${dd}`);
  const ratchet = slack.length
    ? ` RATCHET: lower ${slack.join(', ')} (dated note) -- until then a later lost assignment can hide in the slack.`
    : '';
  return {
    exit: 0,
    level: 'warn',
    message: `WARN: ${split}. No lost assignment; unassigned people beyond the ` +
      `deficit joined after the cutoff with no line-up yet (roster growth).${ratchet}`,
  };
}

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

function makeDeps() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) return { missingCreds: true };
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  // head:true + count:'exact' -- a server-side count, so the 100-row API cap
  // never truncates it. Same "active" predicate as the RPC.
  const countPre = async (role) => {
    const { count, error } = await sb
      .from('person_roles')
      .select('person_id', { count: 'exact', head: true })
      .eq('role', role)
      .or('is_active.is.null,is_active.eq.true')
      .lt('created_at', BASELINE_CUTOFF_UTC);
    if (error) throw error;
    return count;
  };
  return { callRpc: () => rpcWithRetry(sb, RPC), countPre };
}

function isUndeployed(e) {
  const msg = e?.message || '';
  const code = e?.code || '';
  return (
    /check_teacher_dj_assignment_integrity_v1/i.test(msg) &&
    (/does not exist/i.test(msg) || /Could not find the function/i.test(msg) || code === 'PGRST202' || code === '42883')
  );
}

/** Exit owner. Collaborators are injected so the self-test drives it offline. */
export async function main(argv = [], deps = {}) {
  const { out = console.log, warn = console.warn, err = console.error } = deps;
  const unknown = argv.filter((a) => a !== '--self-test');
  if (unknown.length) {
    err(`Unknown flag(s): ${unknown.join(', ')}. Known: --self-test`);
    return 2;
  }
  if (argv.includes('--self-test')) return (await selfTest()) ? 0 : 1;

  const { callRpc, countPre, missingCreds } = deps.callRpc ? deps : makeDeps();
  if (missingCreds) {
    err('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
    return 2;
  }

  let data;
  try {
    data = await callRpc();
  } catch (e) {
    const cause = e?.cause ?? e;
    if (e?.transient ?? isTransient(cause)) {
      err(`teacher/DJ assignment integrity: ${e?.message ?? e}. Transient infrastructure failure, not a contract violation -- exiting 2.`);
      return 2;
    }
    if (isUndeployed(cause)) {
      warn(`WARN: ${RPC} is not yet deployed to this project. Soft-pass until the admin migration ships.`);
      return 0;
    }
    err('RPC failed:', cause?.message || String(e));
    return 2;
  }
  out(JSON.stringify(data, null, 2));

  let pre;
  try {
    pre = { teachers: await countPre('teaching'), djs: await countPre('djing') };
  } catch (e) {
    err(`person_roles pre-baseline count failed: ${e?.message ?? e} -- exiting 2 (could not check).`);
    return 2;
  }

  const v = judge(data, pre);
  ({ log: out, warn, error: err })[v.level]('\n' + v.message);
  return v.exit;
}

// ---------------------------------------------------------------------------
// Canary. Every case drives main() with fake collaborators and pins WHICH
// branch produced the code (by message), not just the code.
// Live shape 2026-11-04: teachers 94 assigned / 34 unassigned, 104 pre-cutoff;
// DJs 33 / 10, 29 pre-cutoff.
const LIVE = {
  status: 'drift',
  active_teachers_assigned: 94,
  active_teachers_unassigned: 34,
  active_djs_assigned: 33,
  active_djs_unassigned: 10,
  sample_profiles: [],
};
const LIVE_PRE = { teachers: 104, djs: 29 };

export const SELF_TEST_CASES = [
  { name: 'live 2026-11-04 shape is green (WARN)', payload: LIVE, pre: LIVE_PRE, exit: 0, re: /^WARN: 34 teacher \/ 10 DJ/ },
  {
    name: 'new teacher after cutoff, no line-up: unassigned 34->35, stays green',
    payload: { ...LIVE, active_teachers_unassigned: 35 }, pre: LIVE_PRE, exit: 0, re: /^WARN: 35 teacher/,
  },
  {
    name: 'new DJ after cutoff, no line-up: unassigned 10->11, stays green',
    payload: { ...LIVE, active_djs_unassigned: 11 }, pre: LIVE_PRE, exit: 0, re: /^WARN: .*11 DJ/,
  },
  {
    name: 'MUTANT pre-baseline teacher loses last line-up (assigned 94->93, unassigned 34->35): red',
    payload: { ...LIVE, active_teachers_assigned: 93, active_teachers_unassigned: 35 }, pre: LIVE_PRE, exit: 1, re: /^FAIL: .*teachers 104-93=11/,
  },
  {
    name: 'MUTANT pre-baseline DJ loses last line-up (assigned 33->32): red',
    payload: { ...LIVE, active_djs_assigned: 32, active_djs_unassigned: 11 }, pre: LIVE_PRE, exit: 1, re: /^FAIL: .*DJs 29-32=-3/,
  },
  {
    name: 'a pre-baseline teacher picks up a first line-up: deficit falls, green',
    payload: { ...LIVE, active_teachers_assigned: 95, active_teachers_unassigned: 33 }, pre: LIVE_PRE, exit: 0,
    re: /^WARN: 33 teacher.*RATCHET: lower BASELINE_TEACHERS_DEFICIT 10 -> 9/,
  },
  {
    name: "status 'ok' passes",
    payload: { ...LIVE, status: 'ok', active_teachers_assigned: 128, active_teachers_unassigned: 0, active_djs_assigned: 43, active_djs_unassigned: 0 }, pre: LIVE_PRE, exit: 0, re: /^OK: every active teacher/,
  },
  { name: 'malformed payload is exit 2', payload: { status: 'drift' }, pre: LIVE_PRE, exit: 2, re: /malformed payload/ },
  { name: 'reads that disagree are exit 2', payload: LIVE, pre: { teachers: 200, djs: 29 }, exit: 2, re: /two reads disagree/ },
  { name: 'transient RPC failure is exit 2', rpcThrows: Object.assign(new Error('timeout'), { transient: true }), exit: 2, re: /Transient infrastructure failure/ },
  { name: 'undeployed RPC soft-passes (exit 0)', rpcThrows: { code: 'PGRST202', message: `Could not find the function public.${RPC}` }, exit: 0, re: /not yet deployed/ },
  { name: 'other RPC error is exit 2', rpcThrows: { code: '42501', message: 'permission denied' }, exit: 2, re: /^RPC failed/ },
  { name: 'pre-baseline count error is exit 2', payload: LIVE, countThrows: { message: 'boom' }, exit: 2, re: /pre-baseline count failed/ },
  { name: 'missing creds is exit 2', missingCreds: true, exit: 2, re: /Missing VITE_SUPABASE_URL/ },
];

export async function runCase(c) {
  const lines = [];
  const sink = (...a) => lines.push(a.join(' ').trim());
  const deps = {
    out: sink,
    warn: sink,
    err: sink,
    missingCreds: c.missingCreds,
    callRpc: async () => {
      if (c.rpcThrows) throw c.rpcThrows;
      return c.payload;
    },
    countPre: async (role) => {
      if (c.countThrows) throw c.countThrows;
      return role === 'teaching' ? c.pre.teachers : c.pre.djs;
    },
  };
  const exit = await main([], deps);
  return { exit, lines };
}

export async function selfTest() {
  let failed = 0;
  for (const c of SELF_TEST_CASES) {
    const { exit, lines } = await runCase(c);
    const ok = exit === c.exit && lines.some((l) => c.re.test(l));
    if (!ok) {
      failed += 1;
      console.error(`  FAIL ${c.name}: exit ${exit} (want ${c.exit}); output: ${lines.join(' | ')}`);
    } else {
      console.log(`  ok   ${c.name}`);
    }
  }
  if (failed) {
    console.error(`FAIL self-test -- ${failed} of ${SELF_TEST_CASES.length} case(s).`);
    return false;
  }
  console.log(`PASS self-test -- ${SELF_TEST_CASES.length} cases.`);
  return true;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
