# Continuation brief: p3-save-copy-drafts -- rebase onto CURRENT main and keep the one-date rule (Sonnet, normal lane)

Branch `claude/p3-save-copy-drafts` (PR #1273, head ef3abc75). Read the first brief `docs/briefs/p3-save-copy-drafts.md` (branch brief/p3-save-copy-drafts) and the worker handover `docs/handover/p3-save-copy-drafts.md` on the branch.

## What went wrong
The first worker branched from an OLD main (merge-base ea16d4711; main is now 61c970668). The PR is DIRTY (conflicting, so its CI never queues). Worse, main's `src/modules/organiser/p3/model/saveWords.ts` already has `saveWordsFor(oneDate: boolean)` and `hasOneDate(listed, total)`: an event with exactly one date says "Save" / "Saved." and a many-date event says "Save for all dates" / "Saved for every date." The first worker rewrote `saveWordsFor(lifecycle)` and DROPPED that rule, and it says `claimEdit.matrix.test.tsx` does not exist (it does on main, `src/modules/organiser/p3/screens/__tests__/claimEdit.matrix.test.tsx`, which pins `saveWordsFor(true)` / `saveWordsFor(false)`).

## Do
1. `git fetch origin main` and rebuild the change ON TOP OF current main (merge or rebase `origin/main` into the branch; resolve conflicts by keeping main's one-date logic).
2. The save words must be a function of BOTH facts: `saveWordsFor(oneDate, lifecycle)` (or an equivalent single shared mapping): one-date vs many-date wording exactly as main has it today for LIVE; draft/paused wording from the first brief; ended/archived/cancelled/null/unknown say nothing about dancers. Keep the first worker's lifecycle source (`ws.series.lifecycle_status`) and its prod counts (archived 653, live 69, ended 21, draft 14, paused 2).
3. RED FIRST again, table-driven: every save message x {one date, many dates} x {draft, live, paused, ended, archived, cancelled, null, unknown}; the live column must equal main's current words byte for byte. Update `claimEdit.matrix.test.tsx` and the two send tests for the new signature. Paste the red count from the main-without-fix state.
4. Run lint, the p3 unit tests, tsc errors only in touched files, `npm run check:bundle-budget`. After pushing, `node ~/.claude/bin/pr-status.mjs` style check: the PR must not be DIRTY.
5. Handover update in `docs/handover/p3-save-copy-drafts.md`. Last commit subject ends with the done marker from your prompt.
