# Handover: walk-ios-static-scan (slice 10, Part C, contract 11 item 5b)

Branch `claude/walk-ios-static-scan`, off origin/main 670dc90. PR #1449.
HARD-TIER: the owner approves at head; the worker never approves or merges.

## Done
- `scripts/lib/walk-ios-static.mjs` -- `scanIosClasses(files)` (pure, never
  throws, fail-closed), `splitCssRules`, `meetsRubric` (reads RUBRIC from
  walk-judge.mjs), `main` (`--dir`, exit 0 / 1 / 2). Emits `iosInputFontSize`,
  `iosNoRawVh`, `iosFixedBarsSafeArea` + `findings[]`.
- `tests/walkIosStatic.test.ts` -- 68 table-driven tests; red first; four
  mutants killed (dvh fallback, safe-area, `>=` on 16, no-input default 16).
- Added to TARGETS in `scripts/prove-entry-point-dispatch.mjs`.
- One line in `docs/automation/judge-worker.md` (Parts left): exists, not wired.
- /code-review one round (low): placeholder selectors counted as field size;
  `em` converted at a fixed root. Both fixed, rows added, rows red on the old code.

## Checks
- vitest walkIosStatic + walkJudge: 260/260. check-script-conventions: pass.
  prove-entry-point-dispatch: pass (77). check:mojibake: clean. lint chain: all
  PASS (whole-tree eslint informational, red on main).
- tsc run on the head carrying this file: 0 errors in branch files (0 in the
  whole project).
- test:unit: 15 failures in 8 files, identical on origin/main in this sandbox
  (missing `qrcode-generator` in sandbox node_modules; live contract tests).

## Not verified
- Not run against the real built site (`dist/`); only against `src/` (today:
  font 12, raw vh 36, fixed-without-safe-area 64 -- informational).
- Remote PR check results not read by the worker.

## Next steps (not this PR)
- Wire into the lane / judge (Part B/D), decide whether `rem` should convert at
  the site's real phone root (~13.5px) instead of 16, and whether full-screen
  fixed overlays (inset-0) should be exempt from the safe-area count.
