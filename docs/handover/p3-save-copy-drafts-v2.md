# Handover: P3 save copy for drafts, v2 (PR #1278)

Replaces parked PR #1273. Branch `claude/p3-save-copy-drafts-v2` was cut fresh from origin/main. None of the old branch's code is reused.

## Base check
- `git merge-base HEAD origin/main` = 61c970668871cc041679ff4bb3e5beb4e9df639e
- `git rev-parse origin/main` = 61c970668871cc041679ff4bb3e5beb4e9df639e (same)

## Done
- `model/saveWords.ts`: `saveWordsFor(oneDate, lifecycle)` is the one mapping. It covers:
  - the Details and Prices toasts
  - the session sheet toasts (savedEvery, savedDate(day), addedEvery, addedDate(day))
  - the Save button and the nothing-changed line, which do not depend on the lifecycle
- Main's one-date rule (`hasOneDate`, Save / Saved.) is kept.
- What each lifecycle says:
  - live: main's words, byte for byte (pinned in the tests).
  - draft: "Saved as a draft. Dancers do not see it yet." The other messages keep the same lead-in, e.g. "Saved for every date as a draft. Dancers do not see it yet."
  - paused: "... It is paused, so dancers do not see it." (for prices: "see them").
  - ended, archived, cancelled, null or unknown: no claim about dancers.
- Removed from `labels.ts`: savedEvery, savedDate, addedEvery, addedDate, detailsSaved, detailsSavedOne, pricesSaved.
- Callers updated to pass `ws.series.lifecycle_status`: DetailsScreen, PricesScreen, SessionSheet. Nothing changes about when a save is allowed or what is sent.
- Tests:
  - New `model/__tests__/saveWords.matrix.test.ts`: 6 messages x {one, many} x {live, draft, paused, ended, archived, cancelled, null, unknown}, plus 2 tests.
  - `claimEdit.matrix`: paused and draft-with-dates cases added; the call now passes the lifecycle.
  - `sessions.send`: draft and paused toast tests added.
  - `editScreens.send`: updated to the new mapping.

## Evidence
- RED first: the new matrix run against main's saveWords gave 93 failed, 5 passed.
- With the fix:
  - p3 vitest: 4113 passed, 2 skipped (before the r1 test additions). After r1, the 3 touched test files ran 178 passed, 2 skipped.
  - `npm run lint`: 24/24 links green. Whole-tree eslint is informational and red on main.
  - tsc: no new errors. The p3 errors in w3a.matrix:181, OnboardingFlow:315 and sessions.send:304 are all already on main.
  - Build OK. bundle-budget passes on every route: home 207.4/215 KB, event 375.3/381, auth 293.8/310, dancer-app 371.9/374, parties and classes 266.9/325, faq 233.0/245, landing 233.2 and 232.2/245.
- Review: one independent round, fixed in one round.
  - Raw Unicode in the new test was changed to \u escapes.
  - The missing paused and draft screen tests were added.
- The repo's .githooks are not executable in this sandbox, so git skipped them. I did not use --no-verify.

## Not verified
- Browser walk at 390x844 (the orchestrator's).
- PR checks green, and whether GitHub reports the PR mergeable (not DIRTY), after the final push.
- No new Supabase query: the lifecycle counts come from the #1273 handover.

## Next
- Orchestrator: walk a draft (e.g. 68d64855 on test org 5c3943c2) and a live event, saving Details, Prices and a session.
- Then close #1273.

## Fix round 1 (review r1, `docs/review/pr-1278-r1.md` on `claude/review-1278-r1`)
- Base: main had moved to 337ec6a. I merged it into the branch with no conflicts, so the merge-base is now origin/main.
- F1 fixed. All seven paused lines in `model/saveWords.ts` now use P3's word: "Saved. It is hidden from the calendar." / "Saved for all dates. It is hidden from the calendar. A date with its own pictures keeps them." / "Prices saved. The event is hidden from the calendar." / "Saved for every date. It is hidden from the calendar." / "Saved for {day} only. It is hidden from the calendar." / "Session added to every date. It is hidden from the calendar." / "Added to {day} only. It is hidden from the calendar." The header comment is updated too. No paused line makes a claim about dancers any more, because a paused page with a past date still shows publicly under "On hiatus".
- F4 fixed. `''` (what `seriesModel.ts:93` passes for a null lifecycle) is now in the matrix LIFECYCLES. It behaves like null and says nothing about dancers.
- Red first: I changed only the matrix and ran it against the old words. 12 failed (the 12 paused cells) and 98 passed. The `''` cells already passed, because `lifeOf('')` already falls to quiet.
- Green: saveWords.matrix, claimEdit.matrix, editScreens.send and sessions.send pass: 220 passed, 2 skipped.
- `npm run lint`: 24 of 24 links pass. Whole-tree eslint is informational and red on main. eslint on the 2 touched files is clean. `tsc -p tsconfig.app.json` shows no errors in saveWords, SessionSheet, DetailsScreen or PricesScreen.
- F2 (the PR body) was the orchestrator's job, and its Phone QA section is present now. I left F3 and F5 alone, as the brief says.
- After the first push, PR #1278 `mergeable_state` was `blocked` (checks pending), not `dirty`.

### Not verified (fix round 1)
- Browser walk at 390x844 (the orchestrator's).
- CI on the final head (it was pending when I stopped).
