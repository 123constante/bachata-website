# Brief: CI regenerates stale rpc-body fixtures itself (never a worker, never a laptop)

Repo: 123constante/bachata-admin. Branch: `claude/fixture-regen-ci`. Careful lane, Opus. Brief-version 3.
No UI, so no INVENTORY.md.

## Why (owner, 2026-11-05: "i need a long term solution for that, so that never happens again")
Migration PRs go red on `Migration Proof` exit 2 (stale `tests/fixtures/rpc-bodies/*`). The fix is `npm run migration:prove -- --write`, which needs Docker. Cloud-worker sandboxes cannot pull the Supabase images (proxy 403: #1259 worker dt_f1880341ed0a ended NOT RUN, PR #1263). The Dell and Acer `offload` users are not in the docker group (`permission denied ... docker.sock`). The PC has no docker. Only the GitHub-hosted runner can do it, and it already does in `.github/workflows/migration-proof.yml`.

## What main lacks
No job writes the fixtures back. Prove (exit 2) only prints the command.

## Do
1. New workflow `.github/workflows/fixture-regen.yml`. Triggers: `workflow_dispatch` (input: branch) AND `workflow_run` of "Migration Proof" completed, only when it failed on a `claude/**` head branch of this repo. Ubuntu runner, same setup steps as migration-proof.yml (copy them, no new tooling). It runs `node scripts/migration-prove.mjs --base origin/main --write`, and if `git diff` shows only files under `tests/fixtures/rpc-bodies/`, commits `chore(fixtures): regenerate rpc-body fixtures [fixture-regen]` and pushes to that branch with the same bot identity/token the other bot-push workflows use (read queue-run / bot-automerge / bot-pr to find it; do NOT invent a new secret).
2. Loop and safety guards, each with a test: (a) never run when the branch tip commit is already a `[fixture-regen]` commit; (b) never push anything outside `tests/fixtures/rpc-bodies/` (abort red if the diff touches any other path); (c) never run on a fork or on main; (d) concurrency group per branch; (e) after the push, retrigger the PR checks the way the queue does (remove then add the `run-ci` label, read the existing run-ci mechanism) so the fresh head is checked.
3. Approval note: a regen commit changes the head, so an owner Approve must come AFTER it. Put one line in `docs/migration-single-pr.md` (and the migration brief template if one exists in the repo) saying: workers do not run `--write`; CI does; if prove exits 2 wait for the `[fixture-regen]` commit. Remove any brief/doc wording that tells a worker to run `npm run migration:prove -- --write` before pushing.
4. Tests: a node test (no docker) over the workflow YAML and the guard logic (extract the guard into a small script `scripts/fixture-regen-guard.mjs` taking the changed-path list and last commit subject, returning allow/deny) with named mutants: drop guard (a), (b), (c), each must turn a test red. Show the mutant table in the handover.
5. End-to-end proof cannot run before merge (workflow_dispatch needs the file on main). In the PR body write the exact post-merge step: the lead runs `workflow_dispatch` with branch `claude/organiser-team-rpc` (PR #1259, stale `get_public_person_organisers_v1` fixture) and expects one `[fixture-regen]` commit.

## Rules
Hard-tier path (workflow file): owner Approve at final head, never merge. Handle the allow-list guard: this PR is bot-authored from claude/**; if the workflow-allow-list check goes red by design, say so in the PR body per job. Run every CI job step you can; docker steps cannot run in your sandbox, say which. One early checkpoint push, one final push. Handover `docs/handover/fixture-regen-ci.md`. Last commit subject ends `[worker-done <ticket>]`.
