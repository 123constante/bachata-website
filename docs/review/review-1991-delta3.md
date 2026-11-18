# Delta review 3: admin PR #1991 (check #66 night reminder receipt tables)

- PR: `123constante/bachata-admin` #1991, branch `claude/s5-check66-receipt-tables`.
- Head reviewed: **`04d3f4f`** (`04d3f4ffce57369fb8034db016e0531a123d6639`).
- Round 2 (`docs/review/review-1991-delta2.md`, head 9de6d77) said BLOCK on item 3 (anchor absent on a version-sorted replay).
- Evidence: the PR tree and diff at 04d3f4f (read from a clone), GitHub Actions run metadata for this head, and read-only SELECTs on prod `stsdtacfauprzrdebmzg`. No writes; the PR was not edited.
- Reviewer: cloud worker, dispatch ticket dt_1e16f71ba1c3, 2026-11-18.

## Verdict

**The code is now replay-safe by static evidence, but I cannot sign it as proven yet.** The brief requires the `prove` log at this head, and that job was still `in_progress` when I finished (run 44268931335, job 134680338805, started 08:39:51Z; the log returned HTTP 404 while it ran). The earlier unlabelled run 44268824937 for the same SHA was `skipped`. By the brief's own rule, a skipped or absent `prove` is not proven. Flip to PASS once that job is green and its log shows the file applied (see "What flips this").

## Hard-tier: BLOCK

(Evidence pending, not a defect found. Items 1, 2, 3-static, 4 and 5 all pass. The only open point is the `prove` log.)

### 1. Delta since 9de6d77 is only the rename: PASS

`git diff -M 9de6d77 04d3f4f` shows 2 files changed, 2 lines each:

- `20261118120000_..._v1.sql` renamed to `20270323090000_check66_receipt_tables_night_reminder_v1.sql`, with 100% similarity apart from the last line: `mark_migration_complete('20270323090000_check66_receipt_tables_night_reminder_v1')`.
- `ledger-sync-allowlist.json`: the `reason` text of the `20261118071745` row now names the `20270323090000` file. Version and name fields are unchanged.

No SQL body change. Items 1, 2 and 5 of round 2 therefore still hold (same DO block, same anchor, `mark_migration_complete` string matches the new filename). Prod `check_occurrence_delete_booking_safety_v1()` returns `status: ok`, `cascade_children_unprobed: []`, `booking_helper_unprobed_tables: []`, `unruled_delete_paths: []`, and the prod md5 is unchanged from round 2 (see item 4).

### 2. Replay safety, static (item 3): PASS

Migrations that define `v_receipt_tables`, in version order (grep over the tree at 04d3f4f):

`20261104480000`, `20261106410000`, `20261106550000`, `20261107320000`, `20261107370000`, `20261107700000`, `20270314200000`, `20270322100000` (comment only), `20270323040000`, **`20270323090000` (this file)**.

Full `CREATE OR REPLACE` bodies, in order, and the array each sets:

| Version | Array |
|---|---|
| 20261104480000 ... 20261107700000 | `ARRAY['added_session_room_drop_v1']` |
| 20270314200000 | `ARRAY['added_session_room_drop_v1']` |
| 20270323040000 | `ARRAY['added_session_room_drop_v1', 'ticket_festival_day_check_ins']` |

`20270322100000` only anchor-patches the booking helper and, per its header, leaves `v_receipt_tables` alone. So the last `CREATE OR REPLACE` before `20270323090000` is `20270323040000` (line 51), which gives exactly the form the anchor needs: `ARRAY['added_session_room_drop_v1', ` (trailing comma and space). The patch matches, rewrites to the four-name array, and `EXECUTE`s it.

Nothing sorts after it: the highest version in the PR tree is `20270323090000` itself (the one before it is `20270323080000_organiser_night_reminders_v1.sql`, which does not define the function). `origin/main` of the admin repo at my clone time ends at `20270323080000`, so main has nothing past it either. No later file can overwrite the body and drop the two night-reminder names. This is also the same position `prove` applied the file in last round, so the position `prove` tests and the sorted-replay position are now the same.

Caveat: this holds for the main I read. A PR that lands on main first with a higher version AND a full `CREATE OR REPLACE` of this function would overwrite it. None exists in the tree I read.

### 3. `prove` log and replay jobs at this head: NOT YET PROVEN

- `Migration Proof` run 2279 (id 44268824937): `skipped`. Not evidence.
- `Migration Proof` run 2280 (id 44268931335), the one that ran after the `run-ci` re-trigger at 08:39:49Z: job `prove` `in_progress`, on step 6 `migration:prove (static, replay + self-verify, fixtures, tests)` since 08:40:20Z. Steps 1 to 5 succeeded. Log not downloadable until it completes.
- Other jobs at this head: `Migration placeholder gate` success, `Migration Header` success, `Bot auto-merge` success. `Migration Drift Check`, `Caller Census`, `Migration version fresh` and `Unit build` were queued or in progress.
- `check:replay` / nightly: `replay-drift.yml` runs weekly and on pushes to main that touch a migration, not on PRs, so there is no replay run at this head. Its last runs on main (646 at a5ba550, 644, 643, 642) are `failure`, so a main-side replay is not green evidence either way. I did not read why they fail; that is outside this PR and I did not check whether it relates to this function.

### 4. Fixture equals the live body: PASS

Read-only on prod: `md5(pg_get_functiondef('public.check_occurrence_delete_booking_safety_v1'::regproc))` = `ba5d736284b90380ac2b6d89dcbb9223`. The committed fixture `tests/fixtures/rpc-bodies/check_occurrence_delete_booking_safety_v1.sql` has md5 header `ba5d736284b90380ac2b6d89dcbb9223` (identical to round 2), and its line 41 array equals the live one:
`ARRAY['night_reminder_sent_log', 'night_reminder_settings_p5', 'added_session_room_drop_v1', 'ticket_festival_day_check_ins']`.

### 5. Ends with mark_migration_complete: PASS

Last statement: `SELECT public.mark_migration_complete('20270323090000_check66_receipt_tables_night_reminder_v1');`, matching the new filename.

## What flips this to PASS

The `prove` job of run 44268931335 completes green, and its log shows `[ok] applied 20270323090000_check66_receipt_tables_night_reminder_v1.sql (self-verify ran)` and `PROVEN:`, plus "committed fixture equals the replayed body (md5 ba5d7362...)". If it goes red, the log line names why. I would not expect an anchor miss, per item 2.

## Verified / Not verified

- Verified: the delta 9de6d77 to 04d3f4f; the version-ordered list of `v_receipt_tables` definers and their array literals; absence of any later definer; prod md5, live array and check #66 status; fixture md5 and line; the workflow run list and job status at this head.
- Not verified: the `prove` log (job still running, log unavailable); a local version-sorted replay (no local Supabase stack); why `replay-drift` on main fails; whether other open admin PRs add a higher-versioned full body of this function.
