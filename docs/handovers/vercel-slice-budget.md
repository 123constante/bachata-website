# Handover: vercel-slice-budget (brief VB2)

Brief: `docs/organiser-rebuild/briefs/VB2-slice-branches.md` on `arc/briefs-organiser-r1`
(sha eca1163032b26734dd4cf3b663fa83de476dcfa0). Branch `claude/vercel-slice-budget`, base
`main` at 56c4587 (#802 merged).

## Done

- `vercel.json` `git.deploymentEnabled`: `"arc/briefs-*": false`, `"claude/*": false`,
  `"main": true`, `"feat/*": true` (`claude/done-*`/`claude/review-*` are now covered by `claude/*`).
- **Vercel's matching rule is NOT "specific beats `*`"** (the brief's wording). Vercel docs
  (project-configuration/git-configuration): keys are minimatch globs; a branch that several
  keys match deploys if AT LEAST ONE is `true`; an unmatched branch deploys. So a `true`
  entry always wins, and the danger is a stray `true` glob re-enabling `claude/*`.
- Keep-on entries, justified: `main` (production) and `feat/*` (integration branches; their
  PRs to main run the real preview gates). `bot/*` and `dependabot/*` get NO entry: no check
  needs their preview (every preview job already excludes them), and being unmatched they keep
  deploying exactly as before (the ignore script's diff rule still skips docs-only bot builds).
- `scripts/vercel-ignore-build.sh`: `ALWAYS_SKIP_PREFIXES='arc/briefs- claude/'` (defence in
  depth; the shell prefix also catches `claude/a/b`, which Vercel's `claude/*` does not).
- The 5 preview jobs (perf-budget lighthouse + doc-weight, synthetic-ssr-monitor, seo-preview,
  og preview) exclude `claude/` instead of `claude/done-`/`claude/review-`.
- Explicit skip reason: each of the 4 preview workflows gains a `no-preview-reason` job that
  runs ONLY on the excluded branches (`startsWith` on exactly the same union) and writes the
  reason as a `::notice::` and to `$GITHUB_STEP_SUMMARY`. Preview jobs never fail and never
  pass on such a branch; they are SKIPPED, with the reason beside them.
- `scripts/check-no-preview-prefixes.mjs` new rules (self-test 30 -> 37 cases, one mutant each):
  KEEP_ON (`true` keys must be exactly `main`, `feat/*`; a stray `*-dev: true` fails), no
  no-preview prefix may cover a keep-on branch, and every required workflow has a
  `no-preview-reason` job writing the step summary whose prefixes equal the union.
- `tests/vercelDeploymentEnabled.test.ts` (new): table-driven over the REAL `vercel.json`
  with a Vercel-rules matcher (also tested on the docs' own example).
- `tests/vercelIgnoreBuild.test.ts`: rows that used `claude/*` as "a branch that builds" now
  use `feat/*`; two new SKIP rows (`claude/vercel-slice-budget`, `claude/organiser/slice-2`).
- `docs/pr-batching-policy.md`: preview only for `main`, `feat/*` and PRs from `feat/*`; a
  slice PR's evidence is the worker's sandbox table; worker checklist line.
- `vercel-budget.mjs` untouched (not in this repo).

## Red first

| Proof | Result |
|---|---|
| new config test vs unchanged `vercel.json` | 3 failed / 13 passed (claude/* slices deploy; no keep-on keys) |
| guard (new rules) vs unchanged repo | exit 1: KEEP_ON missing [main feat/*], 4 workflows lack `no-preview-reason` |
| 2 new slice rows vs old ignore script | 2 failed / 45 passed |
| after the change | 94/94 (ignore, config, previewProbe tests); guard 0 drift; self-test 37/37 |
| mutant: real `vercel.json` minus `"main": true` | guard exit 1 (`missing [main]`) |
| mutant: real `"claude/*": true` | guard exit 1; config test 5 failed |
| mutant: og-image-check reason job drops `claude/` | guard exit 1 (`missing [claude/]`); restored exit 0 |

## Per-job local run

| Workflow / job | Step(s) run locally | Result |
|---|---|---|
| workflow-lint / bom-check | BOM scan of every workflow | pass |
| workflow-lint / masking-check | `lint-workflow-masking.mjs` | pass |
| workflow-lint / notification-check | notification self-test + check, no-preview self-test + check | pass |
| perf-budget, synthetic-ssr-monitor, seo-check, og-image-check | YAML parse; guard compares all 5 preview jobs + 4 reason jobs | pass (cannot run the GitHub `if:` evaluation locally) |
| unit-tests | `test:unit:offline` | 8486 passed, 5 failed: all in `tests/integrityCouldNotRun.test.ts`, identical on unmodified `main` (sandbox, not this PR) |
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | pass |
| lint chain | `npm run lint` | 19/20 links pass; `check:integrity` exits 126 (bin/check-integrity.sh mode 100644 on main, pre-existing; passes via `bash`, exit 0) |

## Not verified

- A real Vercel deploy decision: that a push to a `claude/*` branch creates NO deployment, and
  that `main`/`feat/*` still deploy. Needs this merged, then one push of each kind.
- The `no-preview-reason` job and SKIPPED preview jobs on a live PR (this PR's own branch is
  `claude/*`, so its run IS that test: expect 5 preview jobs Skipped and 4 reason jobs green).
- Whether the `main` ruleset REQUIRES the Vercel commit status (`gh api` is off-limits): if it
  does, every `claude/*` PR now waits forever. **Owner must check before merging.**
- `/code-review` was not run (no human to type it in a scheduled run); self-review only.

## Left / next

1. Owner checks the required checks in the `main` ruleset, reviews, merges (workers never merge).
2. Long-lived branches read `vercel.json` from their pushed commit: a `claude/*` branch cut
   before this merge still deploys until it contains this commit.
3. Worker slices now have NO preview gates. The gates run on the `feat/*` integration PR, so
   orchestrators must route slices through `feat/*` for anything with a perf/SEO/OG risk.
