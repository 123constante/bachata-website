# Handover: organiser Events tab, core (admin #1535)

Done: `src/modules/organiser/p3/events/` (eventsModel.ts pure, EventsView.tsx, DashEvents.tsx), wired into `EventsScreen` behind `flags.organiserDash` (same flag as Home slice 1, off by default). 24 tests (model x shape, view x shape). tsc: zero errors in touched files. `npm run lint` 34/34 links green, `check:mojibake` clean, `vitest src/modules/organiser/p3` 137 files green.

Built: nights by date with one status word (Live / Draft / Hidden / Cancelled / Past), pinned one-line "N things need you" + sheet (needsOf + all-cancelled), search and status chips from 8 nights, first 15 then "Show 30 more", past folded, contributor view-only banner, open (existing event route), cancel one date (existing DateSheets), Delete draft (existing `series.set_lifecycle archived`).

Limits (honest): organiser_home_v1 sends only the next 3 scheduled dates per series and drops cancelled dates, so a series shows 3 nights plus "See N more dates" (existing All dates screen) and Cancelled rows only appear once admin feeds them. Real contributor seat does not exist in home_v1 (role is owner|manager); the contributor path is built and tested but unreachable in prod today. Hidden (paused) is a 5th tag (open question 1 not answered by the owner).

Needs admin work (not built): bulk select + cancel/duplicate/put live; duplicate; recurring-night creation; "this and every one after" / whole-series cancel; per-night guest list/raffle switch; true delete of a draft (today it is Remove: leaves events, team can restore).

Next: owner flips the flag; browser walk at 390x844 with a signed-in organiser (not possible from this sandbox).


Fix round 1 (brief profile-dash-organiser-events-build-fix1): items 1-8 done in code and tests (see the Handover in docs/design/profile-dash/organiser-events.md). Item 9 NOT done: no 390x844 walk or screenshots (needs the side laptop). pre-ship failed locally only on sandbox causes (DB contract tests, tooling tests, typecheck ratchet with no errors in touched files).


Fix round 2 (brief ...-fix2): items 2-5 done. "Every night" now sends the existing `occurrence.bulk_cancel` (bulkCancelCommand via runBulkCommand, reason chips from cancellation_reasons, confirm names the night count, zero-coming-nights state). Added tests: success, error, zero nights, draft load-error aria-describedby; matrix "100+" row is now 100 nights with the "Show 30 more" assertion. Removed the orphan doc comment and the unused `note` field. tsc: zero errors in p3/events. vitest p3 green. Item 1 NOT done: no 390x844 walk/screenshots or CI table from this cloud worker (no preview laptop, no gh); pre-ship not run here. eslint: 1 pre-existing no-control-regex in eventsModel.test.ts:139 (file untouched by this round).
