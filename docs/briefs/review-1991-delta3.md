# Delta review 3: admin PR #1991 at head 04d3f4ffce57369fb8034db016e0531a123d6639

Hard-tier delta review (SQL, DB contract check). PR branch: claude/s5-check66-receipt-tables (repo 123constante/bachata-admin).
Round 2 (docs/review/review-1991-delta2.md on website branch claude/review-1991-delta2) said BLOCK on item 3: at the old version 20261118120000 the anchor `ARRAY['added_session_room_drop_v1', ` is absent on a version-sorted replay (base body is the one-element array).
Fix since then (head 04d3f4f): the migration is re-versioned to `20270323090000_check66_receipt_tables_night_reminder_v1.sql` (sorts after 20270323080000_organiser_night_reminders_v1.sql), its mark_migration_complete string and the ledger-sync-allowlist.json row were renamed to match. No SQL body change.

Do, in order:
1. Re-read the PR diff at 04d3f4f. Confirm only the rename and the two string/row updates changed since 9de6d77, and items 1, 2, 4, 5 from round 2 still hold (prod md5 of check_occurrence_delete_booking_safety_v1 unchanged).
2. Item 3: settle replay safety with evidence. List the migrations that define `v_receipt_tables` in version order and show that the last CREATE OR REPLACE before 20270323090000 leaves the array as `ARRAY['added_session_room_drop_v1', 'ticket_festival_day_check_ins']` (the form the anchor needs), and that no migration sorting after 20270323090000 overwrites the function body and drops the two night-reminder names. Read the `prove` job log of the run labelled `run-ci` at this head (a skipped or absent prove = not proven): name the log lines showing the file applied at its sorted position, or that it applied last. Check any `check:replay` / nightly replay job at this head too.
3. Confirm the fixture still equals the live body (read-only SELECT of pg_get_functiondef md5).

Supabase is read-only for you. Do not edit the PR. Write docs/review/review-1991-delta3.md with `## Verdict` and `## Hard-tier: PASS` (or BLOCK), naming PR #1991 and the head SHA 04d3f4f you reviewed. Open a docs-only PR from your branch (website repo).
