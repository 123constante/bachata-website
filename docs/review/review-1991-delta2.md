# Delta review 2: admin PR #1991 (check #66 night reminder receipt tables)

- PR: `123constante/bachata-admin` #1991, branch `claude/s5-check66-receipt-tables`.
- Head reviewed: **`9de6d77`** (`9de6d776112c7d8a1ca6a694cce51d98c3f64975`).
- Round 1: website PR #1776 (`docs/review/review-1991.md`) said BLOCK on item 3,
  replay safety not proven.
- Evidence this round: the PR diff at 9de6d77, the admin repo tree at 9de6d77, the
  `prove` job log at this head (run 44261884509, job 134656939349, which checked out
  merge commit `fe99e917` = 9de6d77 into main `a5ba5506`), and read-only SELECTs on
  prod `stsdtacfauprzrdebmzg`. I made no writes and did not edit the PR.
- Reviewer: cloud worker, dispatch ticket dt_78ca1aedbd74, 2026-11-18. This review: website PR #1777.

## Verdict

**Hard-tier: BLOCK.** Items 1, 2 and 4 still pass, and the fixture matches prod.
Item 3 is now settled, and it fails. `prove` went green, but it never ran this file at
its replay position. On a fresh, version-sorted replay the anchor misses and the
DO block raises.

## Hard-tier: BLOCK

### 1. The exemption is right: PASS (unchanged)

The migration file is unchanged in substance from round 1. Prod still returns
`check_occurrence_delete_booking_safety_v1()` = `status: ok`,
`cascade_children_unprobed: []`, `booking_helper_unprobed_tables: []`.

### 2. The patch touches nothing else: PASS

The file at 9de6d77 is the same DO block that round 1 read from prod's recorded SQL:
it reads `pg_get_functiondef`, returns early if the body already contains
`night_reminder_sent_log`, makes one `replace()` on the anchor, raises if nothing
changed, and `EXECUTE`s the result. The other two files in the diff are bookkeeping:

- `ledger-sync-allowlist.json` adds one row: version `20261118071745`
  (the MCP apply stamp) maps to the file `20261118120000_...`. This resolves the
  ledger side note from round 1. `ledger-sync` is green.
- `tests/fixtures/rpc-bodies/check_occurrence_delete_booking_safety_v1.sql` changes
  only the md5/date header and the one `v_receipt_tables` line.

Prod attributes are unchanged: `prosecdef = true`, STABLE,
`search_path=public, pg_catalog`, and ACL
`{postgres=X, anon=X, authenticated=X, service_role=X}`.

### 3. Replay safety: BLOCK (proven to fail)

**What `prove` actually did.** The log shows that `prove` holds the PR's files back,
replays everything else, and applies the PR's files last:

```
07:49:37.2785552Z > migration:prove vs origin/main: 1 migration file(s) added or modified
07:49:37.2786844Z     20261118120000_check66_receipt_tables_night_reminder_v1.sql
07:49:39.0974438Z > replaying the base (every migration except the files above) into the LOCAL stack...
...
07:52:56.2251776Z Applying migration 20270323040000_check66_festival_day_check_ins_exempt_v1.sql...
07:52:56.8513196Z Applying migration 20270323080000_organiser_night_reminders_v1.sql...
...
07:52:57.1724287Z ! restored 20261118120000_check66_receipt_tables_night_reminder_v1.sql
07:52:58.4486387Z [ok] applied 20261118120000_check66_receipt_tables_night_reminder_v1.sql (self-verify ran)
07:53:01.8755688Z PROVEN: static, apply + self-verify on the replayed base, fixtures, tests.
```

So the file ran **after** `20270323040000`, which had already made the array
`ARRAY['added_session_room_drop_v1', 'ticket_festival_day_check_ins']`. That is the
only reason the anchor `ARRAY['added_session_room_drop_v1', ` (with a trailing comma
and space) matched. `prove` proved the patch applies on top of the full base. It did
**not** replay the file at its sorted position `20261118120000`.

**The body at the replay position.** At 9de6d77 these migrations define
`v_receipt_tables`, in order: `20261104480000`, `20261106410000`, `20261106550000`,
`20261107320000`, `20261107370000`, `20261107700000` | **`20261118120000` (this
file)** | `20270314200000`, `20270322100000` (a comment only), `20270323040000`.
The last `CREATE OR REPLACE` of the function before this file is `20261107700000`
(`20261107720000` names it only in a comment). The `prove` log shows that
`20261107700000` is replayed and not excluded (log line 971). Its body reads:

```
v_receipt_tables text[] := ARRAY['added_session_room_drop_v1'];
```

A string check on that file: the anchor is absent and the one-element form is present.
On a fresh replay in version order, `replace()` therefore changes nothing and the file
raises `v_receipt_tables anchor not found in live body`. No replay exclusion or
run-after entry names `20261118120000`: the only non-migration file that mentions it
is `ledger-sync-allowlist.json`. So this is exactly what round 1 feared.

**Consequence after merge.** Once the file is on main, it belongs to every later PR's
replay base. `prove` then fails with exit 3, "the base did not replay (a pre-existing
check:replay break, not this PR's files)", on unrelated PRs.

**Second problem in the same spot.** The tables this file exempts are created by
`20270323080000_organiser_night_reminders_v1.sql`, which sorts after this file.
Exempting a name before its table exists is harmless to the check. It is still a sign
that the file is versioned ahead of the change it answers.

**Fix (the author's call; either one clears this).**

1. Re-version the file to sort after `20270323080000` (for example
   `20270323090000_check66_receipt_tables_night_reminder_v1.sql`) and update the
   ledger allowlist row's file name. The anchor then matches on replay, just as it
   did in `prove`.
2. Or make the anchor work on both bodies: anchor on
   `ARRAY[''added_session_room_drop_v1''` with no trailing `, `. The replacement
   then becomes `ARRAY[''night_reminder_sent_log'', ''night_reminder_settings_p5'',
   ''added_session_room_drop_v1''`. This alone is not enough, though:
   `20270314200000` and `20270323040000` are full `CREATE OR REPLACE` bodies that
   would later overwrite the exemption on replay, so the final replayed body would
   lose the two night-reminder names and the fixture or check #66 would go red.
   Option 1 is the clean one.

After the fix, the proof needed is a full version-sorted replay through the new
position (for example `check:replay`), not only `prove`'s apply-on-top.

### 4. Fixture matches the live body: PASS

Read-only on prod:
`md5(pg_get_functiondef('public.check_occurrence_delete_booking_safety_v1'))` =
`ba5d736284b90380ac2b6d89dcbb9223`. That equals the committed fixture's md5 header,
and the `prove` log agrees: "committed fixture equals the replayed body (md5
ba5d736284b90380ac2b6d89dcbb9223)". The live array is
`ARRAY['night_reminder_sent_log', 'night_reminder_settings_p5', 'added_session_room_drop_v1', 'ticket_festival_day_check_ins']`.

### 5. Ends with mark_migration_complete: PASS

The last statement is
`SELECT public.mark_migration_complete('20261118120000_check66_receipt_tables_night_reminder_v1');`.
If the file is re-versioned (fix 1), this string must change to match.

## Verified / Not verified

- Verified: the PR diff and the tree at 9de6d77; the `prove` job log at this head
  (merge `fe99e917`); the migration order and the `v_receipt_tables` body at the
  replay position (from the repo files); the prod function's md5, attributes, ACL and
  live array; and prod check #66 = `ok`.
- Not verified: I did not run a fresh version-sorted replay myself (no local Supabase
  stack). The miss rests on a string check of the governing body plus the
  `replace()` semantics. I did not read the `check:replay` / nightly replay job, if
  one exists, at this head.
