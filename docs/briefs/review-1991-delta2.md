# Delta review PR #1991 (admin) at head 9de6d776112c7d8a1ca6a694cce51d98c3f64975

Hard-tier delta review (SQL, DB contract check). Branch of PR: claude/s5-check66-receipt-tables (repo 123constante/bachata-admin).
Round 1 (website PR #1776, docs/review/review-1991.md on branch claude/review-1991) said BLOCK: item 3, replay safety NOT PROVEN (the anchor might miss on a fresh replay). Items 1, 2, 4 passed on prod evidence.
Since then the head moved to 9de6d77: fixtures regenerated, header fixed, ledger allowlist added. All CI jobs were green at this head, including `prove` (read the run at this head, not an older one), `ledger-sync` and `rpc-body-snapshots`.

Do, in order:
1. Re-read the PR diff at 9de6d77 (migration 20261118120000_check66_receipt_tables_night_reminder_v1.sql, ledger-sync-allowlist.json, the rpc-body fixture). Confirm items 1, 2, 4 still hold.
2. Item 3: settle replay safety with evidence. Read the `prove` job log at this head: does it replay migrations from scratch through this file and pass? Confirm the function body at this file's replay position matches the anchor (the prior BLOCK feared it reads ARRAY['added_session_room_drop_v1']). If prove replayed this file green, name the log line that shows it. If it did not replay it (skipped, allowlisted, or exempt), say so and BLOCK.
3. Check the fixture matches the live body (read-only SELECT of pg_get_functiondef for check_occurrence_delete_booking_safety_v1).

Supabase is read-only for you. Do not edit the PR. Write docs/review/review-1991-delta2.md with `## Verdict` and `## Hard-tier: PASS` (or BLOCK), naming PR #1991 and the head SHA 9de6d77 you reviewed. Open a docs-only PR from your branch (website repo).
