# S-NOMOVE-FLYER handover

Branch `claude/org-r1-nomove-flyer`, base `main` @ 995c841. Single worker, one push.

## Done
- **Part 1, no "Move to another day"** (owner 2026-10-20, C5c/D39/C20): removed the `change-day` row
  (`flows/change/WhatChanges.tsx`), `flows/change/Day.tsx`, `ORG_PATHS.changeDay`, its route in
  `shell/OrganiserRoutes.tsx`, the `day` step in `ChangeFlow.tsx`, `moveDays` / `dayDoneMessage` in
  `changeModel.ts`. Tests updated: `change.flow` (the row is gone, the remaining rows read the same), `pdates.flow`
  (no row whatever the A1 gate says), `consistency.dates.matrix` (no shape offers it), `consistency.render.matrix`
  (move row dropped), `consistency.matrix` (A1 users list), `routes.test`, `paths.test`, `changeModel.test`.
  Parity matrix C20 -> `DROPPED-BY-DECISION`, "DECIDED: not in R1, cancel + add a date" (counts 9 PARTIAL / 11 dropped).
  KEPT: `moveDateCommand` + the `occurrence.move_date` kind (admin command untouched, no migration); the series-level
  "Change the day" (`eventStepPath ... day`) is untouched; Pick.tsx "Move the ticked dates" is the bulk shift, a different feature.
- **Part 2, BUG F1 "Enter the event name."**: root cause: `flows/new/model.ts` (`venueCommands`, `dateCommands`,
  `timeCommands`, `coverCommands`) and `flows/fix/coverModel.ts` (`coverFixCommands`) built `series.upsert` payloads with no
  `name`; the live handler answers `invalid_payload: name required`. Fix, ONE shared builder: `withSeriesName(command, name)` in
  `shared/seriesCommands.ts`, applied at the single send point of each route flow with the name from the fresh workspace read
  (`useNewSend`, `CoverFlow`). Other upsert builders (`events/*`, `flyerModel`, `basicsPayload`) already carry `name`.
  Saving an untouched record still sends nothing (the step only sends on a tap/choice; unchanged).
- **Part 3, F2 (draft under Past)**: NOT REAL. `shared/lifeLabel.ts seriesLife` puts every non-live, non-closed status (draft)
  in `current` whatever its dates; only live-with-no-coming-date and ended/archived go to Past. The page text "PAST (9)"
  then "zz test / Draft" is the Events list (Past heading, collapsed) followed by the event screen's own header in DOM order.
  Nothing added, per the brief.
- **Go live gating copy**: unchanged and already pinned by `fpar.review.test.tsx` rows ("To go live, add a flyer in Details.",
  "...add a date from today on with Add a date.", enabled when both exist).

## RED first (before the fix, on main code)
New table test `flows/__tests__/upsertName.test.tsx` (server harness refuses a `series.upsert` without `name`, like the live handler):
```
 ❯ upsertName.test.tsx (5 tests | 5 failed)
   New event: venue / first date / time / flyer, Flyer page /account/o/cover/:id
   → expected undefined to be 'Friday Party' // Object.is equality
```
After the fix: 5 passed. Two old assertions that pinned the bug (`toEqual({ default_start_date })` etc.) now expect `name` too.

## CI jobs run in the sandbox
| Job / step | Command | Exit |
|---|---|---|
| unit-tests (organiser scope) | `npx vitest run src/modules/organiser` | 0 (118 files, 3348 passed, 2 skipped) |
| typecheck | `npx tsc --noEmit -p tsconfig.app.json` filtered to organiser | 0 new errors (2 pre-existing, unrelated: TeamPicker.test, NewPageFlow.test) |
| typecheck | `npm run check:rpc-typing`, `check:wallclock-brand` | 0, 0 |
| architecture-guard | `npm run lint:architecture`, `check:legacy-tables`, `check:legacy-program-rpcs` | 0, 0, 0 |
| integrity | `bash bin/check-integrity.sh` | 0 |
| eslint (changed files) | `npx eslint <changed>` | 0 |
| build | `npm run build` | 0 |
Not run: e2e-smoke (needs browsers + live deploy), perf-budget (needs a deploy), types-drift (needs DB).

## Verified / Not verified
Verified: the 5 route steps send `name` against a harness that refuses a nameless upsert; the change flow reads the same
without the Day row; F2 reasoned from `seriesLife` code. Not verified: browser walk at 390x844 (not run in this sandbox),
real-phone photo picker, real storage upload, Go live publish, the prod draft `a4e38c9f-...` itself (no prod writes).

## Left / next
Owner phone re-test of New event -> venue -> flyer on a fresh draft after deploy.
