# p3-dates-fix-1 continuation: rebase on main, keep only what main does not already do

Branch: `claude/p3-dates-fix-1` (PR #1316, head 6582e6b). Read first on that branch: `docs/design/p3-dates-fix-1/HANDOVER.md` and `INVENTORY.md`.

PROBLEM (lead, 2026-11-04 ~02:25Z): the PR is CONFLICTING with main. Main already has `src/modules/organiser/p3/data/olderDates.ts` from #1218 (F-27 "All dates past 100", merged 2026-10-31), so your W-31 work duplicates it (add/add conflict on `olderDates.ts`; content conflicts in `AllDatesScreen.tsx`, `DateFieldSheets.tsx`, `DateSheet.tsx`). The earlier walk (W-31 FAIL) may have been run against a base without #1218.

DO:
1. `git fetch origin main`, merge or rebase main into `claude/p3-dates-fix-1` (no force-push; use a merge commit if rebase needs a force push). Main wins for olderDates.ts: take main's file, then re-read it.
2. Prove on main what W-31 still lacks: with 132 / 100 / 99 dates, is every date reachable with a visible "Show older dates" (or equivalent) on every tab, and can the oldest be opened? Use your `datesFix.matrix.test.tsx` cells against the merged code. Keep only the delta that is still red on main; delete your duplicate paging code. Say in the handover exactly which W-31 cells were already green on main.
3. Keep W-35 (version conflict: Start again, Put my changes back / Drop my changes; Save disabled while the conflict stands) and its tests and mutants, adapted to the merged gate code from #1313/#1306 (the gate copy path for "Start again" read).
4. Run: `npm run lint`, `vitest run src/modules/organiser`, `check:integrity`, `check:bundle-budget`. Update the PR description's "Verified on real data" lines and the "## Phone QA" lines (`- Sizes checked:`, `- Walked:`, `- Not verified:`).
5. The 390x844 walk of this PR is done by walk worker branch `claude/walk-p3-batch-1`; do not walk. Push once at the end; last commit subject ends `[worker-done <ticket>]`.
