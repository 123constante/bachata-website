# Walk judge worker -- specification (slice 10, Part A)

The walk judge decides whether a head's mobile walk is good enough to go on.
It is a SEPARATE worker from the builder. The deterministic part of its
judgement lives in `scripts/lib/walk-judge.mjs`; this page is that module's
written contract. `tests/walkJudge.test.ts` compares the two tables below with
the module in both directions, so a constant changed in one place only goes red.

Part A ships the spec, the pure verdict function, the fixture generator
(`scripts/lib/walk-fixtures.mjs`), the coverage table seed
(`docs/design/walk-coverage.json`) and the owner-only waiver validator
(`scripts/lib/walk-waiver.mjs`). Nothing in Part A arms, dispatches or merges
anything.

## Input

The lane hands the judge one JSON object (`validateJudgeInput` checks it):

- `headSha` -- the 40-hex head being judged.
- `engines` -- exactly `chromium` and `webkit`; an absent or unknown engine is red.
- `screens` -- `[{ id, shapes: [shapeId, ...] }]`; shape ids come from the
  survey-derived fixtures (`status.type.empty|nonempty.past|upcoming.huge|normal`).
- `builderModelId`, `judgeModelId`, `builderSessionId`, `judgeSessionId`.

The walk report it judges carries `headSha` (the head the walk actually measured),
`measurements[screen][shape][engine][rubricId] = number`, `pictures` (names and
sha256 only, one per screen x shape x engine, named `screen--shape--engine.png`)
and optional `doubts` (strings the judge model could not settle with a number).
No personal data: fixtures are counts-only placeholders.

## Rubric

Fixed and ordered. Measurements are keyed by the rubric id; `metric` says what
the number is. A check passes when `measured op threshold` holds.

| # | id | metric | op | threshold | unit |
|---|----|--------|----|-----------|------|
| 1 | `tapTargets` | `minTapTargetPx` | `>=` | `44` | px |
| 2 | `noSidewaysScroll` | `horizontalOverflowPx` | `<=` | `0` | px |
| 3 | `noClipping` | `clippedElementCount` | `<=` | `0` | count |
| 4 | `contrast` | `minContrastRatio` | `>=` | `4.5` | ratio |
| 5 | `emptyLoadingErrorHaveAction` | `statesWithoutActionCount` | `<=` | `0` | count |
| 6 | `iosInputFontSize` | `minInputFontPx` | `>=` | `16` | px |
| 7 | `iosNoRawVh` | `raw100vhWithoutDvhCount` | `<=` | `0` | count |
| 8 | `iosFixedBarsSafeArea` | `fixedBarsWithoutSafeAreaCount` | `<=` | `0` | count |

Rows 6 to 8 are the iOS static checks: inputs at 16 px or more (no zoom on
focus), no raw `100vh` without a `dvh` fallback, fixed bars padded with
safe-area insets. Every check is judged per engine; a failure in EITHER engine
is red.

## Output

`judgeVerdict(input, report)` returns (see `verdictSchema`):

`{ verdict: 'pass'|'red'|'doubt', headSha, reasons[], cited: [{check, measured, threshold, op, screen, shape, engine}], engines, invalidatedBy: 'any push' }`

A verdict belongs to one head. Any push invalidates it; the next head needs a
new walk and a new verdict. Only `isPass(v)` may be used to read a verdict.

## Model and budget

The judge runs on a DIFFERENT model id from the builder, in a FRESH session
that has never seen a builder summary (contract 14.2). The default judge model
is Sonnet. `validateJudgeInput` returns red when the two model ids are equal
(case-insensitive), when the two session ids are equal, or when any of the four
is missing.

Budget (contract section 12): 15 minutes wall time per walk; the judge worker
gets 3 hours of runtime and 8 dispatches per day in total. Over budget means
hold and alert, never "pass anyway". Part A exports these constants only;
enforcing the daily totals is Part B.

| constant | value |
|----------|-------|
| `JUDGE_CONFIG.dispatcher.dispatchedBy` | `dispatcher` |
| `JUDGE_CONFIG.dispatcher.liveWorkersPerBranch` | `1` |
| `JUDGE_CONFIG.dispatcher.neverDispatchedBy` | `builder, human` |
| `JUDGE_CONFIG.dispatcher.pauseModule` | `scripts/lib/automation-pause.mjs` |
| `JUDGE_CONFIG.dispatcher.blockedWhilePaused` | `true` |
| `JUDGE_CONFIG.model.defaultJudgeModel` | `sonnet` |
| `JUDGE_CONFIG.model.requireDifferentModelId` | `true` |
| `JUDGE_CONFIG.model.requireFreshSession` | `true` |
| `JUDGE_CONFIG.model.builderSummaryAllowed` | `false` |
| `JUDGE_CONFIG.budget.walkWallLimitMinutes` | `15` |
| `JUDGE_CONFIG.budget.judgeRuntimeHoursPerDay` | `3` |
| `JUDGE_CONFIG.budget.judgeDispatchesPerDay` | `8` |
| `JUDGE_CONFIG.budget.overBudgetAction` | `hold-and-alert` |
| `JUDGE_CONFIG.budget.dailyTotalEnforcedIn` | `part-b` |

## Dispatcher

The lane dispatches the judge through the dispatcher, with one live worker per
branch. The builder never dispatches its own judge, and neither does a human.
No judge is dispatched while the automation pause switch is on: the dispatcher
reads it with `scripts/lib/automation-pause.mjs` (a read-only dependency; Part A
does not import or change it). The dispatch wiring itself is Part D.

## Fail-closed rule

`pass` only when EVERY rubric check has a cited, finite, measured number on
every screen x shape x engine and all of them meet the threshold. Each of these
is red, never pass: a missing number, NaN or a non-number, a missing picture or
a malformed picture sha256, an unknown screen or shape, a listed shape that was
not measured, an absent or unknown engine, a model or session collision, a
report head that is not the judged head, malformed input, a verdict with no
numbers, and any error thrown inside the judge. When every number passes but
the judge model recorded a doubt, the verdict is `doubt`, and `isPass` treats
`doubt` as not pass. The CLI exits 0 only on pass, 1 on red or doubt (including
an unreadable file), 2 on a usage error.

## Residual risks

- The numbers are only as true as the walk that measured them. Part A cannot
  tell a real 44 px from a walk that reported 44 without measuring; Parts B and C
  (the WebKit runner and the static checks on real built pages) close that.
- The model and session ids are self-reported by the lane. Equality is caught;
  a lane that lies about them is not. Part D wires the dispatcher that sets them.
- Fixtures are as good as the survey. A shape that production has but the
  survey missed has no fixture, so `coverageGaps` cannot see it.
- The daily runtime and dispatch ceilings are constants here and are not
  enforced until Part B.
