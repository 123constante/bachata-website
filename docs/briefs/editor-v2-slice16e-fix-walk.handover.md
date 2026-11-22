# Handover: Editor v2 slice 16e (fix the failing walk rows, un-fixme)

Branch claude/editor-v2-s1c. No PR (brief). Tests only: spec + `organiserFake.ts`. No `src/` change, flag stays OFF, no migrations.

## Result (390x844, `organiser-editor-v2.spec.ts`)
Full run before the last two row fixes: 109 pass / 2 fail / 4 skipped. The 2 fails (rows 48, 62) were then fixed and re-run alone: both pass. So expected full run: **111 pass / 0 fail / 4 skipped (+1 fixme X-09 door fact)**. A single full re-run after the final edit was not repeated (see Not verified).
Skips, all `test.fixme` with reason: row 58 (fake has no flyer), row 36.1 (move_date has no Undo), row 83.1 (End the event, no date: `series.end_run` has no inverse, `editorModel.ts` `inverseOf`), X-09 door fact (below).

## BUILT UI DIFFERS
- X-09 door: the night Price fact never reads "Pay at the door". `NightCard.tsx:95` calls `priceLabel` without `doorPrice`, so `Facts.tsx:16` is unreachable from the night. Fact assertion is `test.fixme`; a separate test walks the door Price sheet and Tickets screen.
- Row 48 Remove this one: after Remove the session sheet closes back to the stacked When sheet (it does not close everything). Spec now asserts the When sheet stays with one session left and the Saved toast has Undo.
- X-06: the Repeats row reads `series.ended_on` (`EveryBody.tsx:90`), not the rule's end. Spec seeds `ended_on`.
- Row 56: built shows Change the link on a one-off only; row rewritten to run on a one-off with a link (new state `oneOffLink`).

## Fixed in spec
X-06 (seed `ended_on`), X-12 (the When row now opens the Classes and party sheet, so the first tap is sheet-scoped), X-12c (Add a link via Change how dancers pay), X-13 (fake answers `organiser_raffle_nights_v1`, so the hub Raffle pill reads Off), rows 21/40/41/42 (17a built Classes and party), row 39 (state `ownTime`: night 9 Oct starts 19:00), row 83 later-date path (End with last night 2026-12-25, toast Ends after + Undo), row 62 (video URL needs a real 11-char YouTube id).

## Fixed in fake
`night_start` (own start time per night, read as `materialised_start_utc` and schedule), `night_gallery` (written by `occurrence.set_override {gallery}`, read back as `event.gallery_override`).

## Tap table `built` column
prototype for every passing row. FIXME: 58, 36.1, 83.1, X-09 door fact. Row 56 prototype (one-off). Row 83 later-date prototype, no-date OLD (no Undo).

## Verified / Not verified
Verified: spec counts above; `npm run check:mojibake` clean; `npm run check:e2e-spec-coverage` OK; OLD-URL guard untouched on every tap; other organiser specs re-run (result in the final report).
Not verified: one more full run after the row 48/62 fix; `npx tsc` result if not stated in the final report; real-data survey (tests only).
