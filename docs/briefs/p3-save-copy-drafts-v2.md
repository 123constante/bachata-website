# Brief: P3 save copy must not say "Dancers see it now" for a draft -- REDO on current main (Opus, normal lane, Website only, no DB)

New branch `claude/p3-save-copy-drafts-v2`, cut from CURRENT origin/main. Replaces parked PR #1273 (branch claude/p3-save-copy-drafts, DIRTY: built on a stale main and dropped main's one-date rule). Read the first brief `docs/briefs/p3-save-copy-drafts.md` (branch brief/p3-save-copy-drafts) for the owner's wording and the walk evidence, and the old worker handover `docs/handover/p3-save-copy-drafts.md` on claude/p3-save-copy-drafts for the lifecycle source (`ws.series.lifecycle_status`) and prod counts (archived 653, live 69, ended 21, draft 14, paused 2). Do NOT reuse the old branch's code.

## BASE CHECK (mandatory, the cloud sandbox has carried a stale main)
Before the first push: `git fetch origin main` and verify `git merge-base HEAD origin/main` prints the SAME sha as `git rev-parse origin/main`. Paste both in the handover. After the push check the PR is not DIRTY.

## Facts on main you must keep
`src/modules/organiser/p3/model/saveWords.ts` has `saveWordsFor(oneDate: boolean)` and `hasOneDate(listed, total)`: one date says "Save" / "Saved.", many dates "Save for all dates" / "Saved for every date." Pinned by `src/modules/organiser/p3/screens/__tests__/claimEdit.matrix.test.tsx`.

## Do
1. One shared mapping `saveWordsFor(oneDate, lifecycle)` (or equivalent single function): LIVE = main's current words byte for byte. Draft/paused: replace "Dancers see it now." with the owner's draft wording ("Saved as a draft. Dancers do not see it yet." or the clearest one-sentence form). Ended/archived/cancelled/null/unknown: say nothing about dancers either way.
2. RED FIRST, table-driven: every save message (labels.ts savedEvery/savedDate/addedEvery/addedDate/detailsSaved/detailsSavedOne, pricesSaved, session sheet) x {one date, many} x {draft, live, paused, ended, archived, cancelled, null, unknown}; live column equals main's words. Paste the red count from main-without-fix.
3. Callers: DetailsScreen, PricesScreen, SessionSheet and any user of those keys (grep each). No change to when saves are allowed or what is sent. Untouched save sends nothing.
4. Run lint, p3 unit tests, tsc errors in touched files, `npm run check:bundle-budget` (report numbers). HTML entities, never raw Unicode punctuation. PR body Verified / Not verified (walk is the orchestrator's). Stopping rule: one independent review, one fix round.

Handover `docs/handover/p3-save-copy-drafts-v2.md`. Last commit subject ends with the done marker from your prompt.
