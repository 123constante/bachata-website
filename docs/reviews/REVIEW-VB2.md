# REVIEW-VB2 -- independent review of PR #806 (VB2: no deployments for claude/* slice branches)

Reviewer: scheduled worker, ticket dt_cd97669c039b, branch `claude/review-vb2` (cut from
`claude/vercel-slice-budget` at head `6338c77`). One review round (CI-guard change). Plain git
and read-only GitHub reads only. No file other than this one was changed.

## Verdict

**0 BLOCKING / 1 SHOULD / 3 NOTE.** It is safe to merge as it is. The SHOULD finding is a gap
in the budget saving, not a correctness or mergeability risk.

## Findings

### SHOULD-1 -- `claude/*` does not cover nested worker branches, so they still create deployments
- `vercel.json:180` `"claude/*": false`. Vercel keys are minimatch globs, and `*` does not
  cross `/`. The PR's own test pins this at `tests/vercelDeploymentEnabled.test.ts:53`
  (`claude/a/b` -> deploys true), and the handover acknowledges it at
  `docs/handovers/vercel-slice-budget.md:20`.
- This happens today. `git ls-remote --heads origin` lists 4 live nested branches:
  `claude/feat/website-ownership-contact-rpcs`, `claude/feat/website-profile-finish-step`,
  `claude/feat/website-profile-link-slice2` and `claude/fix/organiser-access-polish`
  (out of 126 `claude/` heads). A push to any of them still creates a Vercel deployment.
  The ignore script then skips the build, but the brief says an ignored build still counts
  toward the 100/24 h cap.
- The guard locks the gap in: `scripts/check-no-preview-prefixes.mjs:203` requires the false
  keys to equal `ALWAYS_SKIP_PREFIXES + '*'`. Replacing the key with `claude/**` makes the
  guard exit 1 (see mutant e below).
- **Fix:** have the guard expect `prefix + '**'` for prefixes that end in `/`, and change the
  key to `"claude/**": false`. Then flip the test row at line 53 to a real-file row asserting
  `claude/feat/x` -> false.

### NOTE-1 -- the guard does not check that the skip reason says anything
- `scripts/check-no-preview-prefixes.mjs:177` only checks that some `run:` contains
  `GITHUB_STEP_SUMMARY`.
- Mutant b2 sets `msg=""` in `seo-check.yml`. The guard stays green, so the job would write
  an empty reason.
- Low risk, because a person would have to empty it on purpose.
- **Fix (optional):** also require the reason job's `run:` to contain a fixed phrase such as
  `SKIPPED by design`.

### NOTE-2 -- the config test imports an undeclared transitive dependency
- `tests/vercelDeploymentEnabled.test.ts:14` imports `minimatch`. It resolves to 3.1.3, but
  `package.json` does not declare it. A lockfile dedupe could remove or major-bump it and
  break the test for reasons unrelated to vercel.json.
- **Fix:** add `minimatch` to devDependencies (pinned), or match with a small local
  glob-to-regex where `*` maps to `[^/]*`.

### NOTE-3 -- the `feat/*` and `main` keep-on keys change nothing today
- An unmatched branch already deploys, so dropping `feat/*` (mutant d) does not change any
  deploy decision.
- The keys are still worth keeping: they document intent, and the KEEP_ON rule stops a
  future broad `false` key from silently covering them.
- No change needed. Recorded so nobody reads them as load-bearing.

## Verification

### 1. vercel.json deploymentEnabled
- The keys are `arc/briefs-*: false`, `claude/*: false`, `main: true`, `feat/*: true`.
- Under the "any matching true wins; unmatched deploys" rule, the only `true` keys are `main`
  and `feat/*`. Neither can match a `claude/...` name, because minimatch is anchored and
  `claude/feat/x` does not match `feat/*`. So no key ordering or overlap re-enables a flat
  `claude/<name>` branch.
- Remote branch families from `git ls-remote --heads origin` (count, path depth):
  analysis/ 2, arc/ 28, bot/ 1, chore/ 1, ci/ 12, claude/ 122 (+4 at depth 3), dependabot/ 4
  (depth 3-4), docs/ 1, feat/ 22, fix/ 13, handover/ 1, m5/ 4, perf/ 2, security/ 1, main, plus
  one `ccr-*` branch.
- No `false` key matches any family other than `arc/briefs-*` (7 heads) and flat `claude/*`.
  `fix/*`, `ci/*`, `dependabot/*`, `bot/*` and the rest are unmatched and keep deploying.
  The one gap is SHOULD-1.
- `npx vitest run tests/vercelDeploymentEnabled.test.ts tests/vercelIgnoreBuild.test.ts`
  -> `Test Files 2 passed (2)`, `Tests 63 passed (63)`.

### 2. Preview-dependent jobs
- Method: grep `.github/workflows/*.yml` for `previewProbe`, `resolvePreviewUrl`,
  `resolve-preview-url` and `deployment_status`.
- Jobs that wait for a preview URL:
  - `perf-budget.yml`: lighthouse :150 and doc-weight :184
  - `seo-check.yml`: seo-preview :162
  - `og-image-check.yml`: og preview :245
  - `synthetic-ssr-monitor.yml`: synthetic-preview :204
- All five exclude `claude/` with `!startsWith(github.head_ref, 'claude/')`.
- Each of the 4 workflows has a `no-preview-reason` job whose `if:` is exactly the union
  (`bot/ dependabot/ arc/briefs- claude/`). Each writes a `::notice` and the step summary.
- `ci-budget-guard.yml`, `check-sourcemap-debugids.mjs` and `check-bundle-budget.mjs` import
  only `assertMeasured` from previewProbe. None of them polls a preview.
- The `deployment_status` jobs (prod-smoke, post-merge-prod-alarm, cloudflare-purge,
  og/seo production arms) filter to `environment == 'Production'`, so no claude/* push
  affects them.
- No job hangs or goes red on a claude/* PR. PR #806 is itself a claude/* PR: the author
  reports 33 check runs with no failure, 7 preview checks skipped and 4 reason jobs green.
  This review did not re-read the check runs.

### 3. Required-status interaction
- `pull_request_read get` on #806 -> `"mergeable_state":"clean"`.
- `get_status` on head 6338c77 -> one status only, `pr-mergeable-guard` success. There is no
  Vercel status.
- So the `main` ruleset does not require the Vercel status: a claude/* PR with no deployment
  is mergeable. Jobs skipped by `if:` count as passing for required checks.
- Not verified: the ruleset itself (that needs `gh api`, which is off-limits). The evidence is
  that a live claude/* PR without a Vercel status reads `clean`.

### 4. Guard + mutation evidence
Baseline: `node scripts/check-no-preview-prefixes.mjs` -> `5 preview job(s) compared, 0 drift(s)`,
EXIT=0. `--self-test` -> `PASS self-test -- 37 cases.` EXIT=0.

Each mutant was applied with sed, run, then reverted with `git checkout <file>`.

| Mutant | Change | Guard | Output |
|---|---|---|---|
| a | `"claude/*": true` | EXIT=1 | `DRIFT ... false keys: missing [claude/*]` + `true keys must be exactly KEEP_ON: ... extra [claude/*]` |
| b1 | delete the `>> "$GITHUB_STEP_SUMMARY"` line in seo-check reason job | EXIT=1 | `DRIFT seo-check.yml: no no-preview-reason job writing GITHUB_STEP_SUMMARY` |
| b2 | reason `msg=""` (empty reason) | **EXIT=0 (survives)** | `0 drift(s)`, see NOTE-1 |
| b3 | reason job `if:` drops `claude/` | EXIT=1 | `DRIFT .github/workflows/seo-check.yml job no-preview-reason: missing [claude/]` |
| c1 | add `"claude/vercel-*": true` | EXIT=1 | `DRIFT ... true keys must be exactly KEEP_ON: missing [] extra [claude/vercel-*]` |
| c2 | add `"**": true` | EXIT=1 | `DRIFT ... true keys must be exactly KEEP_ON: missing [] extra [**]` |
| d | drop `"feat/*": true` | EXIT=1 | `DRIFT ... true keys must be exactly KEEP_ON: missing [feat/*]`; vitest also red: `1 failed \| 15 passed (16)` |
| e | `"claude/*"` -> `"claude/**"` (the SHOULD-1 fix) | EXIT=1 | `DRIFT ... false keys: missing [claude/*] extra [claude/**]` (the guard rejects the fix) |

After the last revert, `git status` showed a clean tree except this doc.

### 5. CI steps run locally

| Step | Command | Result |
|---|---|---|
| guard | `node scripts/check-no-preview-prefixes.mjs` / `--self-test` | 0 drift, EXIT 0 / 37 cases PASS |
| touched unit tests | `npx vitest run tests/vercelDeploymentEnabled.test.ts tests/vercelIgnoreBuild.test.ts` | 63/63 pass |
| mojibake | `npm run check:mojibake` | `1397 files scanned, no cp1252 corruption`, EXIT 0 |
| lint chain | `npm run lint` | EXIT 1: 19/20 links green. `check:integrity` exit 126 because `bin/check-integrity.sh` is mode 100644 on base 56c4587 (`git ls-tree` shows it). This is pre-existing and not caused by this PR. `bash bin/check-integrity.sh` exits 0. |
| eslint (touched files) | `npx eslint scripts/check-no-preview-prefixes.mjs tests/vercel*.test.ts` | EXIT 0 |
| typecheck | not run | the touched files are `.mjs` and `tests/`, which are outside `tsconfig.app.json` `include` (`src`, `app`) |

Could not run: the GitHub Actions jobs themselves (e2e-smoke, workflow-lint, contract-check).
I relied on the author's report of #806's checks.

## Verified
- vercel.json globs against every live remote branch family, with the matcher semantics as
  documented in the PR.
- All 5 preview jobs and the 4 reason jobs carry the exact union.
- The guard catches mutants a, b1, b3, c1, c2 and d.
- #806 is `mergeable_state: clean` with no Vercel status.
- Touched unit tests, mojibake and eslint are green.

## Not verified
- A real Vercel deploy decision. Vercel's "any true wins" rule is taken from the PR's reading
  of the docs; no `VERCEL_TOKEN` was used (needs owner: Vercel token for a live count).
- The `main` ruleset's required-check list (only inferred from `clean`).
- The live check runs on #806 (the author's report was not re-read).
- That nested `claude/x/y` pushes actually create deployments today. This follows from the
  minimatch semantics, not from an observed deploy.
