# Pre-push unit gate flakes under load (bachata-admin#1572, rank 9001)
Class: GUARD-CI / PERF, normal lane, website repo, no migration.

Problem: the pre-push unit gate fails 2-4x per push under load on unrelated files
(JoinGetPaidNext, reviewScope, ogWholeFlyerCard); each passes alone. It sometimes prints
"unnamed files" instead of the failing test names.

Do: reproduce under load, find the timing or resource cause (test timeouts, shared tmp dirs,
worker count), fix the class in the gate or the flaky tests (raise the right timeout or reduce
pool concurrency), and make the gate always print the failing file names. Never skip the gate or
use --no-verify.

Acceptance contract: owner x pushes a branch from the laptop x the gate passes, or names a real
failing file; three consecutive runs under load pass; a forced failure names its file.

PR: Verified / Not verified block, per-job CI table.
