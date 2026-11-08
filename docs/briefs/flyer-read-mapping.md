# Brief: Flyer reader: pure flyerToDraft mapping and matrix tests (no screen)
Brief-version: 2
Branch: claude/flyer-read-mapping
Lane: normal, Sonnet. Repo 123constante/bachata-website. One PR.

## Goal
Add the pure, tested function that turns what the flyer reader returned into a P3 New event draft, with the list of doubtful fields and a tick list of sessions. No screen, no network, no flag in this slice (the screen is slice 3, `claude/flyer-read-screen`). Slice 1 (admin repo, `claude/flyer-read-fn`) defines the response format; this slice carries a typed copy of it.

## Context (owner clicks 2026-11-07/08; plan ~/.claude/plans/resilient-wishing-crab.md)
The New event screen on main is the P3 `CreateFlow` (src/modules/organiser/p3/new/): the organiser picks a KIND (`CreateKind`: one_date, weekly, monthly, course, workshop, festival, class_party, online, other_dates), then fills a `CreateDraft` (name, venue, firstDate, repeat, extraDates, sessions, prices, ticketUrl). The reader pre-fills that draft; nothing is saved until the normal save; the draft is never created by this code. Times live on SESSIONS (the create never sends a series time: read the header comment of model.ts). Teacher/DJ linking, description, category and cover are NOT in this function.

## What main lacks
- Nothing maps a flyer read (kind, dates, times, venue text, sessions, price, ticket link) into a P3 CreateDraft plus a doubtful-field list and a session tick list. -- grep: flyerToDraft
- No typed copy of the event-flyer-read response format exists on the Website, so a screen cannot be built or tested against it. -- grep: flyer_read_shape_v1
- No table-driven matrix covers flyer shapes (weekly, class+party, multi-event, past date, no venue, midnight end, festival range, not_enough, price tiers, Spanish date). -- grep: flyerToDraft.matrix

## Files
- src/modules/organiser/p3/new/model.ts (READ ONLY: call `blankCreate`, `kindInfo`, `withFirstDate`, `addChosenDate`, `venueOf`, `venueMatches`; do not edit)
- src/modules/organiser/shared/publicVenues.ts (READ ONLY: `VenueOption`)
- src/modules/organiser/shared/createModel.ts (READ ONLY: `nextDateOnWeekday`, `isHttpUrl`)
- src/modules/organiser/p3/new/flyerReadShape.ts (new)
- src/modules/organiser/p3/new/flyerToDraft.ts (new)
- src/modules/organiser/p3/new/__tests__/flyerToDraft.matrix.test.ts (new)
- src/modules/organiser/p3/new/__tests__/flyerReadFixtures.ts (new)

## What to build
1. **`flyerReadShape.ts`** (token comment `flyer_read_shape_v1`): the TypeScript type `FlyerRead` for the function response, copied from this list (the admin schema is the source of truth; leave a comment saying so): `kind` one_off | weekly | monthly | course | festival | multi_event | not_enough; `event_count_on_flyer`; `title`; `organiser_text`; `dates` list of `{date_start, date_end, year_printed, weekday_printed, recurrence_text}`; `start_time`, `end_time` (HH:MM) and `ends_after_midnight`; `venue_name`, `venue_address`; `sessions` list of `{type: class|party|social|workshop|doors|other, start, end, label}`; `price` `{amount_pence, currency}` or null; `ticket_url_visible`; `doubtful_fields`; `notes`. Plus a small runtime guard `parseFlyerRead(unknown)` that returns null for anything off-shape (never throws).
2. **`flyerToDraft(read, venues, today)`** in `flyerToDraft.ts` returns `{ draft: CreateDraft, doubtful: DraftFieldKey[], venueSaid: string | null, sessionChoices: SessionChoice[], notes: NoteLine[] }` where `NoteLine` is a code plus plain English the screen can show. Rules (all are owner decisions):
   - **Kind:** one_off with both a class and a party session -> `class_party`, else `one_date`; weekly -> `weekly`; monthly -> `monthly`; course -> `course`; festival -> `festival`; multi_event -> map its first event as above; not_enough -> `one_date`.
   - **Weekly or monthly:** set `firstDate` to the next date on the printed weekday (use `nextDateOnWeekday` from shared/createModel.ts, read only) and add the note "this repeats every week/month, set how it repeats below"; do NOT build the repeat rule yourself, leave `repeat` at its blank default.
   - **Several events (`event_count_on_flyer` > 1):** read the first, add the note "this flyer has N events, the others are not read".
   - **Past date:** keep the printed date, add `firstDate` to `doubtful` and the note "this date has passed". NEVER move a date to next year. Year missing: if the read already carries a date, trust it; do not compute a year here.
   - **Not enough (`kind` not_enough, or no date and no venue):** fill only what exists (usually the name) and add the note saying what is missing.
   - **Festival or multi-day range:** `firstDate` = `date_start`; every further day up to `date_end` into `extraDates` (cap `DATES_MAX`; if over, keep the first DATES_MAX and add a note).
   - **Venue:** match `venue_name` against `venues` with `venueMatches`; set `draft.venue` ONLY when exactly one venue matches; otherwise leave it null, mark `venue` doubtful and put the flyer's own wording (name, then address) in `venueSaid`.
   - **Sessions:** NOT added to the draft. Return them as `sessionChoices` (each with a stable id, label, type, start, end and a `ticked` default: true unless `sessions` is in the read's doubtful list) for the tick list; a pure helper `applySessionChoices(draft, choices)` adds only ticked ones as `SessForm`s via the session helpers model.ts already uses. Ends after midnight keeps end earlier than start (a next-day end), exactly as the P3 session form expects; check how `SessForm` stores that and follow it.
   - **Price:** a single clear price only: put it as ONE `PriceRow` (name "Ticket", price in pounds from `amount_pence`, currency) and mark `prices` doubtful; null price -> no rows.
   - **Ticket link:** `ticket_url_visible` -> `ticketUrl` only if `isHttpUrl` accepts it (add `https://` first when it starts with `www.`), marked doubtful; otherwise empty.
   - **Name:** `title` trimmed to `NAME_MAX`; missing -> ''. Never touch description, cover, category, teachers.
   - Every field the read lists in `doubtful_fields` is also in `doubtful` (map names to `DraftFieldKey`: name, venue, firstDate, extraDates, sessions, prices, ticketUrl).
   - Flyer text is untrusted: strip any URL from every string except the ticket link, collapse whitespace, cap lengths.
3. **Tests, table-driven, RED FIRST against an empty implementation, then green** (`flyerToDraft.matrix.test.ts` + `flyerReadFixtures.ts`): one fixture row per real test flyer, values summarised from the eleven in `C:/Users/ecual/.claude/plans/flyer-reader-8-flyers-truth.md` (read it; the worker may read this file): 1 weekly Saturday with full address; 2 Halloween one-off class+party, past, no year; 3 three-night multi-event, no venue; 4 weekly Wednesday, 2 rooms, ends 01:00; 5 monthly first Saturday, no venue, 10 sessions; 6 two events + timetable; 7 course with no date; 8 boat party one-off, past; 9 festival 6-8 Nov, address only; 10 Spanish festival "6, 7 y 8 NOV 2026"; 11 price-only promo (`not_enough`). Plus: single price vs tiers, injected link in `title` stripped, venue exactly one match vs two matches vs none, more than DATES_MAX days, unknown/garbage input to `parseFlyerRead` returns null. Assertions per row: kind, firstDate, extraDates length, venue id or null, venueSaid, session choices count, doubtful list, notes codes, and that `isUntouched` is false only when something was filled. No network, no component, no flag.

## Do NOT touch
EventCalendar.tsx, calendar/CalendarGrid.tsx, calendar/CalendarListView.tsx, calendar/DayDetailModal.tsx, calendar/calendarUtils.ts, useCalendarEvents.tsx (density-exempt calendar files), src/components/ui/dialog.tsx, supabase/**, migrations, workflows, scripts/**, .env*, p3/new/model.ts and every other file not listed under Files. Use `&mdash;`/`&hellip;` entities in any JSX (there is none here). No Unicode punctuation pasted into source.

## Done when
`npm run typecheck`, `check:mojibake` and the new tests green; one push; PR body has "## Verified on real data" (- Shapes surveyed: the 11 reference flyers in the fixtures, read-only, plus a read-only count on prod of venues with the same name so "exactly one match" is shown against real venue names; - Checks run: ; - NOT verified: the live reader output, the screen, the flag) and the per-job CI table. Tests-only PR: delete the Phone QA section. Last commit subject ends with [worker-done flyer-read-mapping]. Stop at 50% context with a PARTIAL marker.
