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
- Tests J8, J9, J10, J15, J23 added (they already held on c79d9a07; coverage only). 41 new tests red on
  the old code; mutants M8 to M19 (+M9b) each killed, then restored (table in the PR body).

## Parts left
- input.screens is not tied to walk-coverage.json (the judge trusts the lane's screen list); Part B/C.
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
