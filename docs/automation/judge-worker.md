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
`measurements[screen][shape][engine][rubricId] = number` plus
`measurements[screen][shape][engine].viewport = { width, height }`, `pictures`
(names and sha256 only, one per screen x shape x engine, named
`screen--shape--engine.png`) and optional `doubts` (strings the judge model could
not settle with a number).

The viewport must be exactly 390x844 (`VIEWPORT`) on every screen, shape and
engine; anything else -- 1280x800, one axis right, strings, missing -- is red.
`doubts`, when present, must be a list; every entry must be a non-blank string
and every such entry becomes a doubt. A non-string or blank entry, or a
`doubts` that is a string, is red: nothing is silently dropped.
No personal data: fixtures are counts-only placeholders.

## Rubric

Fixed and ordered. Measurements are keyed by the rubric id; `metric` says what
the number is. A check passes when `measured op threshold` holds AND the number
is inside its sanity range `min..max` (`none` = no ceiling beyond finite; px
values stop at `MAX_PX` = 10000). An out-of-range number -- a negative count or
overflow, a contrast outside 1 to 21, a 1e9 px tap target -- is red with an
"out of range" reason, whatever the threshold says.

| # | id | metric | op | threshold | unit | min | max |
|---|----|--------|----|-----------|------|-----|-----|
| 1 | `tapTargets` | `minTapTargetPx` | `>=` | `44` | px | `0` | `10000` |
| 2 | `noSidewaysScroll` | `horizontalOverflowPx` | `<=` | `0` | px | `0` | `10000` |
| 3 | `noClipping` | `clippedElementCount` | `<=` | `0` | count | `0` | `none` |
| 4 | `contrast` | `minContrastRatio` | `>=` | `4.5` | ratio | `1` | `21` |
| 5 | `emptyLoadingErrorHaveAction` | `statesWithoutActionCount` | `<=` | `0` | count | `0` | `none` |
| 6 | `iosInputFontSize` | `minInputFontPx` | `>=` | `16` | px | `0` | `10000` |
| 7 | `iosNoRawVh` | `raw100vhWithoutDvhCount` | `<=` | `0` | count | `0` | `none` |
| 8 | `iosFixedBarsSafeArea` | `fixedBarsWithoutSafeAreaCount` | `<=` | `0` | count | `0` | `none` |

Rows 6 to 8 are the iOS static checks: inputs at 16 px or more (no zoom on
focus), no raw `100vh` without a `dvh` fallback, fixed bars padded with
safe-area insets. Every check is judged per engine; a failure in EITHER engine
is red.

## Output

`judgeVerdict(input, report)` returns (see `verdictSchema`):

`{ verdict: 'pass'|'red'|'doubt', headSha, reasons[], cited: [{check, measured, threshold, op, screen, shape, engine}], engines, invalidatedBy: 'any push' }`

A verdict belongs to one head. Any push invalidates it; the next head needs a
new walk and a new verdict. Only `isPass(v, expectedHeadSha)` may be used to
read a verdict, and the head comparison is mandatory: the caller passes the head
it is about to unblock, and a pass for any other head -- or with no, or a
malformed, expected head -- is not a pass. A "pass" that still carries reasons
is not a pass either.

The judge model's reply is parsed into this shape before anything reads it. An
unparseable judge reply is red: it is never retried into a pass and never read
as "no objections". The reply parser is Part D wiring; today `isPass` is
already false for anything not well-formed, and the CLI reds unparseable JSON.

## Model and budget

The judge runs on a DIFFERENT model id from the builder, in a FRESH session
that has never seen a builder summary (contract 14.2). The default judge model
is Sonnet. `validateJudgeInput` returns red when the two model ids are equal
(case-insensitive), when the two session ids are equal, or when any of the four
is missing.

Budget (contract section 12): 15 minutes wall time per walk; the judge worker
gets 3 hours of runtime and 8 dispatches per day in total. Over budget means
hold and alert, never "pass anyway". `judgeBudgetDecision(ledger, now, config)`
in `scripts/lib/walk-judge-budget.mjs` enforces them as a pure, fail-closed
decision: given the ledger of judge runs (`{ startedAt, endedAt|null, branch }`,
ISO-8601 with a zone) and `now`, it counts the UTC day of `now` and returns
`allow: false` with `action: hold-and-alert` when today already has 8
dispatches, when today's runtime has reached 3 hours (an open entry runs until
`now`; a run that straddles midnight counts only its minutes inside today), or
when an open run has gone past 15 minutes. A malformed ledger or entry, a
non-ISO or future-dated timestamp, an entry that ends before it starts, a
missing `now`, a bad config, or any throw also holds; it never throws and never
allows on doubt. The Part D dispatcher must call it before every judge
dispatch; nothing wires that yet, and no real ledger exists yet.

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
| `JUDGE_CONFIG.budget.dailyTotalEnforcedIn` | `scripts/lib/walk-judge-budget.mjs` |

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
numbers, a measured number outside its sanity range, a viewport other than
390x844, a non-string or blank `doubts` entry (or a string `doubts`), an
unparseable judge reply, and any error thrown inside the judge. When every number passes but
the judge model recorded a doubt, the verdict is `doubt`, and `isPass` treats
`doubt` as not pass. The CLI exits 0 only on pass, 1 on red or doubt (including
an unreadable file), 2 on a usage error.

## Empty inputs

Empty is an error, never "nothing to do": `generateFixtures([])` throws (the CLI
exits 1), and `coverageGaps` throws on a coverage doc with `screens: []` or on
`shapes: []` rather than returning no gaps. `validateJudgeInput` already reds
`screens: []` and a screen with no shapes.

## Parts left

- input.screens is not tied to walk-coverage.json: the judge checks the screens
  and shapes the lane SAYS it walked, not the screens `docs/design/walk-coverage.json`
  requires. A lane that leaves a screen out of `input.screens` is not caught by
  the judge itself. Tying the two together is Part B/C work.
- The head comparison inside `main()` uses the input's own `headSha`; the Part D
  caller must pass the PR's live head to `isPass`, not the verdict's.

## Residual risks

- The numbers are only as true as the walk that measured them. Part A cannot
  tell a real 44 px from a walk that reported 44 without measuring; Parts B and C
  (the WebKit runner and the static checks on real built pages) close that.
- The model and session ids are self-reported by the lane. Equality is caught;
  a lane that lies about them is not. Part D wires the dispatcher that sets them.
- Fixtures are as good as the survey. A shape that production has but the
  survey missed has no fixture, so `coverageGaps` cannot see it.
- The daily runtime and dispatch ceilings are decided by
  `scripts/lib/walk-judge-budget.mjs`, but only for a dispatcher that calls it
  with a true ledger. Until Part D wires that call and keeps that ledger, a judge
  dispatched another way is not counted.
