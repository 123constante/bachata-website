# people-find-before-create-website continuation 1 (fix review findings)

Branch `claude/people-find-before-create-website` (PR #1466, head 5094caa0). Lane normal, Opus (save/claim path). Start by merging `origin/main` into the branch, keep both sides. FIRST read `docs/handover-people-find-before-create-web.md` on the branch. Do ONLY what is left.

## What is left (review findings, owner focus: organisers' own tools)
1. Reload after a fix leaves the person stuck: the "unmatched" stop survives a reload in the same tab, but after the organiser's admin joins them (or the claim now succeeds) a reload must re-run the claim and drop the stop. Red-first test: stored stop + claim now `linked` -> stop cleared, normal flow continues.
2. `email_unproven` on a person-bound invite never records `not_linked`, so the inviter is not told. Person-bound + email_unproven must take the same safety redeem as ambiguous (no new RPC, no migration). Add the table rows.
3. The reload test is weak (it only checks the stop text appears). Make it assert nothing was created, chosen or redeemed on reload (no claim/redeem command sent from an untouched page).
4. Fix the red `pr-mergeable-guard` by merging main (conflict). Gates: `npm run lint`, join + admin-organisers unit tests, `check:bundle-budget` (0 bytes to /app first load; never edit perf-budgets.json or vite.config.ts), `check:integrity`.
5. Keep the PR body sections `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` and `## Phone QA` (390x844); update the Checks run line.
Push once; never add run-ci. Last commit ends `[worker-done <ticket>]`. Stop at 50% context with a handover.
