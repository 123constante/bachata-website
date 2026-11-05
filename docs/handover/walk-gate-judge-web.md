# Handover: walk-gate-judge-web (slice 10, Part A)

Branch `claude/walk-gate-judge-web`, off origin/main 0b8762c. HARD-TIER: the owner
approves at head; the worker never approves or merges.

## Done
- `docs/automation/judge-worker.md` -- spec (Input, Rubric, Output, Model and budget,
  Dispatcher, Fail-closed rule, Residual risks); its constant and rubric tables are
  compared with the module both ways by `tests/walkJudge.test.ts`.
- `scripts/lib/walk-judge.mjs` -- `JUDGE_CONFIG`, `RUBRIC`, `ENGINES`,
  `validateJudgeInput`, `judgeVerdict` (fail-closed, never throws), `verdictSchema`,
  `isPass`, `flattenConstants`, `main` (exit 0 pass / 1 red-doubt / 2 usage).
- `scripts/lib/walk-fixtures.mjs` -- `generateFixtures` (pure, deterministic),
  `shapeId`, `assertNoPersonalData`, `validateCoverage`, `coverageGaps` (B4),
  `uncoveredUiFiles` (B3), `main`.
- `scripts/lib/walk-waiver.mjs` -- `parseWaiver`, `waiverValid` (owner-only event
  actor, not an automation login, pinned head, read at merge time; B5 and A36), `main`.
- `docs/design/walk-coverage.json` -- schema + ONE `"example": true` screen.
- Tests: 201 across `tests/walkJudge.test.ts`, `tests/walkFixtures.test.ts`,
  `tests/walkWaiver.test.ts`; red-first shown (all three failed to load before the
  modules existed); mutants M1 to M7 each turned the judge suite red (table in PR).
- No workflow, `package.json` script or existing guard edited; no guard demanded
  registration (`check-script-conventions` passed unchanged).

## Parts left
- Part B: walk runner and Playwright WebKit project on the fixtures (contract 11
  items 1, 5a); enforcing the judge daily totals (section 12).
- Part C: iOS static DOM/CSS checks on real built pages (11 item 5b); pictures
  pinned to head and invalidated by push (11 item 3); real `walk-coverage.json` rows.
- Part D: `walk-hosts.json`, one lock per host, build once per head, FIFO wait,
  Dell RAM/CI rule (11 item 7, A35); judge dispatch wiring and daily ceilings
  (11 item 6, section 12).
- Part E: walk-host isolation from the secrets-holding runner (6.2 criterion 6,
  A31); `walk-waived` label workflow reading the live event actor (11 item 4, B5);
  drills B1 to B7.
- Slice 11 (phone-check rule removal, 11.8) not touched.

## Next steps
1. Owner reviews at head; nothing here is armed.
2. Part B brief can import `judgeVerdict`/`isPass`, `generateFixtures`, `coverageGaps`.
