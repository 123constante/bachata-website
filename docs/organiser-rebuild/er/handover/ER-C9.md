# ER-C9 handover: one date and bulk

Branch `claude/er-c9-dates` from `claude/er-wave1`. Touches only `src/modules/organiser/dates/**` (plus this doc and `parked/ER-C9.md`).

## Built
- `dates/dateChanges.ts` (pure): `shiftRows/firstStart/shiftOptions` (time shift of ALL sessions), `copyRowsFrom/copySources` (copy changes from another coming date), `ownTag` ("Own changes" venue or date-only session; "Own times" time differs from usual), `cancelWords` (one_off says "Cancel the event"), `moveDayProblem`.
- Date page: "Night starts" row (shift sheet), "Day" row for a one-off (move to another day, saved with the rest via `occurrence.move_date`), "Add a session to this date", "Copy changes from another date", venue row as before. The ONE primary button is now "Save this date" (was "Save changes"); one save sends move, then venue, then programme, with fresh versions between.
- Cancel keeps the server reason list (chips, no free text, ack tick) and stays visible as Cancelled; "Take this date off" unchanged (rule dates only). Edits here use date-level commands only, so they never touch the series' "Update live event".
- Line-up per session uses the existing date session sheet; C4's `SessionCard` was NOT swapped in (parked below).
- Bulk cancel/move live in `flows/change/**` (outside this slice) and were not touched; their tests pass unchanged.

## Verified on real data
Read-only prod survey (`stsdtacfauprzrdebmzg`, `event_occurrence_p5`, date >= today, counts only): recurring scheduled 1776, recurring cancelled 51, course scheduled 19, festival scheduled 6, one_off scheduled 3. Tests cover: one-off, recurring, festival-day, cancelled, past, locked (shapes from `__tests__/shapes`), shift +-minutes, untimed session, wrap past midnight, reason list exactly the 5 server labels, no free text, reason + tick required, move day validation, copy replaces, untouched sends nothing.
Not surveyed: dates with their own venue/sessions (`event_occurrence_p5` has no venue column; override lives elsewhere), so `ownTag` is tested on constructed shapes only.

## Phone QA (390x844)
NOT DONE: no browser walk against prod-shaped data in this sandbox (needs a signed-in organiser session). Sizes are explicit px (44-52px rows, 48px fields).

## Checks (sandbox)
| Command | Exit |
|---|---|
| `npx vitest run src/modules/organiser` (128 files, 3669 tests incl. 28 new) | 0 |
| `npx tsc --noEmit -p tsconfig.app.json` (errors in organiser/dates) | 0 |
| `npx eslint src/modules/organiser/dates` | 0 |
| `npm run build` | 0 (built) |
| `npm run lint` chain (output filtered for fail/exit: none printed) | no failure line |
Not run: e2e smoke, `check:og`, real phone, server round trip (end-to-end NOT verified).

## Left / parked
See `parked/ER-C9.md`. Open: swap the date session sheet for C4's `SessionSheet` (needs a stored-session <-> `SessionDraft` mapping that C4 left undone); Own-times has no wire field.
