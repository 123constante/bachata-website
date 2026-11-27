# Brief: fixture-regen-ci fix round 1 (review FIX on admin PR #1264)

Repo: 123constante/bachata-admin. Branch: `claude/fixture-regen-ci` (PR #1264, continue it, do not open a new PR). Careful lane, Opus. Brief-version 3.
No UI, so no INVENTORY.md. Review: `git show origin/claude/review-fixture-regen-ci:docs/review/review-fixture-regen-ci.md` (read it first; F1 is the structural hole).

## What main lacks
`.github/workflows/fixture-regen.yml` (on this branch) runs branch code (`npm ci` with postinstalls, then the prover) in the SAME job and workspace as the `BOT_PR_TOKEN` push and label steps. Branch code can prepend PATH / GITHUB_ENV or edit `.git/config` (fsmonitor, proxy, insteadOf, credential.helper) and then run with the token. It can also overwrite the "trusted" copy of `scripts/fixture-regen-guard.mjs` that lives in the same workspace.

## Do
1. Split into TWO jobs. Job 1 `prove` has NO secrets and `permissions: contents: read`: checkout the branch head, `npm ci`, `node scripts/migration-prove.mjs --base origin/main --write`, then upload ONLY `tests/fixtures/rpc-bodies/*.sql` as an artifact (plus the prover exit code as a tiny file). Job 2 `push` (`needs: prove`, fresh runner): checkout MAIN's code only (never the branch), download the artifact, validate with main's `scripts/fixture-regen-guard.mjs`: only `tests/fixtures/rpc-bodies/<ident>.sql` paths, regular files only (reject symlinks, directories, deletions, path traversal), size cap; then fetch the branch head, copy the files in, commit as the bot, push without force, then do the `run-ci` remove/add. `BOT_PR_TOKEN` appears only in Job 2. Job 2 must refuse if the branch tip moved since Job 1 started (compare SHA).
2. Review minors: trim paths in the guard; pin every `uses:` to a full commit SHA (keep a comment with the tag); state in the PR body the policy question the reviewer raised about auto `run-ci` and take the conservative default (re-add `run-ci` only when the branch's PR already had it).
3. Tests: extend `tests/fixtureRegenGuard.test.ts` for symlink / deletion / traversal / tip-moved inputs, and a YAML-contract test asserting that no step that checks out or runs branch code sits in the job that has `BOT_PR_TOKEN` in its env or steps, plus that Job 1 declares no `secrets.` reference. Named mutants: (a) move the token into Job 1, (b) have Job 2 check out the branch, (c) drop the symlink refusal. Each must turn a test red; show the table in the handover.
4. Update `docs/handover/fixture-regen-ci.md` with the new structure and mutant table; update the PR body "Not verified" honestly (still no real run until it is on main).

## Rules
Workflow file edits may be refused to your Edit/Write tool: use a Bash heredoc/cp first; if refused, write the full file to `docs/handover/fixture-regen.yml.txt`, say so at the top of the handover, and do not loop. One push. Never add `run-ci`, never merge or approve. Last commit subject ends `[worker-done <ticket>]`.
