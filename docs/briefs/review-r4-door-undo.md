# Review: Website PR #1804 (R4 door Undo), hard tier (writes: undoes a check-in)

Review PR #1804 (branch feat/organiser-r4-door-undo) at its current head. Read-only: change nothing, push only your review doc. Contract: admin RPC ticket_undo_check_in_v1(uuid,uuid,uuid) (admin PR #2007 body, docs/briefs/organiser-r4-backend-handover.md on admin main).

Check, with file:line evidence:
1. Undo calls ticket_undo_check_in_v1 with the right three args; no direct table write (scripts/onboarding-write-doors.json entry matches the real call site).
2. Every RPC result value/error is handled; failure never shows a false "undone"; UI state updates only on success.
3. Undo visible/usable only to people who may scan; no client-side widening of permissions.
4. Double tap / race: one undo per tap, button disabled in flight, no double count.
5. Behind organiserR4 (flag off keeps old behaviour); tests cover the above; e2e spec registered in check-e2e-spec-coverage.mjs.

Write docs/review/review-pr-1804.md on your branch with these EXACT headings on their own lines: `## Verdict: PASS` (or PASS WITH NITS / BLOCK), `## Hard-tier: PASS` (or FAIL with reason), and a line `head <full sha reviewed>`.
