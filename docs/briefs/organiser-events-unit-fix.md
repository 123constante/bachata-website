# Fix unit failures on claude/profile-dash-organiser-events-build (PR 1584)
Only touch what failing tests need. Branch only.
Failing (CI job "unit (Europe/London, full)"):
- src/modules/organiser/__tests__/consistency.matrix.test.tsx: 7 raw Unicode punctuation chars in non-test module source outside comments; replace with \u escapes or HTML entities (B-N8).
- src/modules/admin-organisers/join/__tests__/JoinGetPaidNext.test.tsx "Done goes to /account/p3/get-paid?o=o1": the Done target differs (an /invite/... path). Compare with origin/main behaviour; restore main behaviour unless the test is stale because of an intended change, then update the test.
Also e2e-smoke was still pending; check it. Run tsc and mojibake check; refresh the PR body head; end with commit subject `[worker-done <ticket>]`.
