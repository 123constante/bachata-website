# Editor v2 slice 11a handover (Repeats + Change repeat? sheets, Every tab)

## Built
- `v2/RepeatSheetV2.tsx` (new): "Repeats" sheet (select of 7 full weekday names, date field "Last date (leave empty for no end date)", Done) and, when needed, "Change repeat?" (text, one row per lost night: long date + Cancelled/Changed, danger solid "Change repeat", secondary "Keep the current repeat").
- `EveryBody.tsx`: row `repeats` opens it; `lostFor` (upcoming nights tagged cancelled/changed by `dateTagOf` that the new weekday / end date would not produce); `saveRepeat` = ONE `series.set_recurrence` step (`dayChangeCommand` + `end` until_date / none) via `saveNow([step],[oldRule],'Saved')`.
- `copy.ts`: `V2.every` repeat lines. `every.test.tsx`: "pending rows" test no longer lists Repeats.
- `__tests__/everyRepeats.test.tsx` (new, 9 tests).

## Checklist
- [x] SH-REPEAT-01..09  - [x] SH-REPEAT-10 (see below)  - [x] Row opens sheet; value line unchanged

## Tap table
| # | Button | Destination | prototype/OLD |
|---|---|---|---|
| 26 | Repeats row | Sheet "Repeats" | prototype |
| 78 | Done | closes + toast "Saved" (Undo); or sheet "Change repeat?"; no change = closes, no save | prototype |
| 79 | Change repeat | sheet closes; toast "Saved" | prototype |
| 80 | Keep the current repeat | sheet closes, nothing saved | prototype |

## Deviations
- `before` passed to `saveNow` is the OLD RULE OBJECT itself (`{mode, weekdays, end, ...}`), not `{recurrence_rule: rule}` as the brief wrote: `inverseOf` for `series.set_recurrence` requires `before.mode`, so the brief's shape would give no Undo.
- "Removes the lost nights' changes": the server's `series.set_recurrence` is the authority; no separate step is sent (brief: ONE step). Rows listed are what the sheet warns about.
- Current weekday comes from the rule (`ownerWeeklyRule`), falling back to the `day` prop.
- Past last date shows the existing `lastDatePast` line; cap uses `endWithinCap` with new line `repeatCap` (same words as `eventModel`).
- Date field is a native `<input type=date>`; wrong weekday disables Done and shows `lastDateWeekday`.

## SH-REPEAT-10
`EditorV2` derives `day` from the picked upcoming night's weekday, so tab label / title / scope / hints / toasts follow the new weekday once the post-save refetch returns regenerated dates. NOT edited (outside EveryBody's chain); NOT verified in a browser. The toast says "Saved" as briefed.

## Not buildable
- When / Price / status end-card remain pending, as briefed.

## Files
RepeatSheetV2 70, EveryBody 156 (+21), copy.ts +8, everyRepeats.test 109.

## Verified / Not verified
- Verified: `npx vitest run src/modules/organiser/p3/v2` 18 files, 222 pass. tsc `-p tsconfig.app.json`: 0 errors in p3/v2 files besides pre-existing eventPage.proto.test.ts. eslint on my files clean. `check:mojibake` clean.
- Not verified: 390x844 walk, prod data-shape survey, weekday-change refetch (SH-REPEAT-10) live, pre-ship, /code-review. No PR (per brief).
