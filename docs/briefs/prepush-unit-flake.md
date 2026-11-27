# Brief: pre-push unit gate flakes under load (queue-website#1572)
Lane: normal, Website repo, no DB. Smallest fix, one PR.
Problem: the pre-push unit gate fails on JoinGetPaidNext, reviewScope and ogWholeFlyerCard tests under load, yet they pass alone.
Do: reproduce with `npx vitest run` at default parallelism vs one file; find the cause (timeouts, shared module state, network/fs, worker count). Fix the cause in the tests or the gate config (e.g. per-test timeout, isolate, cap gate threads), not by skipping tests. Do not weaken any assertion.
Acceptance: owner pushes a branch x pre-push unit gate passes or names a real failure, never a load-flaky unrelated file. Show 3 consecutive full gate runs green under artificial load (run two vitest processes at once).
Deliver: PR with a Verified / Not verified block; list changed files; note if any hard-tier path (scripts/, .husky) is touched.
