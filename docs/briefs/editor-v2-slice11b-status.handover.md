# Editor v2 slice 11b handover ("Pause, end or cancel" card + status sheets, Every tab)

## Built
- `v2/EndCard.tsx` (new): group "Pause, end or cancel", slim rows (52px / 8px 16px / 1px #E9E9E9 / 600 / 13px #696969 / chevron), rows per status exactly as the prototype; cancelled = static red row.
- `v2/StatusSheets.tsx` (new): `StatusSheet` (Pause the event? / End the event?, last-night date field, "Keep it <status>"), `CancelEventSheetV2` (built + tested, NOT mounted).
- `EveryBody.tsx`: mounts `EndCard`; `setLife` (ONE `series.set_lifecycle`, before `{to: old}`), `endDo`.
- `copy.ts`: `V2.every` lines. `everyStatus.test.tsx` (new, 15 tests). `every.test.tsx` line 46: "Pause, end" no longer asserted absent.

## Tap table
| # | Button | Destination | prototype/OLD |
|---|---|---|---|
| 29 | Make it live again | no sheet; set_lifecycle live; toast "Event is live again" + Undo | prototype |
| 30 | Pause the event | Sheet "Pause the event?" | prototype |
| 31 | End the event | Sheet "End the event?" | prototype |
| 32 | Cancel the event | row shown, tap NOT wired | NOT DONE (see below) |
| 82 | Pause the event (sheet) | closes; set_lifecycle paused; toast "Event paused" + Undo | prototype |
| 83 | End the event (sheet) | later date: set_recurrence until_date, stays Live, toast "Ends after <date>" + Undo (before = old rule); no date: `series.end_run` (+ `today_session` radio when a live date is today), toast "Event ended", no Undo | prototype |
| 84 | Keep it live/paused/ended | closes, nothing sent | prototype |
| 85 | Cancel the event (sheet) | sheet built, unreachable | NOT DONE |
| 86 | Keep the event | sheet built, unreachable | NOT DONE |

## Not buildable (exact)
- Cancel the whole weekly event: no `series.*` command sets lifecycle `cancelled` (`lifecycleCommand` takes paused|live|archived). Only `occurrence.bulk_cancel` (a `BulkCommand`, not a `WriteStep`; old editor uses it from flows/change/Pick.tsx per night set) exists. Needs a server command or an owner decision to use bulk_cancel over all upcoming ids. Row, sheet and tests are in place; wire `onCancel` on `EndCard` once decided. Consequently the cancelled static row/pill can only appear for events cancelled elsewhere.
- "Reason: <reason>" line: no workspace field for the series cancel reason found; `reason` is passed as null.

## Deviations
- `series.end_run` has no inverse in `inverseOf`, so "Event ended" (no date) carries NO Undo (brief asked Undo). Undo for Make-it-live/Pause from ended/cancelled sends `set_lifecycle to:'ended'|'cancelled'`, which the server probably refuses; shows the existing "Couldn't undo" text.
- Ended/cancelled -> live uses `set_lifecycle {to:'live'}` per brief; server acceptance NOT verified.
- "Tonight" question reuses old editor words ("Did tonight happen?", Yes, it ran / No).
- Slim-row styles are inline (v2.css not in the file list). Oneoff variants not built (card only on weekly Every tab).

## Files
EndCard 46, StatusSheets 68, EveryBody +34 (192), copy.ts +32, everyStatus.test 143.

## Verified / Not verified
- Verified: `npx vitest run src/modules/organiser/p3/v2` 19 files, 237 pass; tsc `-p tsconfig.app.json` 0 errors in p3/v2 besides pre-existing eventPage.proto.test.ts; eslint on my files clean; `check:mojibake` clean.
- Not verified: 390x844 walk, prod data-shape survey, live server acceptance of the transitions, pre-ship, /code-review. No PR (per brief).
