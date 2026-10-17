# Brief VB2 -- no Vercel deployments for worker slice branches (layer 2 of the free deploy budget)

Repo `123constante/bachata-website`, branch `claude/vercel-slice-budget`, base = `main` AFTER PR #802 (`claude/vercel-build-budget`) has merged (if #802 is not on `main` yet, STOP and report). READ FIRST: #802's `docs/handovers/vercel-build-budget.md`, `docs/pr-batching-policy.md`, `vercel.json`, `scripts/check-no-preview-prefixes.mjs`, `scripts/vercel-ignore-build.sh`. Plain git only; ONE push at the end (the Vercel Hobby cap is 100 deploys/24 h; an ignored build still counts, only `git.deploymentEnabled: false` avoids a deployment).

## Why (measured 2026-10-16 from the Vercel API)
117 deploys in 24 h (cap 100): 47 `arc/*` brief branches, about 55 `claude/*` worker branches, 6 `main`, rest other. Normal days were 1 to 4. Workers build and test in their own sandboxes, so a slice-branch preview nobody opens is waste. #802 removes `arc/briefs-*`, `claude/review-*`, `claude/done-*`. This brief removes the worker SLICE branches.

## Do
1. Add `claude/*` to `git.deploymentEnabled` as `false`, keeping these ON (explicit entries that win): `main`, `feat/*` (integration branches), `dependabot/*`, `bot/*` only if a check needs them (read the workflows; justify each). Check Vercel's matching rules (specific pattern beats `*`); prove with a table-driven test that reads the real `vercel.json`.
2. Every workflow job that needs a preview URL (`perf-budget`, `seo-check`, `og-image-check`, `synthetic-ssr-monitor`, anything using `resolvePreviewUrl`, derive them as #802's guard does) must SKIP with an explicit reason on branches that get no deployment, never fail and never pass vacuously. The #802 guard (`check-no-preview-prefixes.mjs`) must enforce that the `false` keys and the job exclusions stay in step; extend its self-test with a mutant for each new rule.
3. `vercel-budget.mjs` is the orchestrator's tool (outside this repo): do not touch it. Update `docs/pr-batching-policy.md` with the new rule: a preview exists only for `main`, `feat/*` and PRs from `feat/*`; a slice PR's evidence is the worker's sandbox table.
4. Red first for the guard and the config test (paste failing output), then green. Run every touched CI job step locally and give a per-job table. State plainly what you could not verify (a real Vercel deploy decision).

## Output
ONE push. Last commit subject ends `[worker-done <ticket>]` (`PARTIAL [worker-done <ticket>]` at 25% context; a continuation is normal). Report head SHA and Verified / Not verified. Context cap 30%.
