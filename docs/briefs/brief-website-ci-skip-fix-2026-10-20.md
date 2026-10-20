# Brief: fix pass on Website PR 867 (docs-only CI skip), 2026-10-20

You are the ONE fix worker for branch `claude/ci-docs-skip` (PR 867, head 9c2fd6f). The author worker is finished. ONE push at the end.
Read the independent review first: `git fetch origin claude/ci-docs-skip-review` then `git show FETCH_HEAD:docs/review/ci-docs-skip-review.md`. Also the original brief: `git show origin/brief/twin-and-ci-skip-2026-10-20:docs/briefs/brief-website-docs-only-ci-skip-2026-10-20.md`.

## The failure the owner would see (in plain words)
A PR that changes only a settings or hook file, or only a markdown file with corruption, goes green on the PR without its real checks, merges, and turns main red afterwards.

## Owner decisions (do not re-open)
- F1: `.claude` counts as docs ONLY for `.claude/rules/**` and `.claude/**/*.md`. `.claude/hooks/**` and `.claude/settings*.json` (and any other `.claude` file) are CODE: docs_only=false. Flip the self-test row for `.claude/settings.json` to false, add rows: `.claude/hooks/post-write-check.sh` false, `.claude/settings.local.json` false, `.claude/rules/x.md` true, `.claude/notes/x.md` true, `.claude/x.json` false. Keep every rule killed by a mutant.

## Fixes
- F2: in `.github/workflows/architecture-guard.yml` remove the docs-only `if:` from `Ensure PyYAML`, `Run integrity guard (sealed wrapper)`, `Mojibake guard`, and `Mojibake rules (canary)` ONLY IF it needs no `npm ci` (check the step; otherwise leave it skipped and say so). Docs-only PRs must still be scanned for markdown corruption. Keep the rest skipped. Update `tests/entryPoint.test.ts` / `prove-entry-point-dispatch.mjs` only as far as the change requires; do not weaken them.
- F3: make the markdown exclusion list reuse the one definition of "not docs": the FORBIDDEN prefixes of `scripts/automerge-classify.mjs` (lines ~46-47) plus the existing `src/ public/ .github/ scripts/ tests/ app/`. At minimum add `api/ supabase/ bin/ .githooks/ components/ e2e/ .vercel/`. Add self-test rows for each (all false) and a mutant per new arm.
- F4: only run the `git fetch --depth=2` deepening when `EVENT_NAME=pull_request`; on every other event print docs_only=false without touching git.
- Re-run: `node scripts/ci/docs-only.mjs --self-test`, `npx vitest run tests/entryPoint.test.ts`, `npm run check:script-conventions` (or the repo's equivalent), YAML parse of all six workflows. Red-first: show the new self-test rows FAIL against the old classifier (F1, F3) before the fix.

## Boundaries
Never merge or approve; do not label automerge-ok (this PR edits CI). Plain git only (no `gh api`); no shell variables/loops/`$(...)` where a plain command works. Never `--no-verify`. ONE push to `claude/ci-docs-skip` at the end; last commit subject ends `[worker-done <ticket>]` (or `PARTIAL [worker-done <ticket>]` at the context gate; stay under 30%). Update the PR 867 body "Verified / Not verified" through the PR description is NOT possible without gh api: instead update `docs/handover/ci-docs-only-skip.md` with a "Fix pass" section (what changed per finding, the red-first evidence, per-step table with command and exit code). GitHub Actions on the PR is the real check: read its result only by plain `git ls-remote`/the PR page is not possible, so report honestly that you did not see it.
Stop after the push and report in 5 lines.
