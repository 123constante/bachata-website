# Brief: weekly socials audit (READ-ONLY)

Owner words (2026-10-29): "weekly socials" = weekly recurring events on the calendar. Audit only; change NO code, NO data.

## Goal
Find out whether weekly recurring social nights show correctly to dancers on prod, and list every shape that misbehaves.

## Do
1. Prove the data source first: read the live RPC bodies and policies read-only on prod (Supabase project `stsdtacfauprzrdebmzg`) that feed the calendar and event page for recurring events. State which table/column holds the repeat rule and who writes it (see memory notes p5 vs legacy occurrence dates: event page reads legacy, calendar reads p5; they can desync, CI #25).
2. Survey shapes, counts only, no personal data: weekly series by status (live / ended / cancelled / draft) x next-occurrence present or missing x occurrences in the past only x more than 100 occurrences (API cap) x series with a cancelled single date.
3. For each shape say how the calendar, the event page and the organiser area each show it, and flag any disagreement (e.g. a live weekly night with no upcoming date, a date shown on one surface and not another, wrong weekday around the BST/GMT clock change on 2026-10-25).
4. Do not touch these files (calendar density exclusions): src/components/EventCalendar.tsx, src/components/calendar/*, src/hooks/useCalendarEvents.tsx. Read them only.

## Output
One docs-only file `docs/audits/weekly-socials-2026-10-29.md` on your branch: a table of shapes with counts, a list of findings ranked FIX FIRST / FIX LATER with the evidence query for each, and a Not verified section. Push early (checkpoint), then final push. Docs-only PR, no preview needed.

## Limits
Supabase read-only. Context cap per lane. Sonnet, normal lane.
