# BRIEF: fix-main-red-storage-r2 (WEBSITE; branch `claude/fix-main-red-storage-r2`; careful lane, hard tier; `Deployment Storage Check` red on main)

Brief-version: 2
Owner rule 2026-11-05: the lead owns every red on main. You never approve or merge. This is a RE-APPLY: PR #1376 (branch `claude/fix-main-red-storage`, head 66843e56) fixes the red but now conflicts with main (refresh refused: overlapping changes). Cut a NEW branch from current main and port the same change by hand; do not push to the old branch and do not rebase it.

## Measured cause (from the first worker, run 41990183260)
508 retained deployments x 13.97 MB = 7.10 GB of the 10 GB pool, over the 5 GB warn line. `brief/*` branches (363 of them, 13 to 49 new a day) were not excluded from Vercel, so every push created a deployment record. The fix: add `brief/` to the no-preview list everywhere the other prefixes live.

## What main lacks
- `brief/` on the no-preview list in the four preview workflows (`.github/workflows/synthetic-ssr-monitor.yml`, `seo-check.yml`, `perf-budget.yml`, `og-image-check.yml`), in `scripts/vercel-ignore-build.sh` and in `vercel.json` -- grep: startsWith\(github\.head_ref, 'brief/'\)
- Test cases proving `brief/x` does not deploy and a non-brief branch still does -- grep: brief/fix-main-red-storage -> deploys false
- A handover note recording the measurement and why the check stays red until old deployment records expire -- docs/handover/fix-main-red-storage-r2.md

## What to do
1. `git fetch origin claude/fix-main-red-storage` and read the diff of its commit (`git show FETCH_HEAD`): files `.github/workflows/{og-image-check,perf-budget,seo-check,synthetic-ssr-monitor}.yml`, `scripts/vercel-ignore-build.sh`, `vercel.json`, `tests/vercelDeploymentEnabled.test.ts`, `tests/vercelIgnoreBuild.test.ts`; it also added `docs/automation-foundations.md`: do NOT touch that file (worker claude/foundations-web owns it), write your note in `docs/handover/fix-main-red-storage-r2.md` instead.
2. Re-apply it on top of main by hand (main moved: read each target file as it is now; if the prefix list changed shape, extend it the same way). No existing skip rule may be loosened.
3. Red first: the new test cases fail on main, pass after.
4. Run `node scripts/check-no-preview-prefixes.mjs` (0 drift), `npm run check:mojibake`, `npm run check:integrity`, the lint chain, and the two vitest files; run the full unit suite and compare any failure to main (state which fail on main too).
5. Say plainly in the PR that `Deployment Storage Check` will not go green on merge: existing records leave only when Vercel's retention expires them. Do not raise the budget.
6. PR body labels exactly `Verified on real data:`, `- Shapes surveyed:`, `- Checks run:`, `NOT verified:`; no `## Phone QA` section (no UI path).
7. COMMITS: separate plain commands: `git add <files>`, `git commit -F <msgfile>`, `git push origin claude/fix-main-red-storage-r2`. No `&&` chains, no `-c` flags. ONE push; final subject ends with your ticket's done marker.

## Files
- .github/workflows/og-image-check.yml, perf-budget.yml, seo-check.yml, synthetic-ssr-monitor.yml
- scripts/vercel-ignore-build.sh
- vercel.json
- tests/vercelDeploymentEnabled.test.ts, tests/vercelIgnoreBuild.test.ts
- docs/handover/fix-main-red-storage-r2.md
