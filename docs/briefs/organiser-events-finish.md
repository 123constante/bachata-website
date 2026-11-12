# Finish PR 1584 (organiser Events tab) on claude/profile-dash-organiser-events-build
Head 421f95e9f was FIX in review. Fix only these, then produce evidence. Branch only.
Code:
1. Bulk cancel refreshes only event+home lists (DashEvents.tsx:50); refresh the same set Pick.tsx:88-94 refreshes.
2. Version conflict has no reload step (DashEvents.tsx:46): add a Reload action that refetches and clears the conflict.
3. Cancel list is built from a 100-date workspace read (DashEvents.tsx:92): read all dates for the event (page or targeted query), not the first 100.
CI (also fix, from the earlier unit run): consistency.matrix.test.tsx B-N8 (7 raw Unicode punctuation chars in non-test source: use \u escapes or entities); JoinGetPaidNext.test.tsx "Done goes to /account/p3/get-paid?o=o1" (compare with origin/main; restore main behaviour unless the test is stale).
Evidence: 390x844 walk screenshots of Events tab (normal, empty, huge, error, conflict) committed under docs/design/profile-dash/shots/; per-job CI table in the PR body; refresh the PR body head and pre-ship stage. Run tsc and mojibake check. Final commit subject ends `[worker-done <ticket>]`.
