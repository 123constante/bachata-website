# ER-C8 handover: event page (series level)

Branch `claude/er-c8-eventpage` from `claude/er-wave1`. Server NOT landed (AD1): `payment_methods`, extended go-live check, invites are faked in tests.

## Done
- `events/eventPageModel.ts` (pure, the one mapping): `updateLabel`, `scopeLine` ("Updates 12 coming dates. 2 dates with their own changes keep them."; one-off "Updates this date."), `pendingParts`, `pageCommands` (only what changed; untouched = []), `draftChecklist`/`publishBlocker`, `payNudge`/`paymentOf`, `pageActions` (status x format x owner), `stopAfterCommand`, `applySessions`/`sessionsOf` (stored programme <-> C4 `SessionDraft`).
- `events/EventPage.tsx`: title pencil + rename, phone-only orange Edit bar, status tag, draft checklist + Publish (off with the first missing thing), live "Update live event" / paused "Save changes" dock with scope line, Discard, update-failed message with Try again, leave-with-pending sheet, sessions list + "+ Add a session" (C4 `SessionSheet`), coming dates (Own changes / Cancelled tags) + always "+ Add a date", flyer row, venue via `VenuePicker` (C5), how to pay chips (festival: ticket link only), description / music-style chips / photos / video (EditorSheet), "Add how to pay" nudge, Stop repeating = pick the last night, Delete draft (draft only), See it live, ended/archived read-only with the sentence.
- `OneEvent.tsx`: with the rebuild switch ON renders `RebuiltEvent` (loading, not-found split via `useOrganiserSeries` + `notFoundText`, error with Try again). `?do=` steps (pause, resume, end) still use the old step screens. Switch OFF = old page unchanged.
- Removed: `DatesTakenOff.tsx`, `takenOff.ts` (+ matrix test), the Details Time row and time/instagram detail fields, `ProgrammeSheet` time inputs (now start/end lists from C4's `startOptions`/`endOptions`), price list + usual-end helpers in `seriesExtras.ts`. Ratchet `eventRules.nofield.test.ts`: `events/ProgrammeSheet.tsx` line removed (4 offenders left, none mine). Old tests for removed things deleted; parity row C14 now DROPPED-BY-DECISION.
- `payment_methods` is read in `parseEventWorkspace` (null until the server returns it; a stored ticket link counts as ticket_link).

## Left / next
- Browser walk at 390x844 (see below) and screenshots.
- Festival blocks (C10), co-organiser leave/remove (invites slice), series_organisers_v1 owner detection.
- Old Details/Programme/Organisers screens stay until the switch is `*`.

## Verified on real data
Read-only survey of prod `stsdtacfauprzrdebmzg`, `event_series_p5` (counts only): live 67 (course 6, festival 7, one_off 10, recurring 44); live recurring 44 of which 35 have a recurrence rule, so Stop repeating is offered only when a rule exists (found by the survey, fixed); live with no ticket link 16 (course 4, one_off 3, recurring 9) = the "Add how to pay" nudge set; paused 2, draft 2 (1 one_off, 1 recurring without cover), ended 21, archived 653. Tests cover these shapes: every status x format in `er-c8.page.test.tsx` / `er-c8.model.test.ts` (85 tests).

## Phone QA (390x844)
NOT DONE. The page needs a signed-in organiser session and the sandbox has none; no screenshots. Sizes are explicit px (44px targets).

## Checks run in the sandbox
| Command | Exit |
|---|---|
| `npm run build` | 0 |
| `npx vitest run src/modules/organiser` | 0 after fixes (first run: 3 failures from my own changes, fixed: D22 StatusTag ban, focusReturn site list) |
| `npm run lint` chain | 19/20 pass; `check:integrity` 126 (exec bit missing); `bash bin/check-integrity.sh` 0 |
| `npx eslint` on changed/new files | 0 (events/__tests__/sw1.parity.test.tsx has 10 old `any` errors, not mine) |
| `npx tsc --noEmit -p tsconfig.app.json` | none in organiser except old TeamPicker / NewPageFlow tests |
Not run: full-repo `test:unit`, e2e smoke, `check:og`, real phone.

## Verified / Not verified
Verified: model + rendered page in jsdom over status x format x pending (untouched sends nothing, one-date vs series count, no time input, owner-only actions). Not mutation-tested. NOT verified: browser walk, real phone, any server round trip (payment_methods, set_program from the page, stop_repeating from the sheet), ending/pausing through the old step screens from the new page.
