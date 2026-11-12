# Handover: organiser Events tab, core (admin #1535)

Done: `src/modules/organiser/p3/events/` (eventsModel.ts pure, EventsView.tsx, DashEvents.tsx), wired into `EventsScreen` behind `flags.organiserDash` (same flag as Home slice 1, off by default). 24 tests (model x shape, view x shape). tsc: zero errors in touched files. `npm run lint` 34/34 links green, `check:mojibake` clean, `vitest src/modules/organiser/p3` 137 files green.

Built: nights by date with one status word (Live / Draft / Hidden / Cancelled / Past), pinned one-line "N things need you" + sheet (needsOf + all-cancelled), search and status chips from 8 nights, first 15 then "Show 30 more", past folded, contributor view-only banner, open (existing event route), cancel one date (existing DateSheets), Delete draft (existing `series.set_lifecycle archived`).

Limits (honest): organiser_home_v1 sends only the next 3 scheduled dates per series and drops cancelled dates, so a series shows 3 nights plus "See N more dates" (existing All dates screen) and Cancelled rows only appear once admin feeds them. Real contributor seat does not exist in home_v1 (role is owner|manager); the contributor path is built and tested but unreachable in prod today. Hidden (paused) is a 5th tag (open question 1 not answered by the owner).

Needs admin work (not built): bulk select + cancel/duplicate/put live; duplicate; recurring-night creation; "this and every one after" / whole-series cancel; per-night guest list/raffle switch; true delete of a draft (today it is Remove: leaves events, team can restore).

Next: owner flips the flag; browser walk at 390x844 with a signed-in organiser (not possible from this sandbox).


Fix round 1 (brief profile-dash-organiser-events-build-fix1): items 1-8 done in code and tests (see the Handover in docs/design/profile-dash/organiser-events.md). Item 9 NOT done: no 390x844 walk or screenshots (needs the side laptop). pre-ship failed locally only on sandbox causes (DB contract tests, tooling tests, typecheck ratchet with no errors in touched files).


Fix round 2 (brief ...-fix2): items 2-5 done. "Every night" now sends the existing `occurrence.bulk_cancel` (bulkCancelCommand via runBulkCommand, reason chips from cancellation_reasons, confirm names the night count, zero-coming-nights state). Added tests: success, error, zero nights, draft load-error aria-describedby; matrix "100+" row is now 100 nights with the "Show 30 more" assertion. Removed the orphan doc comment and the unused `note` field. tsc: zero errors in p3/events. vitest p3 green. Item 1 NOT done: no 390x844 walk/screenshots or CI table from this cloud worker (no preview laptop, no gh); pre-ship not run here. eslint: 1 pre-existing no-control-regex in eventsModel.test.ts:139 (file untouched by this round).


Finish round (brief organiser-events-finish, ticket dt_bbe4761d107f):
Done: (1) bulk "Every night" cancel now invalidates the same set Change dates refreshes (series workspace, event workspace, home, date detail, programme, public caches). (2) Version conflict shows the module's one EventConflict view with a "Reload the event" action (new optional `onReload` on EventConflict) that refetches and returns to the confirm with the new version and a fresh idempotency key. (3) The cancel list reads every date: CancelNight pages older dates via the existing useOlderDates/withOlder (200 per page); a failed older read says nothing changed and offers Try again. Tests: 100+ dates, older read error, conflict then Reload, invalidation set (dashEvents.test.tsx).
CI items: consistency.matrix B-N8 and JoinGetPaidNext pass after merging origin/main (no change needed on this branch); the G2 one-conflict-view guard stays green.
Evidence: 390x844 walk (route-mocked organiser fake, flags on) in docs/design/profile-dash/shots/organiser-events-walk-*.png: normal, empty, huge (45 series), error, every-night-confirm, conflict, conflict-after-reload. Spec: tests/e2e/walk-p3-organiser-events.spec.ts (throwaway, not in the gate).
tsc run on HEAD: 0 errors in branch files (other errors in app/ are pre-existing). vitest src/modules/organiser: 327 files green. check:mojibake clean.
Not verified: real prod-shaped data walk (fake only; no Supabase prod read in this run); full pre-ship and per-job CI table (no gh/CI access here); the older-pages path against the real RPC (mocked in unit tests, shape matches AllDates).


Fix round 3 (brief events-1584-fix3, ticket dt_f261a00ffd77): F1-F4 done, nothing else touched.
- F1: reload() in CancelEveryNight now calls setKey(newIdempotencyKey()) on success and in the non-network catch. Test: conflict -> Reload -> Confirm sends a different key and the refetched version (9, not 4). Red first: fails on the unfixed DashEvents.
- F2: walk fake now bumps every series version and cancels one coming night before Reload; conflict-after-reload.png re-shot (now "Cancel all 11 nights?", differs from every-night-confirm; md5 differs).
- F3: removed the duplicate "Close" in the conflict Sheet (the Sheet's own stays).
- F4: unknown role defaults to view-only (contributor). Test rows: owner, manager, contributor, viewer, "", undefined (viewer/""/undefined red on the unfixed code).
Verified: vitest src/modules/organiser/p3/events 55/55 green; check:mojibake clean; tsc: zero errors in touched files; walk conflict spec passed locally.
Not verified: full pre-ship; per-job CI table (no gh/CI access here, the PR body needs it added by the owner); prod-shaped data walk; PR body label checks (no PR body file in this run).
