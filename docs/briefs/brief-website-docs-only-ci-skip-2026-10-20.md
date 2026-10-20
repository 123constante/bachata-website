# DRAFT brief: Website docs-only CI skip (owner click 2026-10-20: "Docs-only skip on the Website required checks")

Status: ready to dispatch (owner click 2026-10-20). The bot token workflow scope must be confirmed first.

## Goal (plain words)
A PR that changes only docs (briefs, handovers, markdown, plans) currently runs every Website check: e2e browser smoke, unit tests, typecheck, bundle budget, and so on. Make those checks finish in seconds on a docs-only PR while still reporting SUCCESS under their existing names, and run exactly as today on any other change. Save the minutes without touching what any check proves for code.

## Why this shape (decisions already made, do not re-open)
- `main` has a ruleset requiring these 7 checks: `integrity`, `bundle-budget`, `e2e-smoke`, `wallclock-brand`, `masking-check`, `bom-check`, `unit (Europe/London, full)`.
  A workflow-level `paths-ignore` would leave a required check "pending" forever on a docs-only PR and BLOCK the merge. So NO `paths:` / `paths-ignore:` on these workflows. The jobs keep their names and still run; their heavy STEPS are skipped.
- Workflows holding them: `architecture-guard.yml` (integrity), `perf-budget.yml` (bundle-budget), `e2e-smoke.yml`, `typecheck.yml` (wallclock-brand), `workflow-lint.yml` (masking-check, bom-check), `unit-tests.yml` (unit). Job names/ids and matrix names must not change (a rename breaks the required context).
- Docs-only = EVERY changed file matches one of: `docs/**`, `**/*.md`, `.claude/**`, `plans/**`. Anything else (including any file under `.github/`, `package*.json`, `src/**`, `scripts/**`, `tests/**`, config files) = NOT docs-only. A markdown file inside `src/` or `public/` is NOT docs-only (it can ship); handle by excluding `src/**` and `public/**` from the `**/*.md` rule.
- Only `pull_request` events may skip. `push` to `main`, `schedule`, `workflow_dispatch` and `deployment_status` ALWAYS run everything.
- Fail safe: if the changed-file list cannot be computed (error, empty, API limit), treat as NOT docs-only and run everything.

## The task
1. Add `scripts/ci/docs-only.mjs`: reads changed paths (one per line on stdin, or computed with `git diff --name-only <base-sha> <head-sha>` after a full-depth fetch of both shas), prints `docs_only=true|false` to stdout and to `$GITHUB_OUTPUT` when set. Pure function `isDocsOnly(paths)` exported, plus `--self-test` (table of at least 14 cases: empty list, one md, md in src, md in public, docs image, package.json, workflow file, mixed, `.claude`, plans, uppercase `.MD`, path with spaces, deleted file, rename). Prove each arm red with a rolled-back mutant (rules removed one by one, the self-test must fail).
2. In each of the 6 workflows, in each required job: first step computes `docs_only` (only when `github.event_name == 'pull_request'`; otherwise false). Every later heavy step gets `if: steps.changes.outputs.docs_only != 'true'`. The job itself is NOT skipped (so the required check still reports success). Keep `concurrency`, permissions, timeouts as they are. Do not add third-party actions; plain git and node only.
3. Wire `scripts/ci/docs-only.mjs --self-test` into an existing always-running required job (so a broken classifier reds CI), not a new workflow.
4. Do NOT touch the schedule-only workflows, `pr-mergeable-guard.yml`, or anything else.

## Checks on real data
- List the last 30 merged Website PRs with `git log --name-only` (plain git, no `gh api`): count how many would have been docs-only by the rule, and list 3 borderline ones (a markdown file under `src/`, `public/`, `.github/`) with the verdict. Put the counts in the PR body (counts only).
- Show the classifier output for each of the 7 workflow files and for `package.json` (must be false).

## Boundaries
Never merge or approve; bot PR; never `--no-verify`; plain git, no `gh api`, no shell variables/loops/`$(...)` where a plain command works; Supabase untouched (read-only anyway); one push at the end (Vercel cap) plus a PARTIAL push if needed; hand over at 25-30% context. CI rule (billing): run every job step you can in your sandbox and put a per-job table (command, exit code) in the PR body; GitHub Actions may refuse jobs for billing, read the annotation before judging a red.

## Output
ONE bot PR "ci: skip heavy steps on docs-only PRs (required check names unchanged)". PR body: before/after in plain words; the counts above; per-job table; "Verified / Not verified" (NOT verifiable in the PR itself: a PR that edits workflows is not docs-only, so the live docs-only path is proved by the NEXT docs-only PR after merge: the orchestrator checks that all 7 required checks report success quickly, and one code PR still runs in full). Handover `docs/handover/ci-docs-only-skip.md`. Last commit subject ends `[worker-done <ticket>]`. Stop after the push and the PR.

## After merge (orchestrator, not the worker)
Open one tiny docs-only PR; expect the 7 required checks green within a couple of minutes with the heavy steps skipped; then one code PR still runs in full. If the docs-only run ever hides a real failure class, revert the PR (one commit).

## If the push is refused for workflow files (added 2026-10-20)
A cloud worker's git push can be refused for changes under `.github/workflows` ("refusing to allow ... workflow scope"). If that happens, do NOT retry in a loop and do NOT edit around it: push everything else (the classifier, its self-test, the handover) on your branch, and put each changed workflow as a complete file under `docs/handover/ci-docs-skip/workflows/<name>.yml` plus a one-paragraph apply note (the orchestrator applies them with the bot token, which has workflow scope). Say this plainly in the PR body and the handover. The PR is then PARTIAL by design; end the last commit subject with `PARTIAL [worker-done <ticket>]`.
Also: "the worker must NOT run `gh api`" stands; use plain git only. Workers: set `automerge-ok` label NEVER on this PR (it edits CI).
