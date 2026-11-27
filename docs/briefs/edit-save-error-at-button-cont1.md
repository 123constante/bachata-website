# Brief: edit-save-error-at-button continuation 1 (Website, normal, CI fix only)

Brief-version: 2
Repo: website (123constante/bachata-website). Branch: claude/edit-save-error-at-button (PR #1423). Lane: normal, Sonnet. No behaviour change.

## What main lacks
- CI job `dancer-area-isolation` is red on PR #1423: rule (a) says a changed file must be inside src/modules/dancer-app/, a test or a seam, and the branch also changes two docs files outside it: docs/briefs/edit-save-error-at-button.INVENTORY.md and docs/tickets/dt_a4cff4b1cf4b-handover.md (log: `dancer-area isolation: 2 violation(s)`). -- docs/tickets/dt_a4cff4b1cf4b-handover.md

## Files
Delete exactly those two docs files from the branch (`git rm`). Keep the EditScreen.tsx change and saveErrorAtButton.test.tsx. If you must keep the handover, put it under src/modules/dancer-app/ as a .md only if `node scripts/check-dancer-area-isolation.mjs` (run locally against origin/main) then exits 0.

## What to build
1. `git rm` the two files; run `node scripts/check-dancer-area-isolation.mjs`: it must report 0 violations.
2. Run the 9 tests in src/modules/dancer-app/screens/edit/__tests__/saveErrorAtButton.test.tsx.
3. Push once. Commit subject ends with the done marker. Say in the PR body Verified/Not verified.

## Out of scope
Any code change.
