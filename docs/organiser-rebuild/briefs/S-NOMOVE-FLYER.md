# Brief S-NOMOVE-FLYER -- remove "Move to another day" + fix "Enter the event name." on route steps

Repo `123constante/bachata-website`, branch `claude/org-r1-nomove-flyer`, base `main` (the R1 screens, gates ON, are merged: #809, #869). READ FIRST: `docs/organiser-rebuild/briefs/00-COMMON.md` applies with `<X>` = S-NOMOVE-FLYER; plan = `docs/organiser-rebuild/R1-PLAN.md`; the evidence is in `~/.claude/plans/organiser-r1-admin-parity-walk-2026-10-18.md` (if you cannot read it, the facts are below). ONE push at the end, plus ONE `PARTIAL [worker-done ...]` push if you hit 30% context. This slice is author + optional continuation + review + one fix pass: a PARTIAL is normal; read your handover file `docs/organiser-rebuild/handovers/S-NOMOVE-FLYER.md` if you are the continuation.

## Part 1 -- remove "Move to another day" (single date). Owner decision 2026-10-20 (C5c / D39 / parity C20)
Owner's words: a recurring weekly night has an identity ("Sundays 18:30"); "move this Sunday to a Tuesday" makes no sense; organisers cancel a date and add a new one. The label also clashes with the real series-level "Change the day (Tuesday)".
- Drop the `change-day` StepRow in `flows/change/WhatChanges.tsx`, the Day route/screen (`flows/change/Day.tsx`, `ORG_PATHS.changeDay`, its route entry) and every copy that mentions moving a date.
- Remove/update their tests: `change.flow`, `pdates.flow`, `consistency.dates.matrix` row `change-day`; parity matrix C20 -> verdict "DECIDED: not in R1, cancel + add a date".
- KEEP: the admin `occurrence.move_date` command in the database (no migration, nothing in the admin repo). KEEP the series-level "Change the day" (whole-series weekday) untouched.
- After removal: no text may point at a control that is not on screen; the change flow's remaining rows (cancel a date, change time/venue etc.) must still read the same on every screen (shared mapping).

## Part 2 -- BUG F1: "Enter the event name." on steps of an EXISTING draft (found live on prod 2026-10-20, owner's own phone + a walk)
The owner's words: "I added [a flyer] and this appeared: Enter the event name." Facts:
- The error is the server's `invalid_payload: name required` mapped in `shared/selfServeErrors.ts:151`.
- It appears on: (a) the New-event flow's venue step `/account/o/new/<draftId>/venue`, reached right after the name step created the draft (the name WAS saved: the draft shows as "zz test"); (b) the flyer page `/account/o/cover/<draftId>` after choosing a photo. In both, nothing is saved (flyer stayed "Add").
- The same fields saved through the Details page sheets DO work (venue via sheet, time, add a date all saved fine). So the route-based steps build a `series.upsert` payload that lacks `name` (note `shared/seriesCommands.ts` `basicsPayload` documents "`name` always (the handler requires it)"; find which route steps bypass it).
- Impact: a new event can NEVER get a flyer through the UI, so Go live (needs flyer + a future date) is unreachable for a new event.
- Task: reproduce RED FIRST (table-driven test over EVERY route step that saves to an existing event: venue, cover/flyer, time, tickets, about, music, gallery, videos, programme entry points, whatever exists; each must save with a draft whose name is already set and send a payload the server accepts, i.e. carries `name` or uses a command that does not need it). Fix the whole class with ONE shared payload builder, not per-screen copies. Saving an untouched record still sends nothing.
- A test must fail on main before your fix (state the failing run in the PR body). Walk it on the real draft shape: the production draft `a4e38c9f-b3d3-4007-a56f-85d7e36768da` (org Bachata Playground; one_off; name "zz test"; venue Albert Memorial; 17 Nov 20:00; NO flyer) is the repro; do NOT write to prod (Supabase read-only) -- reproduce with the test harness / mocked RPC that asserts the payload shape the server requires (read the live `series.upsert` handler body with a read-only query if needed).

## Part 3 -- OBSERVATION F2 (verify, fix only if real)
On the event screen `/account/o/events/<id>` for that draft (a future date 17 Nov) the page text listed "PAST (9)" followed by "zz test / Draft" (the draft appears under Past). Establish whether a future-dated draft is wrongly bucketed as past (the bucket rule must be shared with My events). If real: fix + a matrix row (draft x future / past / no date). If not real (collapsed-list rendering): say so in the handover and add nothing.

## Also in this push
Re-check the Go live gating copy after the fix: with flyer + future date the control must enable; without, it is disabled WITH the reason ("To go live, add a flyer in Details", "add a date"). Do not change the copy that already reads correctly.

## Verified / Not verified, CI
Per 00-COMMON and the CI-without-paying rule: run EVERY CI step yourself (read `.github/workflows`), per-job table with command + exit code in the PR body and handover. Build with `npm run build` too. Browser walk at 390x844 of the changed screens (change flow without the Day row; new-event flow venue + flyer steps) on prod-shaped data. Write "Not verified" honestly (real-phone photo picker, real storage upload, Go live publish). No `gh api` (plain git only). Shell commands without variables/loops where a plain command works.
