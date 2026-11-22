# Editor v2 slice 4 handover (Cancel and bring back a night)

## Built
- `v2/CancelNight.tsx` (94 lines): `NightCancelArea` (button + line, or line only for a cancelled event), `CancelNightSheet`, `BringBackSheet`, `SoldWarning`, `venueReasonLabel`. Sheets use `V2Sheet`; the cancel sheet mounts only when open.
- `NightCard.tsx` (+10): renders the area last in `.fb-list`; props `onCancelNight`, `onBringBack`, `soldCount`.
- `EditorV2.tsx` (+15): handlers call `saveNow(..., { noUndo: true })`. Weekly: `cancelCommand(reason)` / `uncancelCommand()` on the occurrence. One-off (`format === 'one_off'`): `cancelOneOffCommand(reason)` on the series (same as `eventPage.cancelEventCommand`). Bring back is always `uncancelCommand`.
- `copy.ts` (+15), `v2.css` (+14, under `.ev2` / `.ev2-sheet`), `__tests__/cancelNight.test.tsx` (151 lines). Two older tests got a `fetchCancellationReasons` mock line.
- A failed save keeps the sheet open and shows the error text in it; both sheet buttons are disabled while the call runs.

## Assumptions / blockers
- Reason label: "Venue not available" sends the reasons-list label matching it case-insensitively, else the FIRST label (unit-tested). Not checked against prod's list (read-only survey not run).
- BLOCKER (unverified): "No reason" sends `cancelCommand('')`. The builder accepts it; `selfServeErrors` shows the server wants "a cancellation_reasons label" for owners, so the server may refuse. Not run against a live server; if refused, the sheet shows the error and the radio is kept (prototype untouched). Same for the one-off path.
- Sold count: the workspace and `fetchDateDetail` carry no ticket count. `soldCount` prop is wired as 0 (default); slice 15 (money/tickets) supplies it. The warning component and plural are tested.
- The event's own cancellation reason is not in the workspace, so the whole-event line omits " Reason: ...". Night reason comes from `fetchDateDetail().cancellationReason`.
- Chip tag and pill "Cancelled" come from slice 3 (pill covered by existing test).

## TAP TABLE
| # | Button | Destination | prototype/OLD |
|---|---|---|---|
| 13 | Cancel this night | sheet "Cancel <date>?" | prototype |
| 14 | Bring this night back | sheet "Bring <date> back?" | prototype |
| 70 | Cancel this night (sheet) | closes; cancelled with picked reason; toast "Cancelled <date>", no Undo | prototype |
| 71 | Keep this night | closes, nothing saved | prototype |
| 72 | Bring it back | closes; live; toast "Brought back <date>", no Undo | prototype |
| 73 | Keep it cancelled | closes | prototype |

## Verified / Not verified
- Verified: `npx vitest run src/modules/organiser/p3` 181 files pass; tsc --noEmit: 0 errors.
- Not verified: 390x844 browser walk, prod shape survey, prototype pixel match, `pre-ship`, server acceptance of an empty reason, no PR opened (brief says none).
