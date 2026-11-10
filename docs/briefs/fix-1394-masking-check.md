# Fix round: PR #1394 masking-check red (workflow allow-list guard)
Branch: claude/automation-loop-editable-workflows (existing PR #1394). Hard tier (.github/workflows + scripts guard). Careful lane, Opus.
Owner rules in play: you may edit ONLY .github/workflows/workflow-lint.yml as described by PR #1394; never change on:, runs-on, secrets, pull_request_target, never widen permissions.

## Failure (quote)
masking-check job step `node scripts/check-automation-workflow-allowlist.mjs --merge "$MERGE_SHA"` fails: "automation-workflow-allowlist: FAIL -- loop PR claude/automation-loop-editable-workflows changes workflow file(s) not on scripts/data/automation-workflow-allowlist.json:". The failing run is from 2026-11-06; the branch is far behind main.

## Do
1. `git fetch origin main`; merge main into the branch (resolve conflicts; keep both sides' intent).
2. Reproduce locally: `node scripts/check-automation-workflow-allowlist.mjs --self-test` and `--merge HEAD` the way the workflow calls it.
3. Decide the correct fix and state why in the handover: the guard must not flag the very PR that introduces it editing workflow-lint.yml. Options: the guard exempts its own introducing change, or the file is added to the allow-list data file with a test. Pick the narrowest; do NOT weaken the guard for other PRs. Add a test (tests/automationWorkflowAllowlist.test.ts) that a non-listed workflow edit still FAILS (mutation: remove the check, test must go red).
4. Run `npm run lint:workflows` if present, the guard self-test, `npm run test:unit` for that test file, `npm run check:mojibake`.
5. Push ONCE. Write docs/handovers/workflow-allowlist-3.md: done, check output, Verified / Not verified. Do not add run-ci.

## Verified on real data
This PR touches CI only: state "Shapes surveyed: n/a (no data paths)" and delete the Phone QA section.
