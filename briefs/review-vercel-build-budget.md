# Brief: independent review of the Vercel build budget change, READ-ONLY on its branch

Repo: 123constante/bachata-website. Branch `claude/vercel-build-budget` at `4d66f73b` (one commit on main).
Model: Opus. You did NOT write this code. You push ONLY to your own branch `claude/review-vercel-build-budget` (create it
from `origin/claude/vercel-build-budget`); never push the reviewed branch.

## Why
The Website is on Vercel Hobby (about 100 deployments per rolling 24 h). On 2026-10-16 the limit was hit (118) and blocked
a finished PR's preview for hours; 36% of builds were brief/doc/review/done branches that need no preview. This change
makes those branches and `[skip preview]` checkpoint commits skip the build. Your job: find what would make it fail to save
builds, or break a real PR's checks, BEFORE it merges.

## Read first
`docs/handovers/vercel-build-budget.md` on the branch, then `git diff origin/main...origin/claude/vercel-build-budget`.

## Check, in this order
1. THE KEY QUESTION. Does an Ignored Build Step skip (the deployment ends CANCELED) still count toward the Hobby
   deployments-per-day limit? Find the answer in Vercel's own docs (vercel.com/docs: limits, ignored build step,
   `git.deploymentEnabled`) and quote the sentence with its URL. If it counts, or the docs do not say, the right fix is
   ALSO a `vercel.json` `"git": { "deploymentEnabled": { "arc/briefs-*": false, "claude/done-*": false,
   "claude/review-*": false } }` (check the exact glob syntax in the docs), so no deployment is created at all. State which,
   with evidence. Do not guess.
2. Correctness of `scripts/vercel-ignore-build.sh`: production (main) always builds; unknown cases build; subject-only
   `[skip preview]` match; the shell runs under Vercel's build image `sh` (no bashisms).
3. The five preview jobs' `if:` in perf-budget, synthetic-ssr-monitor, seo-check, og-image-check: a normal `claude/*` PR
   still runs them; a skipped branch does not leave a REQUIRED check pending forever.
4. `scripts/check-no-preview-prefixes.mjs`: would it catch a sixth preview job added later that forgets the prefixes?
   Revert one job's prefix and confirm it goes red; pick 2 new tests and revert the code they guard; report results.
5. Every CI job step in `.github/workflows` that this diff touches: run each step yourself (per-job table: command, exit code).

## Output
`docs/review-packs/vercel-build-budget/REVIEW.md` on `claude/review-vercel-build-budget`: the answer to question 1 with the
quoted doc sentence and URL; findings ranked (BLOCKER / SHOULD / NIT), each with file:line, what goes wrong, the exact fix;
mutation results; per-job table; what you could not check. No code fixes. Last commit subject ends with the done marker
from your dispatch prompt.

## Rules
- Plain git for read and push. NEVER `gh api`. Shell commands without variables, loops or `$(...)` where a plain one works.
- Never merge or approve. Never `--no-verify`. Supabase not needed.
- Push ONCE at the end (Vercel budget).
- Context: at 25% start nothing new; by 30% push REVIEW.md as it stands with `PARTIAL [worker-done <ticket>]`.
