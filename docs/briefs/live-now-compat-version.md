# Brief: event_view_p5 snapshot_compat returns `version` (live-now slice 2 admin follow-up)

Repo: 123constante/bachata-admin. Branch: `claude/live-now-compat-version` from `main`. Careful lane (RPC), Opus, Brief-version 3. One migration.
No UI, so no INVENTORY.md; coverage = the shape table in the test below.
Evidence: Website PR #1275 handover, `git show origin/claude/live-now-s2web:docs/handovers/live-now-s2web.md` (repo 123constante/bachata-website). Option A there is the chosen route (lead decision 2026-11-05; the owner asked for fast, truthful event pages).

## What main lacks
`event_view_p5(jsonb, jsonb)` returns a top-level `version` (number, from `public._event_public_version_v1(...)`) only in its native-shape branches (migration 20270312410000, "additive, native shape only"). The Website calls it with `p_viewer = {role:'anon', shape:'snapshot_compat'}`; that branch returns `_event_view_snapshot_compat_v1(p_target)` plus `has_timed_session` and RETURNS before the version merge. On prod: 40 live series ids, 5 non-null compat payloads, 0 carry `version`; native payloads carry it.

## Do
1. ONE migration (placeholder version from `node scripts/next-migration-version.mjs`): in the `snapshot_compat` branch of `event_view_p5`, merge `jsonb_build_object('version', public._event_public_version_v1(<series id>, <occurrence id>))` into the result before its RETURN, using the target's own ids exactly as the native branch does. Additive: no existing key changes, no signature or ACL change. Read the LIVE body first (prod project `stsdtacfauprzrdebmzg`, read-only `pg_get_functiondef`) and base the edit on it, with the pre-state pin pattern this repo uses for body rewrites. Self-verify in the migration: a compat call for a live series returns a numeric `version` equal to the native call's.
2. Why only 5 of 40 live ids give a non-null compat payload is a separate question: do NOT fix it; write what you find (one paragraph, read-only) in the handover.
3. Test (`tests/liveNowCompatVersion.db.test.ts`): table over target shapes (occurrence id, series id, past-only series, cancelled, series with no occurrences, id that returns null) x (compat, native): compat adds `version` exactly when native does and with the same value; every other compat key is byte-identical to before (compare against the pre-change function body result via the replay base). Named mutant: drop the merge -> the test goes red.
4. Handover `docs/handover/live-now-compat-version.md`: what changed, the shape table, prod read-back counts after (counts only, no writes; the lead applies), what the Website brief `brief/live-now-s2web` needs to be re-dispatched.

## Rules
You cannot run docker: do not run `migration:prove --write` and do not edit `tests/fixtures/rpc-bodies/` (the fixture-regen workflow, or the lead on the Acer, does it after your push). Source files over 2 KB through the repo's safe-edit scripts. ONE push, no early checkpoint, never add `run-ci`, never merge or approve, Supabase is READ-ONLY. Last commit subject ends `[worker-done <ticket>]`.
