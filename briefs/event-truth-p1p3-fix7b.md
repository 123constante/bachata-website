# Brief: Website FIX-7b worker (event route 0.1 KB over its first-load budget)

Branch `arc/event-truth-p1p3-fix7` (continue it; head 01f8c806 is the review commit on another branch, so use `origin/arc/event-truth-p1p3-fix7` = 30ba975b). Push ONLY that branch. Open NO PR (PR #750 already uses this branch).
Never use `gh api` to read repo files: use git. **Keep your session context under 35%: tail logs to 40 lines, read only what you edit, push early.**
Write shell commands WITHOUT variables, loops or `$(...)` where a plain command works (the cloud classifier stops on them), and check a PRODUCTION build (`npm run build`), not the dev server.

## The failure (GitHub check `bundle-budget` on PR #750)
`[OVER BUDGET] event (/event/:id): 380.1 KB first-load JS across 47 files (budget 380 KB)`. All other routes pass. `main` passes. The PR is tested merged with the
latest `origin/main` (which now holds #743, #744, #748), so the SUM tips over. The check that would have caught it: `npm run build && npm run check:bundle-budget` on the MERGED tree (the earlier worker runs used the branch alone and passed).

## Do exactly this
1. In your sandbox: `git fetch origin main`, `git merge --no-commit --no-ff origin/main` (do NOT push the merge; abort it afterwards), `npm run build`, `npm run check:bundle-budget`. Confirm the same 380.1 KB over.
2. Measure what the PR's diff adds to the `event` route's first-load graph versus `origin/main` (build main too and compare the per-chunk list the script prints; `vite.chunks.ts` and `perf-budgets.json` explain the groups).
   The FIX-6 F-l change moved `londonDate` into `lib-event-rules`; fix-6/7 touched `src/lib` and `app/lib/ogCardRender.ts` only through shared imports. Name the module(s) responsible.
3. Remove that weight on the BRANCH (smallest change that gives at least 0.5 KB margin): e.g. stop a heavy import reaching the event route's static graph, or lazy-load it. Behaviour must not change; every existing test stays green, add a test only if you add logic.
4. If nothing can be removed without a behaviour change, DO NOT raise `perf-budgets.json`: stop and write the module list, the exact KB, and a one-line proposal for the owner.
5. Rerun on the merged tree: `npm run check:bundle-budget`, `npm run check:first-load-requests`, `npm run test:unit:offline -- src/modules/organiser src/lib` and report exit codes. Abort the merge, commit your branch change only, push `arc/event-truth-p1p3-fix7`, write `docs/handover/event-truth-p1p3-fix7b.md` (what/why/numbers/Verified/Not verified).

Also state in the handover: `db-contract-check` steps "unmigrated-DDL drift" and "raffle anon-grant posture" are red on `main` already (not this PR); `check-event-truth-v1` is the expected #780 red. Do not touch them.
