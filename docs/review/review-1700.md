# Review: PR #1700 (Website) — price laptop-medium runner label at 1

PR #1700, branch `claude/ci-budget-laptop-medium`, head 6bf2ecee58361fe3b2e737773bfc1ba2c96e6cf6
Base: `origin/main` at 84e7695. Reviewer: independent cloud worker (review only, no product edits).
Brief: `docs/briefs/review-1700-r1.md` on `brief/review-1700-r1`.

## Verdict: PASS WITH NITS
## Hard-tier: PASS

## Checks

1. **Diff scope.** `git diff --stat origin/main...6bf2ece` = `ci-budgets.json | 4 +++-` only.
   Changes: new `//runnerMultipliers-laptop-medium` note (ci-budgets.json:49 at head), `"laptop-light": 1`
   gains a trailing comma, and `"laptop-medium": 1` is added (ci-budgets.json:57 at head). No other key changed.
   The head file parses as JSON, and `assertConfig()` (scripts/check-ci-budget.mjs:124) accepts it.
2. **Multiplier 1 over-counts, never under-counts.** scripts/check-ci-budget.mjs:202-205 rejects any
   runnerMultipliers value that is not a finite number `> 0`, so 0 (GitHub's real self-hosted price) cannot be
   declared. 1 is the lowest rate a hosted runner has (ubuntu/linux), so a self-hosted job is billed at or
   above its true cost of 0. This is the direction the file allows; it matches oracle-light and laptop-light (#1689).
3. **`laptop-*` labels in workflows.** `grep -rn laptop- .github/workflows scripts` finds nothing. Every `runs-on`
   here is `ubuntu-latest` except `.github/workflows/bom-check.yml:68` (`${{ needs.route.outputs.runner }}`), which
   comes from `scripts/ci/route-runner.mjs` using the `WEB_RUNNER_LABEL` repo variable. The `laptop-*` labels come
   from jobs in OTHER metered repos that the sweep reads, so this repo's files cannot list every label in use.
4. **Substring collision.** `runnerMultiplier()` (scripts/check-ci-budget.mjs:303-338) tries an exact
   case-insensitive match first (:310-311), then the larger-runner refusal (:319), then a substring match (:328-329).
   No key is a substring of another (checked pairwise over the head keys). `laptop-medium` and `laptop-light`
   share only the `laptop-` prefix, which is not a key. Probes against the head config: `[laptop-medium]` gives 1,
   `[LAPTOP-MEDIUM]` gives 1, `[self-hosted, laptop-medium]` gives 1, and `[laptop-light]`, `[oracle-light]` and
   `[ubuntu-latest]` still give 1. `node scripts/check-ci-budget.mjs --self-test` gives `PASS self-test -- 98 cases`, exit 0.

## Findings

- **NIT-1 (route-runner labels may be unpriced).** The fallback in `route-runner.mjs` sends
  bom-check to self-hosted labels taken from `WEB_RUNNER_LABEL`. The script's own examples are `acer-web` and
  `dell-web` (scripts/ci/route-runner.mjs:44, :236). Neither matches any runnerMultipliers key. If either is the
  real label and bom-check runs self-hosted in a metered repo, the sweep will exit 2 the same way it did here.
  I could not read the variable's value from this sandbox, so this is not proven. It is outside this PR's scope and does not block it.
- **NIT-2 (no run id in the note).** The laptop-light note cites the failing run (`run 43682498924 on 2026-11-15`).
  The laptop-medium note has no run id. This is documentation only.
- **NIT-3 (self-test does not cover the real config).** `--self-test` uses `FIXTURE_CFG`
  (scripts/check-ci-budget.mjs:1011), not `ci-budgets.json`. Its green therefore says nothing about this file's
  contents. I checked the head config separately with `assertConfig()` and the probes above.
  This is informational and needs no change in this PR.

## Not verified

- I did not run a live sweep (`check-ci-budget.mjs` without `--self-test`) against the GitHub API (no token, and
  `gh api` is not allowed), so I did not confirm that main's Budget Guard goes green after the merge.
- PR #1700's CI check states were not read.
- I did not read the actual `WEB_RUNNER_LABEL` / runner label sets in the other metered repos.
