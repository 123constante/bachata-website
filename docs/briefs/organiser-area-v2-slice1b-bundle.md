# Brief: organiser area v2, slice 1b BUNDLE round (continuation of PR #1511)

Brief-version: 2
Branch: claude/organiser-area-v2-chooser
Repo: Website
Lane: normal (no DB change, no new rule; build config only).
Continuation of: worker dt_b97900bd0d32 (PR #1511, head eb5a01750, PARTIAL). Work on the SAME branch, push to it, update PR #1511's body. Read first: docs/handover/organiser-area-v2-slice1b-fix.md on the branch (section "OPEN: bundle-budget is RED").

## Goal
Make `check:bundle-budget` green on PR #1511 without losing any slice 1b fix, so the PR can merge.

## What main lacks
Continuation of an open PR: checked on the PR branch, not on main.
- extends: first-load chunk count auth is 26 vs budget 25 and dancer-app 48 vs 47 -- perf-budgets.json
- extends: `assets/paths-*.js` (organiser shell/paths.ts ORG_PATHS) is an extra first-load chunk on auth -- vite.chunks.ts

## Do (in order, stop at the first that turns bundle-budget green)
1. Revert EditInPlaceLayer.tsx and edit-in-place/teamRoles.ts together to origin/main versions WITHOUT git stash, build, count chunks. Record the numbers. If this fixes it, find the smallest way to keep the flag-pair fix (fix 2 of the handover) without the extra chunk.
2. Otherwise pin ORG_PATHS (src/modules/organiser/shell/paths.ts) into an existing first-load chunk group in vite.chunks.ts, the way listImpressions was pinned. Rebuild, show auth <= 25 and dancer-app <= 47.
3. Only if both fail: raise the allowance in perf-budgets.json by the smallest amount, with the measured before/after in the PR body and the commit message.
4. contract-check red (course c7008ab6, NULL course_total_sessions, event-truth-baseline) is DATA and also red on main: do NOT touch it or the baseline.

## Files
vite.chunks.ts
perf-budgets.json
src/modules/organiser/edit-in-place/EditInPlaceLayer.tsx
src/modules/organiser/edit-in-place/teamRoles.ts
src/modules/organiser/shared/teamModel.ts

## Done when
`npm run check:bundle-budget` exits 0 on the final head; the slice 1b tests (p3Roles, chooser.matrix, accountRouting.eventDay) still green; tsc 0 errors in touched files; last commit ends with [worker-done dt_<ticket>]. Not allowed: DB change, any change to the five slice 1b behaviours, touching the event-truth baseline.
