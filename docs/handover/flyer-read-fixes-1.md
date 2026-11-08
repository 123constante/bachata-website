# Handover: flyer reader fixes 1 (N1, N2, N3, N5, N4, D4)

Brief: `docs/briefs/flyer-read-fixes-1.md` on `brief/flyer-read-fixes-1` (sha e4239889, Brief-version 2). Branch `claude/flyer-read-fixes-1` from `main` a6a156c. PR #1501.
Code commit: c4e6c57 (the head SHA is the commit that adds this file; see the PR).

## Done
| Item | Fix | Test (grep) |
|---|---|---|
| N1 HIGH | `flyerToDraft.ts`: printed date always kept, also on weekly/monthly, with its weekday and nth; past printed date not moved, doubtful, `past_date`; a date computed from a weekday is doubtful; monthly nth from `recurrence_text` (1st..4th, `last <weekday>`; two weeks = no guess); weekday-only monthly with no nth = no date + `no_date`; printed date whose weekday or nth disagrees with the flyer = doubtful | `printed date kept on repeating` (flyers 1, 4, 5, dated past weekly, dated past monthly, future monthly, last Friday, no nth, mismatch); fixture rows 1, 4, 5 updated (row 5 now carries `recurrence_text`) |
| N2 MEDIUM | `cleanText` strips bare domains with a known TLD (lowercase or all-caps, plus path), tidies leftover punctuation; `Night.Live`-style OCR text kept; ticket link field path unchanged | `bare domain stripped` |
| N3 MEDIUM | `FlyerStart.tsx` attempts-limit card: "Too many tries today. Back <London reset time>." else "Back tomorrow." | `attempts limit back tomorrow`, `attempts limit back at the reset time` |
| N5 LOW | unknown currency = no row + `price_currency` note; symbols and words map to GBP/EUR/USD | `unknown currency no row` |
| N4 LOW | fixture row 7 = course, no date, no venue (not enough); course-with-venue shape kept as its own test; P4 render test | `no page entry never mounts`, row `7 course, no date, no venue (not enough)` |
| D4 LOW | `flyer_read_saved` in `AnalyticsEventMap` (`src/lib/analytics.ts`); cast removed in `useFlyerRead.ts` | tsc |

Left alone per brief: D3, D6, D8.

## Red-first evidence
New/changed tests run on unfixed main (tests only applied): 15 failed, 64 passed (79):
- flyerStart.render.test.tsx > each reader answer has its screen and a way forward > attempts limit back tomorrow
- flyerStart.render.test.tsx > each reader answer has its screen and a way forward > attempts limit back at the reset time
- flyerToDraft.matrix.test.ts > flyerToDraft.matrix > '1 weekly Saturday, full address'
- flyerToDraft.matrix.test.ts > flyerToDraft.matrix > '4 weekly Wednesday, 2 rooms, ends 01:…'
- flyerToDraft.matrix.test.ts > flyerToDraft.matrix > '5 monthly first Saturday, no venue, 1…'
- flyerToDraft.matrix.test.ts > flyerToDraft.matrix > N1: printed date kept on repeating flyers > flyer 5 (monthly 1st Saturday, no date): next 1st Saturday, rule nth 1, marked doubtful
- flyerToDraft.matrix.test.ts > flyerToDraft.matrix > N1: printed date kept on repeating flyers > flyers 1 and 4 (weekly, no date): computed date is doubtful, rule on the printed weekday
- flyerToDraft.matrix.test.ts > flyerToDraft.matrix > N1: printed date kept on repeating flyers > a dated past weekly keeps the printed date, doubtful, "this date has passed"
- flyerToDraft.matrix.test.ts > flyerToDraft.matrix > N1: printed date kept on repeating flyers > a dated past monthly keeps the printed date and its nth
- flyerToDraft.matrix.test.ts > flyerToDraft.matrix > N1: printed date kept on repeating flyers > a dated future monthly keeps the printed date, not doubtful
- flyerToDraft.matrix.test.ts > flyerToDraft.matrix > N1: printed date kept on repeating flyers > a "last Friday" monthly builds a last-week rule
- flyerToDraft.matrix.test.ts > flyerToDraft.matrix > N1: printed date kept on repeating flyers > a monthly with a weekday but no week of the month sets no date (never a guessed nth)
- flyerToDraft.matrix.test.ts > flyerToDraft.matrix > N1: printed date kept on repeating flyers > a printed date on a different weekday from the printed weekday is doubtful
- flyerToDraft.matrix.test.ts > flyerToDraft.matrix > bare domain stripped from flyer text; the ticket link field is unchanged
- flyerToDraft.matrix.test.ts > flyerToDraft.matrix > unknown currency no row

Passed on main as expected (coverage gaps, not bugs): `no page entry never mounts`, fixture row 7 (contract shape).
After the fix: 210 of 210 in `p3/new`, 6557 in `src/modules/organiser/p3`.

## Checks run locally
- tsc run on c4e6c57: 0 errors in branch files (0 errors in the whole project).
- `npm run lint`: 34 of 34 links green (trailing whole-tree eslint informational); eslint on the 7 changed files: clean.
- `npm run test:unit`: 28746 pass, 15 fail in 4 files (`eventViewCompat.contract`, `integrityCouldNotRun`, `occurrenceProgram.contract`, `publicEventPageLineup.contract`): the same 15 fail on main with no changes (live DB / env in the sandbox).
- `check:mojibake`, `check:integrity`: ok. PR body: `check-pr-real-data-verified` 0, `check-pr-phone-qa` 0.
- `/code-review` (medium) run before commit; fixed: currency symbols, nth parsing ("last entry", two weeks), case-sensitive domains, leftover punctuation, reuse `firstDateFits`, dead code, row-7 coverage.

## CI per job (PR #1501, at the code push c4e6c57, when this was written)
| Job | State |
|---|---|
| decide, route, live-db-gate, masking-check, dancer-area-isolation, no-preview-reason | success |
| contract-check, integrity, build-smoke, e2e-smoke, bundle-budget, unit (America/New_York), phone-qa (2)/(3), bom-check, notification-check, phone-qa-section, real-data-verified | in progress |
| lighthouse, seo-*, og-*, synthetic*, doc-weight, enable | skipped |
The final push re-runs everything; read the PR checks for the result.

## Not verified
- No 390x844 browser walk (attempts-limit card copy, doubtful firstDate marks on the pre-filled form).
- `npm run pre-ship` timed out at 300 s in the sandbox; e2e suites not run locally.
- No prod shape survey: the feature is off, so prod holds no reader output.
- Live model output on real flyers; real venue matching.
- Known small edge (review finding, not fixed): a "last <weekday>" rule set to nths [-1] on a date that is also the 4th weekday no longer matches `withFirstDate`'s auto-follow signature, so if the organiser changes the first date the rule stays as set instead of following. Fix would live in `model.ts` (`autoRepeat`), out of the brief's file list.
- A ticket link printed as a bare domain (no `www.`/`http`) still gives no ticket link (brief: ticket link path unchanged).

## Next
- Watch PR #1501 checks; walk at 390x844; then the remaining blockers in the review (slice 1 evidence, gate E3 walk).
