# Finish organiser Team PR 1583 (branch claude/profile-dash-organiser-team-build)
Lane: normal. Website repo. Code fix for the interim-add bug is already right (Add disabled while seat unknown). Do NOT redesign. Close these open items only:
1. Tests: src/**/teamDash.matrix.test.tsx ~117-122 mounts a solo owner and never queries `team-dash-add-manager-disabled`; add a row/shape that mounts the seat-unknown state and asserts the disabled control AND its reason copy.
2. teamDash.matrix.test ~187: `if (s.addVia)` silently skips rows where addVia is null. Replace with an explicit assertion for null rows (what control is absent / what copy shows) so no row is skipped.
3. teamDashModel.ts ~74: failed seat read copy still says "Checking your s..." forever; give it a final, actionable error state (what happened + Reload/Retry control).
4. Evidence: 390x844 walk shots for solo, full team, person sheet, add sheet, interim, no-page, contributor (fixtures ok, say so); attach to the PR. Add the per-job CI table, name the pre-ship stage, and refresh the PR body (it still says "Fix round 1"; head must describe the current head). Run both PR-body label checks.
Run npx tsc --noEmit, the touched tests, npm run check:mojibake. Push only claude/profile-dash-organiser-team-build; final commit subject ends `[worker-done <ticket>]`. Handover with Verified / Not verified.
