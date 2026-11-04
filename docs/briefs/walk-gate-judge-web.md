# Brief: walk-gate-judge-web (WEBSITE, SLICE 10 of full automation, PART A: judge spec + pure verdict module + fixture generator + waiver format). Branch claude/walk-gate-judge-web. Repo 123constante/bachata-website.

Brief-version: 2
Lane: careful
Model: Opus
Tier: HARD-TIER (`scripts/**` guard-class). The OWNER Approves at head later; you never approve, never merge, never self-certify. Nothing in this part arms, dispatches or merges anything.

Branch `claude/walk-gate-judge-web` (push ONLY here, ONE push, final subject ends `[worker-done <ticket>]`). Under 30% context; at 25% start nothing new; push + handover by 30%. Never merge/approve/--no-verify. Plain git only (never `gh api`). Supabase is not needed (counts-only fixtures are written from the spec, not queried); if you touch it, READ-ONLY. Never add `run-ci` yourself. Off origin/main; no stacked PRs.

Source: acceptance contract for full automation (rev 3.1), section 11 ("slice B", slice 10 in section 16) and 14.2. You cannot read it, so the rules you need are copied below (condensed). Do not widen scope.

Slice 10 is split into PARTS. This brief is PART A only. It does NOT depend on slice 2 (`claude/foundations-web`, in flight): do not import or edit anything slice 2 adds (required-jobs, is-money, guard-paths, arming).

## What main lacks
(Verified by me with `git grep`/`git ls-tree` on origin/main 0b8762c87, 2026-11-04: each token returns nothing and each path is absent.)
- no judge specification (input, rubric, output, model/budget/dispatcher) -- docs/automation/judge-worker.md
- no pure judge module or fail-closed verdict function -- scripts/lib/walk-judge.mjs (grep: walk-judge)
- no survey-derived fixture generator (status x type x counts x empty x past x huge, counts only) -- grep: walk-fixtures
- no per-screen shape coverage table and no check that an uncovered shape is red -- docs/design/walk-coverage.json (grep: walk-coverage)
- no owner-only waiver record format or validator -- grep: walk-waived
- no tests for any of the above -- tests/walkJudge.test.ts, tests/walkFixtures.test.ts, tests/walkWaiver.test.ts
- existing neighbour, NOT to be edited: `scripts/auto-walk-manifest.mjs` (maps UI files to existing route-mocked walks; it has no survey-derived shapes and no judge). Part A may read its exports; it must not change them.

## Do
Pure functions only: no network, no fs writes at import, no clock, no env reads (inject `now`). Every module exports a `main` guarded by `scripts/lib/entry-point.mjs`, as sibling libs do. British English, no personal data anywhere (counts only).

1. RED FIRST for each item: write the test file, run it, show it fails (module absent), then implement.
2. `docs/automation/judge-worker.md` (the written spec, tested by item 3 so it cannot drift): sections Input, Rubric, Output, Model and budget, Dispatcher, Fail-closed rule, Residual risks. It must state, matching the module constants exactly:
   - Dispatcher: the lane dispatches the judge through the dispatcher (one live worker per branch); never the builder, never a human; no judge dispatch while the pause switch is on (use `scripts/lib/automation-pause.mjs`, already on main, as a read-only dependency).
   - Model: a different model id than the builder AND a fresh session with no builder summary (14.2). Default Sonnet for the judge prompt; the module takes `builderModelId`, `judgeModelId`, `builderSessionId`, `judgeSessionId` and returns red if the ids are equal or any is missing.
   - Budget: 15 min wall limit per walk; judge worker runtime 3 h/day and 8 dispatches/day total (section 12); over = hold, alert. Constants exported, no enforcement of the daily total here (Part B).
3. `scripts/lib/walk-judge.mjs` exports: `JUDGE_CONFIG` (dispatcher, model policy, budget), `RUBRIC` (fixed ordered list: tapTargets >= 44 px, noSidewaysScroll, noClipping, contrast >= 4.5, emptyLoadingErrorHaveAction, plus iOS static checks: input font-size >= 16 px, no raw `100vh` without `dvh`, fixed bars use safe-area insets), `validateJudgeInput(input)`, `judgeVerdict(input, report)` and `verdictSchema`. Input: head sha, engine list (`chromium`, `webkit`), per-screen per-shape measured numbers, picture list (names and sha256 only), the four session/model ids. Output: `{ verdict: 'pass'|'red'|'doubt', headSha, reasons[], cited: [{check, measured, threshold}], engines, invalidatedBy: 'any push' }`.
   FAIL-CLOSED: `pass` only when EVERY rubric check has a cited measured number on every screen x shape x engine and all meet the threshold; any missing number, missing picture, NaN, unknown shape, absent engine, model/session collision, head sha mismatch, malformed input, or thrown error = `red` or `doubt`, never `pass`. `doubt` is treated as not pass by `isPass(v)`. A verdict with no numbers is red. Engine-level measured failures (clipping, sideways scroll, tap size) are red if they fail in EITHER engine.
4. Table-driven tests (tests/walkJudge.test.ts): one row per rubric check x {pass, boundary (43.9/44, 4.49/4.5), missing, NaN} x engine; the model/session collision rows; stale head sha; empty input; garbage types. Include a test that every constant and rubric id named in `judge-worker.md` appears in the module and vice versa.
5. MUTANTS (apply one at a time, show the suite goes red for each, restore): M1 `>=` flipped to `>` at the 44 px bound; M2 missing-number treated as pass; M3 webkit engine ignored; M4 model-id equality check removed; M5 `doubt` returned as `pass`; M6 head-sha comparison removed; M7 try/catch returning pass on throw. Record the mutant table in the PR body.
6. Fixture generator `scripts/lib/walk-fixtures.mjs`: `generateFixtures(surveyCounts)` pure, deterministic (no random, no Date). Input is the survey shape table (counts only: `{status, type, count, empty, past, huge}` rows; "huge" = over the 100-row API cap). Output is static JSON: one fixture per distinct shape, with synthetic placeholder names (`Fixture event 001`), integer counts, no emails/phones/handles/real names. `assertNoPersonalData(fixture)` rejects strings that look like emails, phone numbers, URLs, or `@handles`. Also `coverageGaps(walkCoverage, shapes)` returns the shapes a screen's walk does not cover; non-empty = red (drill B4: uncovered "huge list" = red; B3: UI file with no walk mapped = red unless a valid waiver). Seed `docs/design/walk-coverage.json` with the schema and ONE example screen only, marked `"example": true`; real rows are Part B.
7. Waiver record `scripts/lib/walk-waiver.mjs` (contract 11 item 4): `parseWaiver(record)` and `waiverValid(record, {pinnedHeadSha, ownerLogin, registeredAutomationLogins})`. Record fields: `label: 'walk-waived'`, `appliedBy`, `eventActor` (actor of the `labeled` event), `headSha` (head at which the label stood), `readAtMergeTime`, `reason`. Valid only if the actor equals `ownerLogin`, is not in the registered automation logins, `headSha` equals the pinned head, and `readAtMergeTime` is true. A bot-applied label is ignored (invalid) even if not yet removed (drill B5); removal is cleanup, not the control. Table tests: owner ok; bot; another human; stale head; missing actor; automation login equal to owner login (A36 style: also invalid).
8. Run every CI job step that applies (read `.github/workflows`), including `npm run test:unit`, `npm run lint`, the script-conventions check (`check-script-conventions.mjs` rules) and any guard that inventories `scripts/lib/*.mjs`. Put the per-job table in the PR body with the exact labels the template wants. Do not edit workflows, `package.json` scripts or existing guards unless a guard demands registering the new files; if it does, say so in the PR body.

NOT in Part A (leave for later parts; write them as a `## Parts left` list in the handover, with contract sections):
- Part B: the walk runner and Playwright WebKit project on the fixtures (11 items 1, 5a).
- Part C: iOS static DOM/CSS checks run against real built pages (11 item 5b), pictures pinned to head and invalidated by push (11 item 3), real `walk-coverage.json` rows per screen.
- Part D: host list `walk-hosts.json`, one lock per host, build-once per head, FIFO wait, Dell RAM/CI rule (11 item 7, A35); judge dispatch wiring and daily ceilings (11 item 6, section 12).
- Part E: walk-host isolation from the secrets-holding runner (6.2 criterion 6, A31); `walk-waived` label workflow reading the live event actor (11 item 4, B5); drills B1 to B7.
- Slice 11 (phone-check rule removal, 11.8) is NOT touched.

## Files
docs/automation/judge-worker.md
docs/design/walk-coverage.json
scripts/lib/walk-judge.mjs
scripts/lib/walk-fixtures.mjs
scripts/lib/walk-waiver.mjs
tests/walkJudge.test.ts
tests/walkFixtures.test.ts
tests/walkWaiver.test.ts
