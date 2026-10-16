# Brief: ONE fix pass on PR #802 (Vercel build budget) from its independent review

Repo: 123constante/bachata-website. Branch `claude/vercel-build-budget` (PR #802), head `4d66f73b`. Model: Opus.
The author worker has finished; you are the only worker on this branch. Push ONCE at the end.

## Read first
- The review: `git fetch origin claude/review-vercel-build-budget` then
  `git show FETCH_HEAD:docs/review-packs/vercel-build-budget/REVIEW.md` (findings B1, S1, S2, S3, N1, N2, with exact fixes).
- `docs/handovers/vercel-build-budget.md` on the branch.

## Orchestrator decisions (already made, do not re-open)
1. Q1 answer is YES (an ignored build still counts toward the Hobby 100/day). So ADD to `vercel.json`:
   `"git": { "deploymentEnabled": { "arc/briefs-*": false, "claude/done-*": false, "claude/review-*": false } }`
   (merge into any existing `git` key; keep valid JSON; keep every other setting). KEEP the shell
   `ALWAYS_SKIP_PREFIXES` as defence in depth. Extend `scripts/check-no-preview-prefixes.mjs` so the
   `deploymentEnabled` false-keys must equal `ALWAYS_SKIP_PREFIXES` (with `*` appended) — drift = exit 1, with a self-test
   row and a rolled-back mutant proving it goes red.
2. B1: merge `origin/main` into the branch; keep BOTH sets of lines in `scripts/pre-ship.mjs` and `scripts/run-lint-chain.mjs`.
3. S1: reword the policy bullet exactly as the review says (`[skip preview]` saves minutes and a concurrent slot, not a deployment;
   only not pushing saves the daily budget).
4. S2, S3, N1, N2: apply the review's fix for each. If one fix is larger than ~60 lines, do the smallest safe version and write
   what is left in the handover.

## Gates
- Run EVERY CI job step in `.github/workflows` that this diff touches (and `npm run lint`, `npm run test:unit` compared against
  main's known failures), with a per-job table (command, exit code) in the PR body and handover. GitHub Actions may be refused
  by billing: then your table is the evidence.
- Red-first: each new test fails against the unfixed code; report it.
- Update `docs/handovers/vercel-build-budget.md` (Done / Left / Next) and the PR #802 body (`gh pr edit 802 --body-file ...`
  as the bot is fine; NEVER `gh api`).

## Rules
- Plain git for read and push. Shell commands without variables, loops or `$(...)` where a plain one works.
- Never merge or approve. Never `--no-verify`. No Supabase needed.
- Context: at 25% start nothing new; by 30% push with `PARTIAL [worker-done <ticket>]` and a handover listing what is left.
