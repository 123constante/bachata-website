# Brief: merge main into PR #1181 (claude/p3-prefix-a-banner), keep both fixes

Lane: normal. Model: Opus (a merge that needs wiring, not only keeping both sides). Website repo only.
Stopping rule: one merge commit, one push, then stop. No new features, no extra cleanup.

## Why
PR #1181 (head d8977c5) is DIRTY: main moved when #1183 (p3-prefix-b, "no dancer row / 0-page Add a page") merged (b463c4c7e) and #1179/#1163 before it. CI does not queue on a conflicting PR.

## The two fixes that must BOTH survive
1. **#1181 (this branch):** one shared onboarding "things left" count used by the Home banner, the You row and the page editor, so the three never disagree (review finding: You row vs editor count mismatch was fixed on this branch).
2. **#1183 (on main):** the no-dancer-row / 0-page next step ("Add a page" path) in the You screen and organiser page index.

## Conflicts known
- `src/modules/organiser/p3/you/YouScreen.tsx`
- `src/modules/organiser/p3/you/youRows.ts`
- `src/modules/organiser/page/index.tsx`

## Steps
1. `git fetch origin main claude/p3-prefix-a-banner`, check out `claude/p3-prefix-a-banner`, `git merge origin/main`. Resolve each conflict by reading BOTH sides: the shared count helper from #1181 stays the single source of the number; #1183's no-dancer / 0-page branch stays and must use that same count where it shows one. Do not duplicate the count logic.
2. Run the related tests: everything under `src/modules/organiser/p3/` and `src/modules/organiser/page/`, plus the tests #1181 and #1183 each added (find them in `git diff origin/main...HEAD --stat` and `git show b463c4c7e --stat`). Also run `npm run lint` pieces that apply and `npm run check:bundle-budget` (must not change `perf-budgets.json`; if the merge brings in main's pins, keep main's).
3. Add one table-driven assertion if none exists: a person with no dancer row and 0 pages sees the #1183 next step AND a banner/You-row/editor count that all show the same number.
4. Commit the merge (message ends with `[worker-done p3-prefix-a-merge]`), push the branch (plain git, pre-push gate; do not skip hooks), then stop. Do not open a new PR, the existing #1181 is the PR. Do not edit the PR body.
5. Handover in your final message: conflict files and how each was resolved, test commands with counts, bundle-budget result, and a plain "Verified / Not verified" list.

## Hard limits
Supabase read-only. Never merge or approve. Never `--no-verify`. No other files than the conflict files and tests. Context cap 50%.
