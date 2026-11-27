# check66-date-move-notices-admin (admin repo, MIGRATE, careful lane; Opus builds, Fable reviews). Make main's "occurrence delete/booking safety" check green again after date_move_notices_v1.

Brief-version: 1
Lane: admin, careful. Model: Opus. Branch: `claude/check66-date-move-notices`.
Why now: since admin #1223 was applied (2026-11-04 19:23Z) the Website DB Contract Check step "occurrence delete/booking safety" is RED on main, because the new table `public.date_move_notices_v1` has a CASCADE foreign key to `event_occurrence_p5(id)` and the check RPC reports it under `cascade_children_unprobed`. Every Website PR now shows this red.

## What main lacks
- `check_occurrence_delete_booking_safety_v1` (latest definition in supabase/migrations/20261104390000_fix_occurrence_delete_booking_safety_occurrence_id_dropped_v1.sql, ARM 2 around lines 430-460) lists every table with an ON DELETE CASCADE FK to the occurrence tables, minus the two booking tables and minus every table named in `_occurrence_is_curated_v1`. `date_move_notices_v1` is in neither, so the arm is non-empty and the whole check is violation. -- extends: supabase/migrations/20261104390000_fix_occurrence_delete_booking_safety_occurrence_id_dropped_v1.sql
- No test pins that a service-role-only notice outbox is a deliberate, reasoned exemption (not a forgotten curation table). -- extends: tests/myTicketOrderQrDb.test.ts

## Decision the worker must make and record (do not guess; read both functions)
The outbox rows are emails to send after a date move (service_role only, no person-facing edit). Choose ONE and justify in the handover:
(a) classify the table as a reasoned exempt "notice outbox" in the RPC (a new small `v_notice_tables text[]` excluded like the booking tables, with a comment), keeping ARM 2 strict for every other table; or
(b) add it to `_occurrence_is_curated_v1` as a curation skip (only if a queued, unsent notice should stop a sweep deleting that occurrence).
Prefer (a) unless reading the sweeps shows a queued notice must protect the occurrence. The change must NOT loosen ARM 2 for any other table: add a test that a made-up new CASCADE child still reds the arm.

## Files
- NEW migration `supabase/migrations/<version above 20270314190000>_check66_date_move_notices_exempt_v1.sql` (CREATE OR REPLACE the function copied from the latest definition, one narrow change; end with the `mark_migration_complete` call the neighbours use; run `scripts/assign-migration-versions.mjs` if the version collides)
- NEW test `tests/check66DateMoveNotices.test.ts` (static + replay as the neighbours do)
- `docs/handover/check66-date-move-notices.md`
Nothing else. No Website file. Do not touch #1226 or any workflow.

## Proof required
Replay proof (`npm run check:replay` as the neighbours), a read-only prod SELECT showing the RPC's `cascade_children_unprobed` is `["date_move_notices_v1"]` today (counts/names only), tests red then green, all admin CI jobs run locally. The orchestrator applies the migration through the admin queue after review; the worker does not.

## Done when
PR open (bot), tests green, handover says which option and why, Not verified lists "RPC result on prod after apply".
