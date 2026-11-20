# Brief: pause reader loses the pause issue after 500 newer items

Class: GUARD-CI. Guard-class file, so the PR needs the owner's Approve at head. Do not merge or approve.

## Failure (verified 2026-11-20)
`scripts/lib/automation-pause.mjs` `findPauseIssue` reads the newest 500 issues and PRs (MAX_PAGES=5 x 100). The owner's `AUTOMATION PAUSE SWITCH` issue (website #1360, admin #1229) is now older than that window. `readPause` returns paused "pause issue missing", so `automation-pause-guard.yml` is red on main, and bot-automerge, autopilot and revert-on-red are all blocked on both repos. The file header already predicts this.

## Fix
Find the issue without a depth limit that grows with the number of PRs, and keep it fail closed:
- Use the Search API: `GET /search/issues?q=repo:<repo>+is:issue+in:title+"AUTOMATION PAUSE SWITCH"+author:<owner>` (issues only, so PRs cannot push it out). Keep the exact-title check and the owner-author check on each result. Keep the rule: not exactly one owner-created match, a closed issue, a read error, a non-array / no `labels` array, an incomplete_results flag = PAUSED.
- Do NOT list by label (a running switch has no label). Do not widen PAUSE_ISSUE_AUTHOR_BOTS. Do not create, edit, or relabel any issue.
- Update the file header comment and docs/automation-pause.md to say the window limit is gone.
- Tests (tests/automationPauseGuard.test.ts and neighbours): found when 2000 newer PRs exist; zero matches = paused; two = paused; foreign author ignored; incomplete_results = paused; read error = paused. Mutation check: reverting to the 5-page listing must turn a test red.
- Same fix in the other repo's copy of the file (separate brief/PR there). Keep the two copies identical in behaviour.

## Done
`npm run pre-ship` green (website) or the admin equivalent; PR body says "Verified on real data": run the reader read-only against the real repo with a token and paste `paused=false reason=` (the label is absent, the issue is open). One PR. Do not merge.
