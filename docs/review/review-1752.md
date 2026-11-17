# Review: PR #1752 (ci-speed) at head d239b93ff

Reviewed `git diff origin/main...origin/claude/ci-speed` (merge-base fd2ec24, 7 files, +510/-29) in a
worktree of d239b93ff4888b7cb2fa416ff57c17d88bb7524f. Review only; nothing pushed to `claude/ci-speed`.

## Verdict: PASS WITH NITS

All five brief checks hold with evidence. One open CI fact the merge gate must see first (F1).

## Evidence per brief item

1. **phone-qa.yml mode decision.** `light` needs `ci_light == 'true'`, `skip` needs `e2e_skip == 'true'`,
   anything else (empty/missing output, non-PR event: classifier emits all `false`) is `full`. A classifier
   crash fails the step, so the job is red, not skipped. Shard coverage on Playwright 1.63.0 (the env var
   is read in `node_modules/playwright/lib/runner/index.js`), `--list` per shard with
   `PWTEST_SHARD_WEIGHTS=5:6:12`: 117 + 139 + 278 = 534 = unsharded 534; sorted union vs unsharded list:
   0 diff lines, 0 duplicates; shard1+shard2+shard3 concatenated is byte-identical to the unsharded order.
   Light spec exists and lists 2 tests on `phone-390x844`. `build-smoke` still builds for `ci_light`.
2. **ci_light classifier** (`docs-only.mjs --self-test`: 75 cases, exit 0). Probed over stdin:
   `phone-qa.yml + src/a.tsx`, `seo-check.yml + src/a.tsx`, `scripts/ci/docs-only.mjs + src/pages/x.tsx`,
   `seo-check.yml + index.html`, `check-x.mjs + public/a.png`, `ci-budgets.json + package.json`,
   `check-x.mjs + a phone spec`, `scripts/ci/../../src/a.ts` -> all `ci_light=false e2e_skip=false`.
   `phone-qa.yml` alone and `typecheck.yml + docs` -> `ci_light=false` (own workflow stays full).
   `seo-check.yml` alone -> `ci_light=true`. Mutants KILLED: C1 own-workflow allowed, C2 every->some,
   C3 no CI path needed, C5 all of `scripts/` is CI, C6 `.github/` (composite actions) is CI, C7 emit drops
   `ci_light`, C8 emit `ci_light=true` always, C9 traversal check removed. C4 (drop the `isDocsOnly`
   early return) survives and is equivalent: no docs-only path is a CI path.
   No `src/`, `app/`, vite, router or Playwright-config file imports `scripts/ci/`, `scripts/check-*.mjs`
   or `ci-*.json` (grep: comments only); `dev`/`build` scripts call none of them.
3. **wallclock-budget job.** Job permissions `contents: read` + `actions: read`; only `github.token`; the
   file has no `secrets.` reference, trigger is `pull_request` (not `pull_request_target`) + dispatch.
   `continue-on-error` is `github.event_name == 'pull_request'`, on the measuring step only; the
   self-test step gates. Script: self-test 18 cases exit 0; live with no env exits 2. Mutants KILLED: W1
   never FAIL, W2 count cancelled, W3 no floor, W6 p90->p50, W7 no `::warning::`, W8 minRuns floor off,
   W9 FAIL returns 0, W11 config unchecked. Survivors: W4 (per-workflow error -> `continue`) and W10
   (`res.ok` unchecked) are both still caught by a second defence and exit 2; W5 see N2.
   `prove-entry-point-dispatch.mjs`: 92 entry points proven, exit 0. `check-script-conventions`: exit 0.
4. **routeRunner mutant case.** Baseline `vitest run tests/routeRunner.test.ts`: 96 passed, 34.5 s.
   Mutant R1 (the hook KEEPS its identity compare; another line is deleted instead, so the shell test
   passes): case goes RED, `expected 'ok TRUSTED...' to match /FAIL MUTANT altered workflow: refused/`.
   No `sleep 600` left behind. The dropped exit-code assertion is a named trade-off in the test.
5. **ci-budget-guard.yml** is unchanged: blob `8159ae60ab11` on both `origin/main` and the PR head.

## Findings

- **F1 (must be green before merge, not a code defect found).** Run 44115092498, `phone-qa (1)` attempt 1
  was RED: the suite step passed (114 passed, 3 flaky) but "Auto-walk pictures" exited 2 with
  `fatal: fd2ec24...HEAD: no merge base`, so `PR_FILES` was empty. The PR changes only that step's `if`
  (both forms are true here), not its command, so the diff does not explain it; cause not established.
  Attempt 2 was still running when this was written. Shards 2, 3, build-smoke, wallclock-budget: green.
- **N1.** PRs touching only `scripts/ci/**`, `scripts/check-*.mjs` or `ci-*.json` used to run the full
  phone suite and now run one spec. Safe today (item 2 grep), but nothing fails if a later change makes
  the app or a phone spec import one of those paths. A small guard would pin the claim.
- **N2.** Mutant W5 (delete the `GITHUB_TOKEN` check) survives: the "no token -> 2" case then makes a real
  request to api.github.com with `Bearer undefined` and gets its 2 from the HTTP error. Give the two
  env cases a stub `fetchImpl` so the self-test stays offline and the token check is pinned.
- **N3.** `PWTEST_SHARD_WEIGHTS` is an internal Playwright variable. A wrong count throws; a version
  that drops it falls back to equal slices, so coverage is safe either way but the balance could
  silently go. Worth one line next to the image-tag note.

## Not verified

- The cause of F1, and the result of `phone-qa (1)` attempt 2.
- The live output of the wallclock step on the PR run (logs returned only the cleanup tail).
- Real shard timings after merge; `workflow_dispatch` behaviour of the wallclock job (not run).
- tsc: not applicable, this branch adds one markdown file.

## Hard-tier: PASS
