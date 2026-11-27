# Brief: skip-builds-by-diff hardening tests (follow-up on PR #1295 review)

Repo: 123constante/bachata-website. Branch: `claude/skip-builds-by-diff` (PR #1295). Tests only; do not change behaviour.
This is a shell-script test change with no UI, no page and no visual element, so no INVENTORY.md is needed (the design-brief gate false-matches the file name vercelIgnoreBuild); coverage here is the two mutant results.
Review: `docs/reviews/1295-r1.md` on branch `claude/review-1295-r1` (git show origin/claude/review-1295-r1:docs/reviews/1295-r1.md). Read F1 and F2.

## Do
1. F1: in `tests/vercelIgnoreBuild.test.ts` add a row: seed `tsconfig.json` and `tsconfig.app.json`, commit a deletion of `tsconfig.app.json` only, expect BUILD (rc=1). It must go RED if `set -f` is commented out of `scripts/vercel-ignore-build.sh` (prove it: apply the mutant, show red, revert).
2. F2: pin the parser against shell drift. Add `expect(sh).toMatch(/^BUILD_PATHS='[^']*'$/m)` (closing quote ends the line) in `tests/buildRule.test.ts`, or extract the value with `sh -c` and compare to `readBuildPaths()`. Prove it with a mutant: `BUILD_PATHS='app src'" extra"` must fail.
3. Run `tests/vercelIgnoreBuild.test.ts`, `tests/buildRule.test.ts` and the unit tests next to them; typecheck; lint chain. Do NOT touch any script under `scripts/`.

## Rules
Never approve or merge. This PR is on `claude/*`, so a push does not deploy. One early checkpoint push, one final push. Handover `docs/handover/skip-builds-hardening-tests.md` with the two mutant results. Last commit subject ends `[worker-done <ticket>]`.
