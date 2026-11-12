# Handover: organiser Events tab, core (admin #1535)

Done: `src/modules/organiser/p3/events/` (eventsModel.ts pure, EventsView.tsx, DashEvents.tsx), wired into `EventsScreen` behind `flags.organiserDash` (same flag as Home slice 1, off by default). 24 tests (model x shape, view x shape). tsc: zero errors in touched files. `npm run lint` 34/34 links green, `check:mojibake` clean, `vitest src/modules/organiser/p3` 137 files green.

Built: nights by date with one status word (Live / Draft / Hidden / Cancelled / Past), pinned one-line "N things need you" + sheet (needsOf + all-cancelled), search and status chips from 8 nights, first 15 then "Show 30 more", past folded, contributor view-only banner, open (existing event route), cancel one date (existing DateSheets), Delete draft (existing `series.set_lifecycle archived`).

Limits (honest): organiser_home_v1 sends only the next 3 scheduled dates per series and drops cancelled dates, so a series shows 3 nights plus "See N more dates" (existing All dates screen) and Cancelled rows only appear once admin feeds them. Real contributor seat does not exist in home_v1 (role is owner|manager); the contributor path is built and tested but unreachable in prod today. Hidden (paused) is a 5th tag (open question 1 not answered by the owner).

Needs admin work (not built): bulk select + cancel/duplicate/put live; duplicate; recurring-night creation; "this and every one after" / whole-series cancel; per-night guest list/raffle switch; true delete of a draft (today it is Remove: leaves events, team can restore).

Next: owner flips the flag; browser walk at 390x844 with a signed-in organiser (not possible from this sandbox).
