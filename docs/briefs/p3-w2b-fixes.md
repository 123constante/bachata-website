# Brief: P3 W2b FIX ROUND for PR #1062 (branch `claude/p3-w2b-dates`) -- 2026-10-27

Independent review (Fable, read-only): `git fetch origin claude/review-1062-r1` then `git show FETCH_HEAD:docs/reviews/1062-r1.md`. Read it fully FIRST. Work on the existing branch `claude/p3-w2b-dates` and PR #1062 (no new PR). Normal lane, no DB write (Supabase read-only), one push at the end (earlier pushes end `[skip preview]`).

## Fix, in this order, RED FIRST (write the failing matrix/test row, see it fail, then fix)
1. **BLOCKER (finding 1):** the commit b37f588 rewrote 351 PNGs outside this slice. Restore EVERY file outside `docs/handover/p3-w2b-dates/` (and outside the W2b source/test/design files) to main's blob: `git checkout origin/main -- <paths>`. Prove it: `git diff --stat origin/main...HEAD` lists only W2b files, no binary outside `docs/handover/p3-w2b-dates/`. Do not run any image tool over `docs/` again.
2. **Finding 2:** `model/dates.ts` unskip must be greyed at the date cap (`DATE_WHY.cap`) like Add and Bring it back. Add the matrix row (weekly, live, upcoming 30, break on the cadence).
3. **Finding 3:** drop the series-wide `hasSessions` grey on "Change the time" (the server creates the date's own time session when the series has no timed item); keep the `no_sessions_for_time_override` refusal copy. Update the matrix and the copy so nothing points at "Add a session first".
4. **Finding 4:** enable "Cancel this date" on a festival date (the server takes `occurrence.cancel`; owner rule is only set_time and move_date refused). Same sheet and command as a recurring cancel. Update matrix and the design-record table.
5. **Finding 5:** a recurring series with NO stored rule must not tag every date "Not the usual day" nor say skip is off the weekly pattern: treat it like `custom` in `dateMarks` and the skip reason. Matrix row `format recurring, recurrence_rule null`.
6. **Finding 6:** All dates empty states: "Coming" takes `addWhy` the way the event page does; "Breaks" gives the kind-specific reason (no "skip a week" for kinds that cannot skip).
7. **Finding 7:** key the `KeyRing` on `occurrenceId` + the command list WITHOUT the version, so a retry after a dropped-but-committed response replays instead of making a second write; keep the sheet from vanishing under an error (a committed skip). Add a test: first attempt commits, response lost, retry sends the same key.
8. **Finding 8:** add a `COMMAND_COPY` row for `invalid_payload: date_time_session_has_people`, and when the composite's SECOND call fails say the details went back and the time did not.
9. Findings 9 (`has_bookings` copy says "removed" for skip: make the skip wording say "skipped" if the copy is shared and a one-word change is safe) and 10 (breaks on non-weekly series invisible) are NITS: fix 9 only if trivial; for 10 write the known limit into `docs/design/1062.md` and the PR body Not verified.

## Then
Re-run the walk spec for the states you touched (390x844 light + dark; measured: taps, sideways scroll, clipping, contrast) into `docs/handover/p3-w2b-dates/` (replace only the touched PNGs, no mass rewrite). Run the organiser unit suite with `--maxWorkers=3` and the CI job steps you can (read `.github/workflows`; separate passes if memory kills). Update the PR body: per-job table, `## Verified on real data` (`- Shapes surveyed:` / `- Checks run:` / `- NOT verified:`) and `## Phone QA` (`- Sizes checked:` / `- Walked:` / `- Not verified:`) keep EXACTLY those headings. Add a "Review round 1" note listing each finding and fixed / not fixed + why.

## Do NOT
Touch anything outside P3 W2b (`src/modules/organiser/p3/**`, its tests, `shared/selfServeErrors.ts`, its docs). No scope growth (no sessions, no per-date name/music/photos/price, no remove-date: organisers never delete a date, owner answer 20). No DB write. Do not touch other arcs' docs or images.

## Done =
Pushed once; final commit subject ends with the done marker from your prompt (no `[skip preview]` on it); `git diff --stat origin/main...HEAD` clean of foreign files. Stop at 50% context with PARTIAL.
