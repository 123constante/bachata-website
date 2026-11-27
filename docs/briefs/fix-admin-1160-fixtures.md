# Fix admin PR #1160 (branch claude/p3-create-admin-slice2): two red unit tests

Lane: careful. Model: Opus. Context cap 30%. Repo: 123constante/bachata-admin (NOT the Website). Max one fix round.

## Evidence (program lead 2026-10-31, CI job unit-build on head ccf6df967)
- tests/erAd2.db.test.ts: "item 2: committed fixtures carry this file's bodies (md5 of the definition round-trips)" FAILS.
- tests/erP4D42Duplicate.test.ts: "'check_owner_command_allowlist_v1': the predecessor + ONLY the listed swaps = pinned after md5 = the fixture" FAILS.
- Everything else in unit-build passes. "Migration version fresh" is also red on main (inherited, ignore).
- The PR title says version 20270309000000 but the file is supabase/migrations/20270309070000_p3_create_admin_slice2_owner_keys_v1.sql. Check that mismatch first.

## Do
1. Reproduce both failures locally (replay proof as the repo defines it). State which fixture is out of step with the migration file's function bodies: tests/fixtures/rpc-bodies/*.sql and tests/fixtures/frozen/*.p3-create-admin-slice2-before.sql.
2. Fix the root cause: regenerate or correct the fixture(s) from the migration's own bodies, or correct the migration if the fixture is right. Do NOT weaken or delete a test, and do NOT edit the frozen "before" fixtures unless they are provably wrong.
3. Add the pinned md5 for check_owner_command_allowlist_v1 in the place erP4D42Duplicate.test.ts expects, only if the migration really changes it.
4. Run the whole unit-build job steps locally (read .github/workflows). Supabase is READ-ONLY: no apply.
5. One commit, push, handover docs/handovers/p3-create-admin-slice2-fix-3.md with the per-job table and an honest Verified / Not verified. Keep the PR body bullets (Verified / Not verified) intact.
