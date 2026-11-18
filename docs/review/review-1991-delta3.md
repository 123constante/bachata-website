# Delta review 3: admin PR #1991 (check #66 night reminder receipt tables)

- PR: `123constante/bachata-admin` #1991, branch `claude/s5-check66-receipt-tables`.
- Head reviewed: **`04d3f4f`** (`04d3f4ffce57369fb8034db016e0531a123d6639`).
- Round 2 (`docs/review/review-1991-delta2.md`, head 9de6d77) said BLOCK on item 3 (anchor absent on a version-sorted replay).
- Evidence: the PR tree and diff at 04d3f4f (read from a clone), GitHub Actions run metadata for this head, and read-only SELECTs on prod `stsdtacfauprzrdebmzg`. No writes; the PR was not edited.
- Reviewer: cloud worker, dispatch ticket dt_1e16f71ba1c3, 2026-11-18.

## Verdict

**Hard-tier: PASS** for PR #1991 at head 04d3f4f. The re-version to `20270323090000` fixes the round 2 BLOCK. Static evidence shows the anchor matches at the sorted position, and the `prove` job at this head is green and applied the file there. (This doc first went out as BLOCK while `prove` was still running; the job finished green at 08:43:52Z and this revision records its log.)

## Hard-tier: PASS

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

### 3. `prove` log and replay jobs at this head: PASS

- `Migration Proof` run 2279 (id 44268824937): `skipped`, not evidence.
- `Migration Proof` run 2280 (id 44268931335, the `run-ci` re-trigger), job `prove` (134680338805): **completed, success** at 08:43:52Z. Log lines:

```
08:40:21 > migration:prove vs origin/main: 1 migration file(s) added or modified
08:40:21     20270323090000_check66_receipt_tables_night_reminder_v1.sql
08:40:23 > replaying the base (every migration except the files above) into the LOCAL stack...
08:43:43 Applying migration 20270323080000_organiser_night_reminders_v1.sql...
08:43:43 ! restored 20270323090000_check66_receipt_tables_night_reminder_v1.sql
08:43:44 [ok] applied 20270323090000_check66_receipt_tables_night_reminder_v1.sql (self-verify ran)
08:43:45 ok    check_occurrence_delete_booking_safety_v1: committed fixture equals the replayed body (md5 ba5d736284b90380ac2b6d89dcbb9223)
08:43:47 PROVEN: static, apply + self-verify, fixtures, tests.
```

  The base replay ends at `20270323080000`, then the file applies last. That is also its sorted position now, so `prove` exercises the same order a full version-sorted replay would. `prove` replays every other file in version order, with some parked files restored later by its own mechanism; that is `prove`'s design, not a change from round 2.
- Other jobs at this head: `Migration placeholder gate`, `Migration Header` and `Bot auto-merge` success. I did not re-read `Migration Drift Check`, `Caller Census`, `Migration version fresh` or `Unit build` after they were queued.
- `check:replay` / nightly: `replay-drift.yml` runs weekly and on pushes to main that touch a migration, not on PRs, so no replay run exists at this head. Its latest runs on main (642 to 646) are `failure`; I did not read why, and it is not caused by this PR (the head is not on main).

### 4. Fixture equals the live body: PASS

Read-only on prod: `md5(pg_get_functiondef('public.check_occurrence_delete_booking_safety_v1'::regproc))` = `ba5d736284b90380ac2b6d89dcbb9223`. The committed fixture `tests/fixtures/rpc-bodies/check_occurrence_delete_booking_safety_v1.sql` has md5 header `ba5d736284b90380ac2b6d89dcbb9223` (identical to round 2), and its line 41 array equals the live one:
`ARRAY['night_reminder_sent_log', 'night_reminder_settings_p5', 'added_session_room_drop_v1', 'ticket_festival_day_check_ins']`.

### 5. Ends with mark_migration_complete: PASS

Last statement: `SELECT public.mark_migration_complete('20270323090000_check66_receipt_tables_night_reminder_v1');`, matching the new filename.

## Verified / Not verified

- Verified: the `prove` job log lines above; the delta 9de6d77 to 04d3f4f; the version-ordered list of `v_receipt_tables` definers and their array literals; absence of any later definer; prod md5, live array and check #66 status; fixture md5 and line; the workflow run list and job status at this head.
- Not verified: the final state of `Migration Drift Check`, `Caller Census`, `Migration version fresh`, `Unit build`; a local version-sorted replay (no local Supabase stack); why `replay-drift` on main fails; whether other open admin PRs add a higher-versioned full body of this function.
