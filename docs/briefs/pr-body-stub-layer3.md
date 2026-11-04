# BRIEF: pr-body-stub-layer3 (Website; careful lane; Opus; hard-tier paths)

Brief-version: 2

Owner decision 2026-11-04 (click): "Yes, build it". Design note: `~/.claude/plans/NOTE-bot-pr-body-layer3.md` (read it first if you can; the facts you need are repeated here).

## Why (the failure to prevent)
Bot PRs open with a body that only knows the `## Verified on real data` section (three `TO FILL` lines, PENDING). It has no `## Phone QA` section, and `scripts/check-pr-phone-qa.mjs` has no pending state, so every UI PR is RED on `phone-qa-section` from the moment it opens. Workers then write bodies in shapes the checkers refuse (for example `Checks run (merged head):` instead of `- Checks run:`, real red on #1316). The stub text lives in three places that drift: the checkers, `bot-pr.yml` and the orchestrator's tool.

## What main lacks
- a single generator for the bot PR body, built from the checkers' own labels -- scripts/pr-body-stub.mjs
- a test that pins the stub to both checkers (pending for both, every label once, one heading each) -- tests/prBodyStub.test.ts
- extends: a PENDING state in the Phone QA checker, like real-data-verified has (TO FILL = exit 3, never a pass) -- scripts/check-pr-phone-qa.mjs
- extends: the bot PR step builds the whole body from the generator instead of an inline array -- .github/workflows/bot-pr.yml
- extends: the Phone QA workflow maps exit 3 to a notice exactly as real-data-verified.yml does -- .github/workflows/phone-qa-section.yml

## Files
- scripts/pr-body-stub.mjs
- scripts/check-pr-phone-qa.mjs
- tests/prBodyStub.test.ts
- tests/phoneQaSection.test.ts
- tests/realDataVerified.test.ts
- .github/workflows/bot-pr.yml
- .github/workflows/phone-qa-section.yml
- docs/handover/pr-body-stub-layer3.md

## What to build
1. `scripts/pr-body-stub.mjs`: imports `HEADING`, `LABELS` and `MARKER` from `check-pr-real-data-verified.mjs` and `HEADING`, `LABELS` from `check-pr-phone-qa.mjs`; prints the whole bot body (the intro lines, the real-data section with `- <label>: TO FILL` lines, then a `## Phone QA` section with `- <label>: TO FILL` lines, then the `Raised by` line). Labels are NEVER typed in this file. Exports a function and has `--self-test`.
2. `scripts/check-pr-phone-qa.mjs`: add `MARKER = 'TO FILL'` and a pending result exactly mirroring real-data-verified: a section whose labels still carry the marker returns `{ ok: false, pending: true }`, `main()` exits 3 with a PENDING message, and only when UI paths changed (a docs-only PR stays OK/not required even if the stub text is present). Pending is never a pass.
3. `phone-qa-section.yml`: run the check with `set +e`, map exit 3 to `::notice` plus a step-summary line and `exit 0`, every other code unchanged (copy the shape of `real-data-verified.yml`, including its comment about required checks).
4. `bot-pr.yml`: add an `actions/checkout` step (no token persistence needed) and build `body` from `node scripts/pr-body-stub.mjs` instead of the inline array. The PR must always open: if the generator fails, fall back to the old minimal body and print `::warning::`.
5. `tests/realDataVerified.test.ts` currently evaluates the inline array in `bot-pr.yml` ("keep the [ ... ].join shape"): change it to run the generator instead; keep every existing assertion.

## Tests (red first; run each new test against the unfixed code and say so)
- stub: real-data `parse()` says pending and Phone QA `parse()` says pending; every label of both `LABELS` arrays appears exactly once; exactly one heading per section (no "appears 2 times" trap); no label text is hard-coded in `pr-body-stub.mjs` (read its source in the test).
- Phone QA: pending for the stub on a UI PR, OK-not-required on a docs-only PR, FAIL when a label line is missing, FAIL for `Walked (note): text`, PASS for a filled body, exit codes 0/1/2/3 table.
- Mutants: remove the pending branch, let the marker count as filled, drop one label from the stub: each must turn a test red.
- Workflow shape: a test reads both workflow files and asserts exit 3 is mapped to success with a notice (same assertion style the real-data test already uses).

## Merge-path check (the lead asked for it)
`~/.claude/bin/auto-merge.mjs` already refuses a body containing `TO FILL` anywhere (changed today, 24 self-test cases). ALSO read `.github/workflows/bot-automerge.yml` and any classifier script it calls: prove, with a test or a quoted line, that a Phone QA `TO FILL` body is refused there too. If it is not, report it as a finding in the handover; do not widen scope.

## Hard limits specific to this brief
- You cannot edit `.github/workflows/**` (worker rule). Put the exact intended diffs of BOTH workflow files in `docs/handover/pr-body-stub-layer3.md` as unified diffs, apply the script and test changes, and say plainly that the workflow diffs are for the program lead to apply to this branch. Do not claim the workflow part is done.
- Real-data checks: these are CI scripts, not UI; "Verified on real data" means: run both checkers' `--self-test`, run the stub through both `parse()` functions, and run `node scripts/check-pr-phone-qa.mjs` / `check-pr-real-data-verified.mjs` with the stub body and with the last three merged PR bodies (read-only via `gh pr view`), reporting the exit codes.
- Run `npm run check:mojibake`, `npm run lint`, `npm run test:unit` (related tests) before the final push; write any mojibake regexes with `\u` escapes.
- PR body: use the exact skeleton in your prompt; save it to body.md and run both checker scripts on it before `gh pr edit`.

## Done when
Both checkers and the stub agree; tests green with mutants killed; handover has the workflow diffs, per-job CI table and a Verified / Not verified block. Stopping rule: one independent review, one fix round, then the lead applies the workflow diffs, walks it, and the owner Approves at the PR head (hard-tier paths).
