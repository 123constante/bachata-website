# Brief: fix gateRetry.matrix.test.tsx flake (F-13, P1 owner unfinished page | gate on | details)

Lane: normal (test-only unless a real bug is found). Branch: fix/gateretry-matrix-flake. Website repo.

Problem: `src/modules/organiser/p3/screens/__tests__/gateRetry.matrix.test.tsx` fails in `unit (Europe/London, full)` on PR #1541 with
`AssertionError: expected { screen: 'details', ... } to be null` (row "P1 owner, unfinished page | gate on | details", ~line 188), on two attempts.
The same test passed on PR #1542 and #1541 does not touch gate or screens code. The failure is likely order or timing dependent in the full run.

Do:
1. Reproduce with the full unit run order (not the file alone). Find why the row sees a screen where it expects null (shared state, a timer, a mock leaking between rows, retry timing).
2. If it is a real product bug, stop and report it in the handover (do not change gate behaviour). If it is a test isolation bug, fix the isolation, with a red-first proof.
3. Add a check that would have caught it (the class: leaked state between matrix rows).
4. PR with the per-job CI table. Do not merge. Money, prices, refunds: untouched.

Done marker: commit subject ending `[worker-done gateretry-flake]`.
