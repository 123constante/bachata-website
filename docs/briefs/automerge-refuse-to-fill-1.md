# BRIEF: automerge-refuse-to-fill-1 (Website; careful lane; Opus; hard-tier file)

Brief-version: 2

Layer 3 (PR #1323) review finding F1: `scripts/automerge-classify.mjs` only asks the real-data parser for `ok`, so a docs/tests-only bot PR whose body still holds `TO FILL` lines (real-data or Phone QA) can qualify for bot auto-merge. Cosmetic harm, but the stub must never merge unfilled.

## What main lacks
- extends: `classify()` returns qualifies=false with a named problem when the body still carries the pending marker (the same MARKER the two checkers export; read it from the checkers, do not type the string) in the real-data section OR the Phone QA section -- scripts/automerge-classify.mjs
- extends: tests: table of bodies (filled, real-data pending, phone-qa pending, both pending, docs-only with Phone QA pending, no Phone QA section) x qualifies, red first on main -- tests/automergeClassify.test.ts

## Files
- scripts/automerge-classify.mjs
- tests/automergeClassify.test.ts
- docs/handover/automerge-refuse-to-fill-1.md

## What to build
1. Red first: add the cells, run on main, keep the red output in the handover.
2. One small change in `classify()`; reuse the checkers' exports; the file's fail-closed rules stay (unreadable parser = no).
3. Docs-only workers may delete the empty Phone QA section; do not make that a refusal.
4. Run: `npm run lint`, `vitest run tests/automergeClassify.test.ts tests/realDataVerified.test.ts tests/phoneQaSection.test.ts`, the file's `--self-test` if it has one, `npm run check:mojibake`, `npm run check:integrity`.
5. PR body: real-data lines (shapes = the body table) and a bare `## Phone QA` heading with "no UI path changed". Hard-tier: the owner Approves at head.
6. Push once; last commit subject ends `[worker-done <ticket>]`.
