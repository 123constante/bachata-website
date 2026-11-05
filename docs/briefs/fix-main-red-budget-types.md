# BRIEF: fix-main-red-budget-types (WEBSITE; branch `claude/fix-main-red-budget-types`; careful lane; two red workflows on main)

Brief-version: 2
Two workflows are red on main for plain code reasons. Fix both in ONE PR; do not widen scope. You never approve or merge.

## What main lacks
- A `runnerMultipliers` entry for the runner label `oracle-light` -- grep: `git grep -c oracle-light origin/main -- ci-budgets.json` prints 0; the `CI Budget Guard` workflow (step "Measure the account against ci-budgets.json") exits 2 because a job runs on that label
- Current generated types -- grep: `git show origin/main:src/integrations/supabase/types.ts | grep -c client_error_reports` prints 0 while the live DB has the `client_error_reports` table and `last_error` columns; the `Supabase types drift` workflow is red because of it

## What to do
1. Red first: run the two checks locally (`node scripts/<the budget script the workflow runs>` and the types drift script the workflow runs; read `.github/workflows/ci-budget-guard.yml` and the drift workflow for the exact commands) and confirm both fail the way main does.
2. Budget: find which workflow job uses `oracle-light` and what that runner really costs (read the guard's own docs in `docs/ci-guard-notes.md` and the existing multipliers). Add the entry with the multiplier the guard's rules call for, and say in the PR body how you chose it. If the guard needs a human number (a price you cannot derive from the repo), use the closest existing self-hosted label's multiplier, say so, and name it under `NOT verified:`.
3. Types: regenerate `src/integrations/supabase/types.ts` from the live project with the Supabase connector's `generate_typescript_types` (READ-ONLY; project `stsdtacfauprzrdebmzg`). Do not hand-edit. Run `npx tsc --noEmit` and the unit tests; the drift workflow's own command must now pass.
4. Run every other CI job step that applies to the files you touched. Per-job table and Verified / Not verified in the PR body, exact labels `Verified on real data:` and `NOT verified:`.
5. COMMITS: separate plain commands: `git add <files>`, `git commit -F <msgfile>` (message written to a file first), `git push origin claude/fix-main-red-budget-types`. No `&&` chains, no `-c` flags, no inline multi-line `-m`. ONE push; final subject ends with the done marker of your ticket.

## Files
- ci-budgets.json
- src/integrations/supabase/types.ts
