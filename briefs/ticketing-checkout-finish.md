# Brief: S4 finish (continuation on claude/ticketing-checkout, PR #1063)

The first worker stopped idle after its handover draft, with no done marker and a WIP PR body. Do NOT redo the build. Read docs/handover/ticketing-checkout.md and docs/ticketing-buyer-journey.md first.

Do exactly this:
1. Pull the branch, merge origin/main in (local git merge), run the tickets unit tests, `npm run lint`, `npx tsc --noEmit`, and every other CI job step that applies (read .github/workflows). Fix only what is red.
2. Round 2 review fixes are unreviewed (handover says so): re-read the round-2 diff (commit 71019a0) once for mistakes; fix real ones only.
3. Rewrite the PR #1063 body (use `gh pr edit 1063 --body-file`, bot token as other PRs do; if gh api/edit is not possible, put the exact body text in docs/handover/ticketing-checkout-pr-body.md and say so). Required sections with EXACT labels, each label followed directly by a colon:
   - `## Verified on real data` containing lines starting `**Shapes surveyed:**`, `**Checks run:**`, `**NOT verified:**`
   - `## Phone QA` containing `**Sizes checked:**`, `**Walked:**`, `**Not verified:**`
   - link to docs/design/<pr>.md design record (create docs/design/1063.md: brief, the layout chosen, 390x844 self-check results from the handover).
   - Title: drop "(WIP)". Add a per-job CI table.
   - List legalCopy.ts as DRAFT needing owner approval, and handover notes 1-3 as follow-ups.
4. Keep flag publicTicketing OFF. No edge-function, no supabase/** changes.
5. Final push: commit subject ends `[worker-done <ticket>]`, NOT `[skip preview]`. Handover updated with Done / Verified / Not verified.
