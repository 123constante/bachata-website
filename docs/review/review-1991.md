# Review: admin PR #1991 — check #66 exempts night reminder receipt tables

- PR: `bachata-admin-11april` #1991, branch `claude/s5-check66-receipt-tables`
- Head reviewed: `2aa8f7657` (the head the brief names). **I could not open the
  admin repo.** `add_repo` said this session has no access to
  `123constante/bachata-admin-11april`. So I did not read the migration file, the
  diff or CI. What I reviewed is the SQL that prod's
  `supabase_migrations.schema_migrations` recorded for this migration, plus
  read-only catalog queries on prod (`stsdtacfauprzrdebmzg`). I made no writes.
- Reviewer: cloud worker, dispatch ticket dt_eb6587855803, 2026-11-18.

## Verdict

**Hard-tier: BLOCK.** This is about proof, not about whether the exemption is
right. Items 1, 2 and 4 pass on prod evidence. Item 3 (replay safety) is not
proven, and the anchor looks like it would fail on a fresh replay. Two things
clear it:

1. An owner (or a session with admin-repo access) confirms that the `prove` job ran
   and passed on the run-ci LABELED run at head `2aa8f7657`. A skipped run does not
   count.
2. Someone confirms the function body at the file's replay position, as set out
   under item 3.

If `prove` passed, item 3 is cleared and this flips to PASS with no code change.

## Hard-tier: BLOCK

### 1. Exemption is right — PASS

Prod columns:

- `night_reminder_sent_log`: `id, occurrence_p5_id, buyer_hash, order_id,
  claimed_at, sent_at`. This is a claim/sent idempotency log for reminder
  emails. It holds no booking or attendance fact; `order_id` points at the
  order, which lives in its own table. It holds 0 rows today.
- `night_reminder_settings_p5`: `occurrence_p5_id, reminder_enabled,
  updated_at, updated_by`. This is a per-night organiser toggle. It holds 0 rows
  today.

Both are `FOREIGN KEY (occurrence_p5_id) REFERENCES event_occurrence_p5(id) ON
DELETE CASCADE`. When the night is deleted there is nothing left to remind
anyone about, so losing both rows with it is correct. Neither belongs in
`v_booking_tables` (`event_attendance, event_guest_list_entries,
guest_list_check_ins_p5`) or in the curated helper. Prod
`check_occurrence_delete_booking_safety_v1()` returns `status: ok`,
`cascade_children_unprobed: []`, `booking_helper_unprobed_tables: []`.

### 2. The patch touches nothing else — PASS (on the recorded SQL)

I reread the recorded DO block:

- It reads `pg_get_functiondef` for `public.check_occurrence_delete_booking_safety_v1`
  and raises if the function is missing.
- It is idempotent: it returns early if the body already contains
  `night_reminder_sent_log`.
- It makes one `replace()` on the anchor
  `v_receipt_tables text[] := ARRAY['added_session_room_drop_v1', ` and raises
  `v_receipt_tables anchor not found in live body` if nothing changed.
- `EXECUTE` of the full functiondef is a `CREATE OR REPLACE`. It carries the
  attributes and keeps the ACL. Prod after the patch: `prosecdef = true`,
  `provolatile = s` (STABLE), `proconfig = {search_path=public, pg_catalog}`,
  `proacl = {postgres=X, anon=X, authenticated=X, service_role=X}`. I have no
  pre-patch ACL snapshot to diff against, but `CREATE OR REPLACE` cannot change
  `proacl`.
- The live array is now `ARRAY['night_reminder_sent_log', 'night_reminder_settings_p5',
  'added_session_room_drop_v1', 'ticket_festival_day_check_ins']`. Only the
  prefix changed.

### 3. Replay safety — NOT PROVEN (BLOCK)

- **The anchor needs a second array entry.** It ends in `', ` (a comma and a
  space after `'added_session_room_drop_v1'`), so it matches only when another
  element follows. On prod that element is `ticket_festival_day_check_ins`.
  Prod recorded the migration that added it as
  `20270323040000_check66_festival_day_check_ins_exempt_v1`, which sorts
  **after** this file's `20261118120000`. If the repo file uses that 2027
  version too, then on a fresh replay the body at this point still reads
  `ARRAY['added_session_room_drop_v1']`. The anchor misses, the DO block raises,
  and replay goes red. The brief's own words ("Live body had extra entries …
  hence the prefix anchor") point the same way: the anchor was written against
  the live body, not the replay body.
- **The tables are created later than this file.** Prod recorded
  `organiser_night_reminders_v1` (the slice-5 tables) as `20270323080000`, also
  after `20261118120000`. Exempting a table name before the table exists is
  harmless to the check. It does mean this file sits ahead of the change it
  responds to, and the replay order should match the intent.
- **CI evidence.** I could not read the run-ci LABELED run or the `prove` job
  (no admin-repo access). That counts as not proven.
- **Suggested fix if `prove` fails** (the author's call): anchor on
  `ARRAY['added_session_room_drop_v1'` with no trailing `, `. Alternatively,
  re-version the file after `20270323040000` / `20270323080000`.

### 4. Ends with mark_migration_complete — PASS

The last statement is
`SELECT public.mark_migration_complete('20261118120000_check66_receipt_tables_night_reminder_v1');`.
That writes a `MIGRATION_BOUNDARY` row to `ddl_audit_log`.

### Side note: the prod ledger version differs from the file version

The brief says prod applied this as version `20261118120000`. Prod's
`schema_migrations` has it as **`20261118071745`**
(`check66_receipt_tables_night_reminder_v1`). There is no `20261118120000` row.
The MCP apply stamped its own timestamp. If the admin repo's ledger-parity guard
compares file versions with prod versions, expect it to flag this. Rename the
file or reconcile the ledger.

## Verified / Not verified

- Verified (prod, read-only): the recorded migration SQL, the live function
  attributes and ACL, the live `v_receipt_tables` array, the check result
  (`ok`), the FK topology and columns of both tables, and their row counts (0).
- Not verified: the PR diff and file contents at `2aa8f7657`, the `prove` job and
  the run-ci labeled run, the function body at the replay position, and the
  pre-patch ACL.
