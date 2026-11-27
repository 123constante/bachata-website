# Brief: review-1191-r1 (ADMIN, READ-ONLY REVIEW, Fable; builder was Opus). Branch claude/review-1191-r1 -> docs/review/1191-r1.md only.

Context line: stay under 35% of your context; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY (counts only, no personal data).

Review admin PR #1191 (branch claude/fix-guest-contract-soft-delete, head c03268a; handover docs/handover/guest-contract-soft-delete-v1.md). Files: supabase/migrations/99990101000000_guest_contract_soft_delete_not_erasure_v1.sql, tests/fixtures/rpc-bodies/check_guest_entries_contract_v1.sql.

Background: the Website contract-check has been red on main since 2026-11-02 (guest-entries step, erased_entry_identity_survives = 12). admin_soft_delete_raffle_entry_v1 sets status='erased' + deleted_at but keeps name/phone until the 91-day purge; check_guest_entries_contract_v1 conflated that with real erasure. Owner decision: keep removed entries, fix the CHECK.

Find CORRECTNESS bugs only, with file:line and a failing input:
1. Is the new check body still able to catch a REAL erasure that leaves identity (the thing it exists for)? Build mutants (drop the deleted_at distinction, widen it, invert it) and say which the fixture/test catches.
2. Does it return 0 for the 12 soft-deleted prod rows and still flag a true erased row with identity? Prove read-only on prod with counts.
3. Migration safety: CREATE OR REPLACE signature unchanged, grants/ACL preserved (explicit GRANT/REVOKE incl. service_role), placeholder version 99990101000000 follows the queue convention, replay-safe, no data write.
4. Fixture matches the migration body byte for byte in the compared part.
Deliverable docs/review/1191-r1.md: verdict PASS / PASS WITH NITS / BLOCK, findings ranked, honest Verified / Not verified. Commit subject ends [worker-done <ticket>].
