# Brief: fixture-regen-ci fix round 2 (review PASS WITH FIXES on admin PR #1264 at b59ad50e)

Repo: 123constante/bachata-admin. Branch: `claude/fixture-regen-ci` (PR #1264, continue it, no new PR). Careful lane, Opus. Brief-version 3.
No UI, so no INVENTORY.md. Review text: the lead's summary below is the whole finding list (the reviewer was a delegated static read; nothing was run on a runner).

## What main lacks
Four defects in the fix-round-1 workflow and its tests:
1. MED-1: the YAML isolation test inspects `wf.jobs` only, so `secrets.` or `BOT_PR_TOKEN` in a top-level `env:` or `defaults:` would stay green.
2. MED-2: `BRANCH_CODE` (tests/fixtureRegenGuard.test.ts about line 212) is a denylist; job-2 steps such as `bash ./x.sh` or `node work/lib/y.mjs` would not trip it.
3. LOW-3: the artifact name `fixture-regen-<run_id>` collides on "Re-run failed jobs" (upload-artifact refuses an existing name).
4. LOW-4: no aggregate size cap on the artifact (300 files x 1 MiB each).

## Do (4 deliverables)
1. MED-1: add a violation for any `secrets.` or `BOT_PR_TOKEN` reference outside `jobs:` (top-level env, defaults, permissions-level strings), plus a named mutant that puts the token in top-level env and must turn the test red.
2. MED-2: invert the job-2 command check to an ALLOWLIST (only the exact commands job 2 is meant to run: git, the guard script from the main checkout, gh/label calls); anything else, including `bash ./x`, `node` on a non-guard path, or a path under the branch checkout, fails. Add a mutant for `bash ./x.sh` in job 2.
3. LOW-3: append `github.run_attempt` to the artifact name in both jobs and in the test.
4. LOW-4: add a total size cap of about 20 MiB in `scripts/fixture-regen-guard.mjs` (refuse over it) with a test; document LOW-5 (Actions-cache poisoning route, small) as an accepted risk in the handover.
Update `docs/handover/fixture-regen-ci.md` (mutant table gets the new rows) and the PR body "Not verified" (still no real run until it is on main).

## Rules
Workflow file edits may be refused to your Edit/Write tool: use a Bash heredoc/cp first; if refused, write the full file to `docs/handover/fixture-regen.yml.txt`, say so at the top of the handover, and do not loop. ONE push. Never add `run-ci`, never merge or approve. Last commit subject ends `[worker-done <ticket>]`.
