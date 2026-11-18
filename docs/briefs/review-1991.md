# Review PR #1991 (admin): check #66 exempts night reminder receipt tables

Hard-tier review (SQL, DB contract check). Head: 2aa8f7657 on claude/s5-check66-receipt-tables. Already applied on prod (version 20261118120000); prod check_occurrence_delete_booking_safety_v1() returns status ok, cascade_children_unprobed = [].

Context: slice 5 (#1961) added night_reminder_sent_log and night_reminder_settings_p5 as ON DELETE CASCADE children of event_occurrence_p5. Check #66 ARM 2 flagged them. The migration is a DO block that patches the live function body: replace() prepends both tables to v_receipt_tables (same mechanism as added_session_room_drop_v1, 20261104480000). Live body had extra entries (ticket_festival_day_check_ins), hence the prefix anchor.

Check, in this order:
1. Exemption is right: neither table holds booking/attendance data; losing them with the night is correct. Neither belongs in v_booking_tables or the curated helper.
2. The patch touches nothing else: reread the DO block; the anchor raises when missing; idempotent; pg_get_functiondef round-trip keeps SECURITY DEFINER, STABLE, search_path, and grants (CREATE OR REPLACE keeps ACL; confirm with a read-only SELECT on pg_proc.proacl).
3. Replay safety: on a fresh replay the function exists before this file (version ordering) and the anchor matches the body at that point; if the anchor would not match on replay, say so. run-ci label is on: read the LABELED run at head; the `prove` job must have run and passed (skipped = not proven).
4. Ends with mark_migration_complete.

Supabase is read-only for you. Do not edit the PR. Write docs/review/review-1991.md with `## Verdict` and `## Hard-tier: PASS` (or BLOCK), naming PR #1991 and the head SHA you reviewed. Open a docs-only PR from branch claude/review-1991.
