# Brief: continuation -- PR #1419 conflicts with main; resolve and push once

Brief-version: 1. Repo: Website. Branch: claude/team-add-confirm (SAME branch, PR #1419 exists). Lane: normal, Sonnet. No database change.

## What is left
- PR #1419 (confirm sheet before Add someone makes a Manager) is DIRTY: main moved after #1411 (claim sheet) and #1412 (Team screens name the page) merged. Your work is on the branch at 79a8191.
- Do: `git fetch origin main`, merge origin/main into the branch (merge, not rebase), resolve conflicts keeping BOTH sides (main's page-name changes in src/modules/organiser/team/ AddSomeone.tsx, Team.tsx and their tests must survive; your confirm sheet must still open on tap and show the page name from #1412 where it helps).
- Re-run: `npx vitest run src/modules/organiser/team src/modules/organiser/p3` and any test importing AddSomeone; every one must pass; `npx tsc --noEmit -p .` 0 errors in touched files; `npm run check:mojibake`.
- Update the PR body if a count changed. Push ONCE.

## Files
src/modules/organiser/team/AddSomeone.tsx, src/modules/organiser/team/AddConfirm.tsx, their tests, docs/design/team-add-confirm.md.

## Out of scope
No new behaviour, no change to who may add, no database call, no other screens.
Hand-off: Verified / Not verified block; end the final commit subject with the done marker from your ticket.
