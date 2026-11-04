# join-gaps-1 continuation (walk + F4 + PR body)

Branch `claude/fix-join-gaps-1` (head 8a319d6, Website PR #1305 already open). Read `docs/design/join-gaps-1/HANDOVER.md` and INVENTORY.md on that branch FIRST. Gaps 2-4 are built and tested. Do ONLY what is left:

1. Review r1 F4: after a successful bind, refetch the invite preview (bind succeeds, send fails on network/429, then a different email gets `already_bound`). Red-first test, then fix.
2. The 390x844 browser walk, reusing tests/e2e/walk-invite-recheck.spec.ts copied from branch claude/walk-invite-recheck-1 (mocked answers, its error-card guard). Cover: email step with and without hint; invite-only (hint; no hint + locked; typed = invited); blocked domain (hint, locked); About with the refusal notice; profile_stale; Home banner and gate sheet at 10, 6, 3, 0 rows; the welcome line. OPEN EVERY PICTURE yourself and write one line each in docs/walk/join-gaps-1/RESULTS.md (PASS / FAIL / CANNOT-TELL).
3. Run the CI steps not yet run (e2e smoke, phone-qa incl. the edited E1 spec, pre-ship) and put a per-job table in the PR body. PR body must have `- Shapes surveyed:`, `- Checks run:` and `- NOT verified:` each with text on the SAME line, and Phone QA naming 390x844.
No other scope. The admin-side bind fix is NOT yours (a separate admin brief). Last commit ends `[worker-done dt_<new ticket>]`, final push WITHOUT [skip preview].
