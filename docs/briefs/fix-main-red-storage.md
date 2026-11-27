# BRIEF: fix-main-red-storage (WEBSITE; branch `claude/fix-main-red-storage`; careful lane; `Deployment Storage Check` red on main)

Brief-version: 2
`Deployment Storage Check` (`.github/workflows/deployment-storage-check.yml`, script `scripts/check-deployment-storage.mjs`, budget block `deploymentStorage` in `ci-budgets.json`) has been red on main since at least 2026-11-01: the Vercel function-storage pool (retained deployments x bytes per deployment) is over budget (last run 41990183260). The owner chose a CODE-SIDE fix, not the Vercel dashboard. You never approve or merge, never open a Vercel sign-in page.

## What main lacks
- A smaller stored footprint per deployment and fewer retained deployments from the repo side -- grep: the failing step text names three levers: retention (dashboard, out of scope), "deploy rate: vercel.json ignoreCommand, and any cron or deploy hook", and "bundle bytes: trace it with @vercel/nft over build/server/**/index.js and group fileList by package"

## What to do
1. Read the failing run log (`gh run view 41990183260 --repo 123constante/bachata-website --log-failed`, never print tokens) and the script, and state the measured pool, the budget and the gap in MB in the PR body.
2. Measure the bundle lever first: trace the server bundle with `@vercel/nft` (dev-only, run locally, do not add it to dependencies) and group by package. Remove build tooling or unused packages from the function bundle only where a test or build proves nothing else imports them.
3. Measure the deploy-rate lever: read `vercel.json`, `scripts/vercel-ignore-build.sh`, and any cron or deploy hook; do NOT weaken the ignore rules. Report what a typical day's deploy count is (`gh api` is stalled for workers: use `gh run list` counts) and whether a rule change would remove builds that serve no visitor.
4. If the repo-side levers cannot close the gap, DO NOT raise the budget to make it green. Write the measured numbers, the largest remaining lever, and the exact dashboard setting under `NOT verified:` and stop; the owner then decides.
5. Run every CI job step that applies; per-job table and Verified / Not verified in the PR body, exact labels `Verified on real data:` and `NOT verified:`.
6. COMMITS: separate plain commands: `git add <files>`, `git commit -F <msgfile>`, `git push origin claude/fix-main-red-storage`. No `&&` chains, no `-c` flags, no inline multi-line `-m`. ONE push; final subject ends with the done marker of your ticket.

## Files
- vercel.json
- scripts/vercel-ignore-build.sh
- package.json (only to move or drop a bundled-only dependency, if proven)
- docs/automation-foundations.md (one paragraph with the measurement, if you change anything)
