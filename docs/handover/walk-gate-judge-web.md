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

## Fix round r1 (brief fix-1369-r1, review of c79d9a07)
- F1: every engine measurement carries `viewport {width,height}`; anything but 390x844 is red (`VIEWPORT`).
- F2: rubric rows carry `min`/`max`; counts/overflow >= 0, contrast 1..21, px <= `MAX_PX` (10000); out of range is red.
- F3: every `doubts` entry must be a non-blank string (else red); a string `doubts` is red.
- Empties: `generateFixtures([])` throws (CLI exit 1); `coverageGaps` throws on screens [] or shapes [].
- `isPass(v, expectedHeadSha)`: the head is mandatory; another, missing or malformed head is not a pass.
- Spec: unparseable judge reply is red; head comparison mandatory; new `## Empty inputs` and `## Parts left`.

## Brief walk-judge-screens-tied-to-coverage-r2 (branch claude/walk-judge-screens-coverage-r2)
- PR #1453. tsc run on 7d209846: 0 errors in branch files. Not labelled automerge-ok (scripts/lib is hard-tier).
- Rebuild of PR #1435 (head 022b6d6e) on current main; #1435 is replaced and the lead closes it.
- The old diff (6 files, +296 -18) re-applied onto main: all five code/test files applied cleanly with
  no change of intent; one hand merge in `docs/automation/judge-worker.md` "Parts left" (kept main's
  new `buildJudgeReport` not-wired line, replaced the "input.screens is not tied" line with the
  `--coverage` caller line). No test needed adapting; main's `walk-report.mjs` does not call the judge.
- Rubric coverage: 10 of 10 red-reason kinds tested (malformed coverage, malformed input, no
  non-example screens, empty-shapes row, missing screen, missing shape, unknown input screen,
  example-row input screen, unreadable `--coverage` file, `coverage check threw`).
- Brief walk-gate-judge-threw-test (v2): `judgeSafe` in `walk-judge.mjs` now catches a throw in the
  coverage thunk separately: ONE reason `coverage: coverage check threw: <msg>`, first; `judge(...)`
  still runs and keeps all its reasons; if `judge(...)` itself throws, the coverage reason is kept
  before `judge threw: <msg>`. Two-argument verdict and pass path unchanged (K1, K2 still green).
  The reason keeps the `coverage:` prefix on purpose: `screensMissingFromCoverage`'s own catch already
  produced exactly `coverage: coverage check threw: <msg>` for a throwing getter on `coverage`.
- New tests in `tests/walkJudge.test.ts` (20): describe `coverage check threw (red reason 10 of 10)`,
  18 table rows (coverage getter / input.screens getter always / first read only x Error, string,
  null x clean, other red reason) + the two-argument row; `K13 duplicate input ids: reported once per
  duplicated id, ...` (the check was already pinned by walkFixtures `C16 repeated input screen id`).
  Red-first: 12 of 18 rows red on d1530d3 (the input.screens rows). Mutants: no coverage catch = 12
  red; no duplicate-id check = K13 + C16 red. Walk tests: 7 files / 446 tests green.
  Checks: prove-entry-point-dispatch 77/77, script-conventions, mojibake, `npm run lint` 34/34, eslint
  on touched files clean; tsc run on the final head (this commit): 0 errors in branch files.
  Not verified: PR CI at the new head (not observed before hand-off); a two-different-ids duplicate
  reports ONE malformed problem, not one per id (unchanged, out of scope).
- Checks: walk tests 7 files / 426 tests green; `prove-entry-point-dispatch` 77/77; script-conventions,
  mojibake, `npm run lint` (34/34 links) green; eslint on the 4 touched code files clean.
- tsc: `tsconfig.json`/`tsconfig.node.json` 0 errors; `tsconfig.app.json` 137 errors, none in branch
  files (that config does not cover scripts/ or tests/).

- Tests J8, J9, J10, J15, J23 added (they already held on c79d9a07; coverage only). 41 new tests red on
  the old code; mutants M8 to M19 (+M9b) each killed, then restored (table in the PR body).

## Brief walk-judge-screens-tied-to-coverage (branch claude/walk-judge-screens-tied-to-coverage)
- `screensMissingFromCoverage(walkCoverage, inputScreens)` in `walk-fixtures.mjs` (re-exported by
  `walk-judge.mjs`): pure, never throws; lists a required (non-example) screen missing from
  `input.screens`, an input screen coverage does not list, a coverage shape the input screen lacks.
  A required screen with `shapes: []` and an input screen naming an example row are problems too.
  Malformed coverage/input or a table with no non-example screen is ONE problem string.
- `judgeVerdict(input, report, coverage)`: optional third argument; each problem is a red reason
  prefixed `coverage:`. Omitted (`undefined`) = byte-for-byte the old verdict. CLI `--coverage <file>`;
  an unreadable/unparseable file is red (exit 1); `--coverage` with no file is usage (exit 2).
- Spec updated (Input, Output, Fail-closed rule, Parts left). Tests C1-C17 + K0-K12; mutants M1-M10 in the PR.
- Code review (one round): fixed empty-shapes row, example-row message, duplicate input ids,
  unreadable --coverage now keeps all other reasons, `coverage:` reasons always first.
  Not changed: opt-in coverage (brief says optional) and waived `walk: null` screens (Parts left).
- The seeded `walk-coverage.json` has only the example row, so `--coverage` against it is ALWAYS red
  until Part C adds real rows. That is intended (fail-closed), not a bug.

## Parts left
- Part D's caller must pass the live `docs/design/walk-coverage.json` (`--coverage`) and the PR's live
  head; nothing wires the judge into CI yet.
- Waived `walk: null` screens are still required by the coverage check; Part D/E decides how a waiver
  reaches the judge.
- Part D's caller must pass the PR's live head to `isPass`, not the verdict's own.
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

## Part D host picker (brief walk-host-lock)
- Exists: `scripts/lib/walk-hosts.mjs` (pure; no fs, network, clock or env) with the frozen
  `WALK_HOST_RULES` table (dell: no CI job running and free RAM above 3 GB; pc: owner not busy;
  laptop2: a passed day test run; every host: not locked, not the secrets-holding runner),
  `pickWalkHost(hosts, queue)` (oldest request first, ties by id; at most one assignment per pick;
  unknown/duplicate hosts or malformed input give no assignment with a reason, never a throw) and
  `hostLockKey(host, headSha)` -> `{ lock: 'walk:<host>', build: 'build:<headSha>' }`.
- Tests: `tests/walkHosts.test.ts` (table-driven); mutants in the PR body.
- Still left: `.github/automation/walk-hosts.json` (a guard path, owner-merged) and the lock
  wiring that reads live host readings, acquires `walk:<host>` and builds once per head.
- Status (PR #1441, tested on baf1ce4): 50 unit tests pass; mutants M0 to M6 all red; `npm run lint` exit 0;
  tsc run on baf1ce4: 0 errors in branch files; check:mojibake clean. Not verified: real hosts, real RAM/CI
  readings, the lock wiring. Next: owner reviews; a Part D wiring brief adds `walk-hosts.json` + lock.
