# Brief: weekly socials walk (READ-ONLY, follow-up to the audit)

Audit already done: branch `claude/weekly-socials-audit`, file `docs/audits/weekly-socials-2026-10-29.md` (read it first: `git fetch origin claude/weekly-socials-audit` then `git show FETCH_HEAD:docs/audits/weekly-socials-2026-10-29.md`). Its "Not verified" list is your job. Change NO code, NO data.

## Do
1. Read the live body of `event_view_p5` (read-only, Supabase connector, SELECT / pg_proc only) and say which table/column each field on the event page comes from. Compare with what `get_calendar_events_v2` returns for the same series.
2. Pick ONE real series for each of these shapes from prod (counts and ids only, no personal data): live weekly with a cancelled date; live weekly with 100+ dates (the 132-date one); weekly paused; weekly draft; the series with a date off its rule weekday (131c7d97...); a live no-rule series with only past dates.
3. For each, fetch the public event page over HTTPS (https://www.bachatacalendar.co.uk/event/<id>, plain `curl`/fetch, text only) and report: does the page render, which next date does it show, does it agree with the calendar RPC for the same series, anything that says the wrong weekday or time.
4. Finish the audit's un-read parts: read the rest of the `get_calendar_events_v2` body (the derived and output CTEs).
5. Do not touch the calendar density-exclusion files (EventCalendar.tsx, components/calendar/*, useCalendarEvents.tsx). Read only.

## Output
Append a section "Walk results 2026-10-29" to `docs/audits/weekly-socials-2026-10-29.md` on branch `claude/weekly-socials-walk` (docs only). Table: shape, series id, calendar says, page says, agree?. Then FIX FIRST / FIX LATER additions and an honest Not verified (no phone browser, so say that).

## Limits
Supabase read-only. Sonnet, normal lane. Push once at the end, subject ending `[worker-done <ticket>]`.
