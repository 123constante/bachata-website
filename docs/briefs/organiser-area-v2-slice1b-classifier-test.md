# Brief: organiser area v2, slice 1b classifier test (continuation of PR #1511)

Brief-version: 2
Branch: claude/organiser-area-v2-chooser
Repo: Website
Lane: normal (one test file; no DB, no screen change).
Continuation of: dt_edecc8cb1675 (head c9088ce3). Same branch, push to it, update PR #1511 body only if needed.

## Goal
CI job `unit (Europe/London, full)` is red on #1511 because tests/chunkClassifier.test.ts "holds exactly the named modules" (line ~208) pins the lib-event-rules module list and the bundle round added src/modules/organiser/shell/paths.ts to it in vite.chunks.ts.

## What main lacks
- extends: the lib-event-rules module-list test does not include the pinned organiser shell paths module -- tests/chunkClassifier.test.ts

## Do
1. Read the failing test and vite.chunks.ts. Update the test's expected list/assertions to include shell/paths.ts (and any sibling still excluded must stay excluded: keep the "a sibling keeps rollup's chunking" intent). Do not change vite.chunks.ts unless the test shows the pin is wrong.
2. Run `npx vitest run tests/chunkClassifier.test.ts` green, then `npm run check:bundle-budget` still exits 0.
3. Run the other unit suites that touch vite.chunks.ts (grep tests/ for chunkClassifier / vite.chunks) and report counts.

## Files
tests/chunkClassifier.test.ts

## Done when
chunkClassifier test green; bundle-budget exit 0; last commit ends with [worker-done dt_<ticket>]. Not allowed: touching contract-check / event-truth baseline, DB, any screen file.
