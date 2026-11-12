# Team build fix round 2 (PR #1583, branch claude/profile-dash-organiser-team-build)
Normal lane, Sonnet, no migration, no new RPC. Continue on the existing branch (git fetch, check it out). Independent re-review of head c107d1ee = FIX. This is the LAST fix round. Push once, end the last commit subject with the worker-done signal from your ticket.

## Fix list
1. HIGH, teamDashModel.ts:143-144 with TeamDashRoute.tsx:40: useSeatKind returns null while its ownership query is pending or failed, so isInterim(null) is false and addVia becomes 'sheet'. An interim manager who taps Add early gets the Add sheet and its "Find a dancer" link hits interim_cannot_add. Fix: while the seat kind is unknown, keep Add disabled with a stated reason (aria-describedby); add a SHAPES row (seat pending, seat read failed) and assert no sheet opens.
2. LOW, TeamDashView.tsx:76: add data-testid to the disabled group "Add a manager" button and use it in the tests.
3. EVIDENCE (the reviewer found none): run `npm run pre-ship` (say exactly which stage fails and whether it also fails on main; if it exceeds the sandbox say so), take the 390x844 walk with preview-deploy.mjs on the side laptop with screenshots on the PR (solo, full team, person sheet, add sheet, interim, no-page, contributor view-only), put the per-job CI table in the PR body after every job finishes, keep the exact Verified on real data / Phone QA labels. Run /code-review on the diff before the push; findings become edits.
4. Update the handover.

## Done = fixed, every CI job green (or red proved also red on main), walk shots on the PR.
