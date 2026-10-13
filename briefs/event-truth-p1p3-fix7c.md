# Brief: Website FIX-7c worker (raise the event route first-load budget by 1 KB, owner decision)

Branch `arc/event-truth-p1p3-fix7` (continue it; head 1b52d4c). Push ONLY that branch. Open NO PR (PR #750 uses this branch). Read repo files with git, not `gh api`.
**Keep your session context under 35%: tail logs to 40 lines, read only what you edit, push early.** Write shell commands WITHOUT variables, loops or `$(...)`.

Owner decision 2026-10-13: the `event` (/event/:id) route's first-load KB budget goes from 380 to 381 KB, deliberately, in this PR. Cause (from `docs/handover/event-truth-p1p3-fix7b.md`): the PR adds 187 B gz via `src/lib/eventCategory.ts` riding in the `lib-event-rules` chunk, and `main` already has only 0.2 KB margin. No other route's budget changes. The structural fix (lazy `RaffleEntryDialog`) is queued as its own PR, so add a one-line comment/justification in `perf-budgets.json` if the file's format has a place for it (follow how earlier bumps were justified: `git log -p -3 -- perf-budgets.json`).

1. Edit ONLY `perf-budgets.json` (and the single doc line the file's own convention requires, if any). Use `scripts/safe-edit.py` if the write guard asks.
2. On a local merge of `origin/main` into the branch (do NOT push the merge): `npm run build`, `npm run check:bundle-budget`, `npm run check:first-load-requests`. Report exit codes and the printed `event` KB line. Abort the merge.
3. Run `npm run lint` links that cover `perf-budgets.json` (ci-budget-guard / `check:budget-*` if present; read `.github/workflows/ci-budget-guard.yml` and run its steps) and report exit codes. If a guard demands more than the bump (e.g. a changelog entry or a pinned hash), do that minimal thing and name it.
4. Commit, push `arc/event-truth-p1p3-fix7`, append a short section to `docs/handover/event-truth-p1p3-fix7b.md` (what changed, exit codes, Verified / Not verified).
