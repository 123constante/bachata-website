# Fix brief F-S2 -- one fix pass on slice S2 (Change a date) after the independent review

Repo `123constante/bachata-website`, branch `claude/org-r1-change` (EXISTS, head `0798541`; you are the ONLY worker on it), base `feat/organiser-r1`. You are the author's fix worker, not a reviewer. Plain git only (no `gh api`); write shell commands without variables, loops or `$(...)`; check a PRODUCTION build (`npm run build`). READ FIRST: `00-COMMON.md` next to this file with `<X>` = F-S2, `S2-change.md`, `docs/organiser-rebuild/handovers/S2.md` on your branch, and the FULL review: `git fetch origin claude/org-r1-review-S2` then `git show FETCH_HEAD:docs/organiser-rebuild/reviews/REVIEW-S2.md` (rulings 1-4 are all CORRECT/ACCEPTABLE: do not change the `useOwnerCommand` route, the kept line-up editor, the C5 time source or the Done wiring).

## The failures the reviewer found
B1: the untouched-Save test cannot fail (checks the spy before the async send lands). B2: nothing pins "a retry reuses its idempotency key". S1: Venue `save()` can fail with nothing on screen. S3: C3 stops at 14 dates while 30 of 67 live series have more (max 59).

## Owner decisions (2026-10-16, click answer): C3 uses an "N more" row, NOT a higher limit
C3 shows the first 14 dates, then ONE row `N more` (N = the remaining coming dates; label is just the number and word, no sentence, D28) that expands the list in place to the full workspace list. Use the existing `moreDatesCount` in `dateList.ts`. Add test rows for 14, 15 and 59 dates: the 15th is reachable, the row shows the right N, tapping expands, a past/cancelled date is still refused after expanding, the row is >= 44px.

## Do (files: `flows/change/**`, its tests, `docs/organiser-rebuild/handovers/S2.md`)
1. **B1.** Flush before every `toHaveLength(0)` in the untouched-Save tests (time and venue): `await new Promise((r) => setTimeout(r, 50))` or equivalent. RED first: apply mutant (b) (`parts.tsx` `if (ready && !busy)` -> `if (!busy)`), show the test RED, revert, show green.
2. **B2.** Test: first `occurrence_command_p5` returns a non-conflict error, Save again, assert two calls with the SAME `idempotency_key`. Show mutant (g) (`useChange.ts` key -> `undefined`) RED.
3. **S1.** Wrap the body of `Venue.tsx` `save()` in try/catch and show `commandErrorMessage(err)` through the same `error` line. Test: `venueOverridePatch` throws -> the message is on screen and Save comes back.
4. **S3.** The "N more" row above.
5. **N1.** Drop the dead `needsDetail` prop. **N2.** A paused/ended series reached by URL on C3 shows the `dateLock()`-style refusal with the Other-dates/Home button, not "No coming dates". Test it.
6. **S2 (move_date).** Do NOT hide the row. Add one line in the handover: C5c needs A1a (`occurrence.move_date`) on prod; hard deploy gate, the orchestrator records it in the merge train.
7. **B3.** Do NOT edit `home/`. The orchestrator merges S1 before S2 (S1 removes the line-up strip). Say so in the handover.
8. Do NOT touch anything else, no protected file.

## Tests and CI (shown, not claimed)
`npx vitest run src/modules/organiser/flows/change src/modules/organiser/dates src/modules/organiser/shell`, `npm run build`, `npm run check:mojibake`, `npm run lint:architecture`, `npm run lint` (`check:integrity` exit 126 is environmental). Per-job table with exit codes in the handover. GitHub Actions refused with a payments annotation is not a code failure.

## Output
ONE push of `claude/org-r1-change` at the end (Vercel deploy cap). Last commit subject ends `[worker-done <ticket>]` (or `PARTIAL [worker-done <ticket>]` at 25% context; a continuation worker is normal and reads `handovers/S2.md`). Report head SHA and a Verified / Not verified.
