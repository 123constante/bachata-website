# p3-dates-fix-1 — INVENTORY (written before any edit)

Paths are under `src/modules/organiser/p3/`. "Today" = main at 5d20065.

## The read, proven (prod `stsdtacfauprzrdebmzg`, read-only `pg_proc` SELECT, 2026-11-04)

`admin_event_workspace_p5(p_series_id uuid, p_before date DEFAULT NULL, p_limit integer DEFAULT NULL)`.
- Page: `occurrence_date < p_before` when given, newest first, `LIMIT COALESCE(p_limit, 100)`; `p_limit` 1..200 else `invalid_input`.
- `meta.has_more` = a row exists past the page; `meta.next_before` = the oldest date on the page while `has_more` (else null);
  `meta.total` / `meta.counts` are whole-series, independent of the page.
- **So the server CAN page.** The honest fix for W-31 is a real "Show older dates" that calls it again with
  `p_before = next_before`, not a "ask the team" line. No admin-repo note needed.
- Today the website calls it with `p_series_id` only (`shared/runCommands.ts:17`), so only the newest 100 ever load.

## Dates screen (`screens/AllDatesScreen.tsx`)

| # | State | Shown today (file:line) | Must offer |
|---|---|---|---|
| 1 | Loading | WorkspaceGate "Loading the event…" (`screens/EventPage.tsx:271`) | unchanged (nothing to do yet) |
| 2 | Read error | "We couldn't load this event" + Try again (`EventPage.tsx:284`) | unchanged |
| 3 | Not yours / not found | NotYoursCard / "We can't find this event" + link (`EventPage.tsx:274-281`) | unchanged |
| 4 | 0 dates, any tab | empty copy per tab (`AllDatesScreen.tsx:57`, `data/dates.ts:104`) + Add / why | unchanged; no older-dates control (nothing hidden) |
| 5 | 1 date, each tab | the row or the tab's empty copy | unchanged |
| 6 | 99 dates (has_more false) | every row, no partial line | unchanged |
| 7 | 100 dates exactly (has_more false) | every row, no partial line | unchanged (server says nothing past the page) |
| 8 | 101 dates (has_more, total 101) | "This page lists the newest 100 of 101 dates." (`AllDatesScreen.tsx:47`, `data/eventPage.ts:120`), **no way to the 1 older** | the line + **"Show 1 older date"** |
| 9 | 132 dates (W-31) | "newest 100 of 132", tabs Coming 96 / Past 4 / Cancelled 3; **32 dates unreachable** | the line + "Show 32 older dates"; after it, all 132 listed and openable, line gone |
| 10 | 500 dates | "newest 100 of 500"; 400 unreachable | "Show 100 older dates", repeated (100 → 200 → … → 500), line counts up |
| 11 | has_more but no total (older read) | "…newest 100 dates; older ones are not shown." | the line + "Show older dates" |
| 12 | Older dates loading | n/a | button busy "Loading older dates…", disabled |
| 13 | Older dates failed | n/a | plain error "Older dates didn't load. Check your connection, then try again." + the button stays as the retry |
| 14 | Every tab (Coming / Past / Cancelled / Breaks / Own) while dates are hidden | the line only, on every tab | the line and the button on every tab (any tab can be missing hidden rows) |
| 15 | An older date opened | n/a (not reachable) | its date sheet, editable like any other (older pages refresh with the workspace after a save) |

## Date field sheets (`screens/DateFieldSheets.tsx` Name / Photos / Price; `screens/DateSheet.tsx` About / Ticket)

| # | Save outcome | Shown today (file:line) | Must offer |
|---|---|---|---|
| 16 | Untouched | Save disabled "Nothing changed yet" (`DateFieldSheets.tsx:68-69`) | unchanged |
| 17 | ok | toast, sheet closes (`DateSheet.tsx:53`) | unchanged |
| 18 | refused (other error, e.g. invalid_input) | plain error, Save enabled, typing kept (`DateFieldSheets.tsx:66`) | unchanged: fix and save again is the next action |
| 19 | offline / network | plain error, Save enabled (retry, same keys) | unchanged: Save is the retry |
| 20 | **version_conflict (W-35)** | "Someone changed this first. Check it." + typing kept + **Save still enabled** and no way to pick up the change (`DateFieldSheets.tsx:66-68`, `shared/copy.ts:14`) | Save **disabled** with the reason; a **"Start again"** button that re-reads the date and the event, drops the stale version, shows the value as it is now |
| 21 | After Start again | n/a | the new value in the field; the person's typing offered back in plain words: "Put my changes back" / "Drop my changes"; Save works again |
| 22 | Start again fails (offline) | n/a | plain error, Start again stays as the retry, Save stays disabled |
| 23 | About / Ticket conflict (`DateSheet.tsx:305-325`) | same dead end as 20 | same Start again path |

Coverage: 23 rows, 23 shown, none omitted.
