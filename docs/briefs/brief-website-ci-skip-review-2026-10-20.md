# Brief: independent review of Website PR 867 (docs-only CI skip), 2026-10-20

READ-ONLY review. You did not write this. Do not edit the PR branch, do not push to it, do not merge or approve.

## What the PR does
`claude/ci-docs-skip` (PR 867, head ca5d5d416afe) adds `scripts/ci/docs-only.mjs` and, in 6 workflows, a first step per required job that computes `docs_only` on pull_request events and skips the heavy steps when every changed file is docs. The job stays and reports success under its existing name. Required checks on main: integrity, bundle-budget, e2e-smoke, wallclock-brand, masking-check, bom-check, unit (Europe/London, full).
Original brief: `git fetch origin brief/twin-and-ci-skip-2026-10-20` then `git show FETCH_HEAD:docs/briefs/brief-website-docs-only-ci-skip-2026-10-20.md`.

## What to find (a wrong skip is the worst outcome: a code PR going green without its tests)
1. Any path where `docs_only=true` for a PR that changes code: fork PRs, a shallow or missing base fetch, base-sha vs merge-base, renamed/deleted files, a file list that is empty or errors, paths with spaces, uppercase extensions, `.md` under src/ or public/, anything under `.github/`, `package*.json`, lockfiles, `scripts/`, `tests/`.
2. Fail-safe: if the classifier crashes or prints nothing, do the heavy steps still run? Check the `if:` expressions literally (`!= 'true'` vs `== 'false'`) and the exact step id/outputs name in every workflow.
3. Events: push to main, schedule, workflow_dispatch, merge_group, deployment_status must always run everything.
4. Job names, ids, matrix names and `concurrency`/`permissions`/timeouts unchanged (diff them). Required context names must be byte-identical.
5. Steps that must run even on docs-only (artifact uploads, summary steps, cleanup) or steps that depend on a skipped step's output.
6. The self-test: is each mutant real (does removing a rule really turn the table red)? Any rule with no case?
7. `tests/entryPoint.test.ts` edit: does it weaken that guard?
8. YAML validity of all six files (parse them) and that the GitHub expression syntax is valid.

## How
Plain git only (no `gh api`): `git fetch origin claude/ci-docs-skip main`, `git diff origin/main...origin/claude/ci-docs-skip`. Run `node scripts/ci/docs-only.mjs --self-test` and your own extra cases through `isDocsOnly`. You may run any read-only script. Supabase untouched.

## Output
Write `docs/review/ci-docs-skip-review.md` (verdict PASS / PASS WITH FIXES / FAIL; each finding with file:line, a concrete failing scenario, and a severity; plus what you checked and found clean) and push it as ONE commit to branch `claude/done-dt_REVIEW` (create from main; never push to claude/ci-docs-skip). Last commit subject ends `[worker-done <ticket>]`. Stay under 30% context; stop after the push and report the verdict in 5 lines.
