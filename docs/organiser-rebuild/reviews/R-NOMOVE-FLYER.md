# R-NOMOVE-FLYER: independent review of PR #880

Reviewed `claude/org-r1-nomove-flyer` @ `0d90da8f` against `main` @ `995c841`. Read-only. Nothing pushed to the PR branch.

## Verdict: PASS WITH FIXES

F1 is fixed for the whole class. The red-first test is real and catches mutations. Move-a-day is gone from every screen. The two "fix" findings are leftover traces of the deleted Day step. None of them is a user-facing bug today.

## Evidence

### 1. F1 class completeness: PASS
- Live handler (`pg_get_functiondef('public._cmd_series_upsert_p5')`, read-only):
  - line 88 `v_name := NULLIF(btrim(p_payload->>'name'), '')`
  - line 91-92 `IF v_name IS NULL THEN RAISE EXCEPTION 'invalid_payload: name required'`
  - line 280-281 `UPDATE public.event_series_p5 SET name = v_name`
  - So `name` is required on EVERY upsert, and it is always written.
- Other handlers do not need a name:
  - `occurrence.set_override`: no required key (only passes/promo_codes array checks).
  - `occurrence.cancel` needs `cancelled (bool)` and a reason. `cancelCommand` sends both.
  - `series.add_date` needs `date`. `addDateCommand` sends it.
  - `occurrence.set_time` needs `new_local_start`.
  - `series.set_recurrence`: none.
- Every `upsertCommand(` call site on the PR head (`grep -rn "upsertCommand(" src/modules/organiser`, tests excluded):
  - `events/musicModel.ts:39`, `events/seriesExtras.ts:17,73,149`, `events/eventModel.ts:422,427`, `shared/flyerModel.ts:278`: each carries `name: ws.series.name` or `seriesName`.
  - `events/eventModel.ts:224` uses `basicsPayload`, which always carries name.
  - `shared/selfServeApi.ts:390` is the create (draftCommand carries name).
  - `flows/new/model.ts:33,38,43,46` and `flows/fix/coverModel.ts:7` have no name. They are sent ONLY via `useNewSend.ts:40` and `CoverFlow.tsx:54`, and both now wrap the command in `withSeriesName`.
  - No other `series.upsert` builder exists: `kind: 'series.upsert'` appears only in `seriesCommands.ts`.
  - No builder still omits a required key.
- `withSeriesName` safety:
  - The name and `expected_version` come from the SAME fresh `fetchSeriesWorkspace` read (`CoverFlow.tsx:51-54`, `useNewSend.ts:29-30`).
  - The dispatcher `apply_aggregate_write_p5` (lines 539/543/557) raises `version_conflict` when the version moved. So a rename made meanwhile on another device is refused, never overwritten. Both flows already map `isVersionConflict`.
  - It touches only a nameless `series.upsert`, so it cannot replace a name that is already set.
  - The name comes from the target series' own read (`fetchSeriesWorkspace(seriesId)`), never from a different record.
  - Trim cannot rename anything. Prod: `select count(*) ... from event_series_p5` gives 742 rows, 0 empty names, 0 untrimmed names. The server btrims anyway.
  - The repro draft `a4e38c9f-...` is still named "zz test" with no cover (confirmed by SELECT).

### 2. Red first: PASS
- I copied the PR's `flows/__tests__/upsertName.test.tsx` onto `main`: `npx vitest run src/modules/organiser/flows/__tests__/upsertName.test.tsx` gave `Tests 5 failed (5)`, each `expected undefined to be 'Friday Party'`. That is the stated reason.
- The harness is faithful: it refuses a `series.upsert` whose `String(name ?? '').trim()` is empty, using the live message `invalid_payload: name required`. The live check is the same (NULLIF(btrim)).
- Mutation A, `withSeriesName` dropped in `CoverFlow.tsx`: `1 failed | 4 passed` (the Flyer page row).
- Mutation B, `withSeriesName` dropped in `useNewSend.ts`: `4 failed | 1 passed` (venue, first date, time, New-event flyer).
- Both mutations were reverted (`git status` clean).

### 3. Move-a-day removal: PASS (2 fixes, 2 nits below)
- `grep -rniE "changeDay|moveDays|dayDoneMessage|change-day|MOVE_NOT_OPEN|move to another day"`: nothing in production code except the items listed below.
- `moveDateCommand` and the `occurrence.move_date` kind were kept as briefed.
- The series-level "Change the day" (`flows/event/EventStep.tsx:52`, `eventSteps.ts`) is untouched and still tested (`events/__tests__/s5.fixpass.test.tsx`).
- The Pick.tsx bulk shift is untouched and still tested (`pdates.flow.test.tsx`).
- Parity C20 (`parity-matrix.test.ts:287`) reads `DROPPED-BY-DECISION`, "DECIDED: not in R1, cancel + add a date (owner 2026-10-20, D39)". That is correct.
- An old bookmark to `/account/o/change/:s/:o/day` now matches `change/:seriesId/:occurrenceId/:field` (`OrganiserRoutes.tsx:107`). That renders Detail with `field='day'`, `isDetailField` is false, and the screen shows `<Missing/>`: "Not found" plus "Back to Home". So it is safe: no crash, and back works.

### 4. Saving an untouched record sends nothing: PASS
- `withSeriesName` never adds a command, it only changes one.
- Route steps send only on a tap or a choice (unchanged).
- `useNewSend` with an empty list loops nothing.

### 5. Runs (PR head, sandbox)
| Check | Command | Result |
|---|---|---|
| unit (organiser) | `npx vitest run src/modules/organiser` | exit 0, 118 files, **3348 passed, 2 skipped** (matches the author) |
| build | `npm run build` | exit 0 |
| integrity | `bash bin/check-integrity.sh` | exit 0, 2030 files, 0 issues |
| eslint (changed .ts/.tsx) | `npx eslint <changed>` | exit 0 |
| typecheck | `npx tsc --noEmit -p tsconfig.app.json` filtered to organiser | only the pre-existing TeamPicker.test and NewPageFlow.test errors |

### 6. Reasoned from code (no browser)
- **New event, venue step right after the name step:** the draft is created with `draftCommand` (carries the name). The venue tap then goes through `useNewSend`. It does an uncached `fetchSeriesWorkspace`, sees the saved name, and `withSeriesName` adds it. The 'New event: venue' row pins this.
- **Add a flyer page after choosing a photo:** upload, then a fresh read, then `withSeriesName`, then the send (row 'Flyer page'). Before the fix this was exactly the nameless upsert.

## Findings
1. **fix**: `src/modules/organiser/flows/change/ChangeFlow.tsx:11`. `ChangeStep` still includes `'day'`, but `STEPS` no longer has it.
   - `tsc` does not flag `STEPS[step]` (passes clean), so `<ChangeFlow step="day"/>` compiles and renders `undefined`. React then throws "Element type is invalid".
   - Not reachable from production routes today. Any future `step="day"` would crash at runtime instead of failing typecheck.
   - Fix: drop `'day'` from the union, or type it as `keyof typeof STEPS`.
2. **fix**: `src/modules/organiser/__tests__/consistency.render.matrix.test.tsx:127` still mounts `<Route path=".../:occurrenceId/day" element={<ChangeFlow step="day" />} />`. It is a dead test route for the deleted screen, and it would crash if any row navigated there. Remove it (finding 1's fix will force this anyway).
3. **nit**: `src/modules/organiser/shared/dateList.ts:56`. The comment says `comingDays` "Feeds Add a date and Move to another day". Now it feeds only Add a date. The brief asked for every mention of moving a date to go.
4. **nit**: nothing pins what the old `/day` deep link renders (today "Not found" via the `:field` route, see section 3). A one-row routes test (`/account/o/change/s1/o1/day` gives `change-missing`) would keep that safe.
5. **nit**: `upsertName.test.tsx` covers the weekly-night first date only for `one_off`. `dateCommands('recurring', ...)` sends an upsert then `set_recurrence`. The code path is the same loop and only the first command is an upsert, so the risk is low, but one row would pin it.

## Not verified
- No browser walk at 390x844.
- Not tested on a real phone: photo picker, storage upload, Go live publish.
- No CI on the PR branch read via GitHub (plain git only). I ran the jobs locally (table above). e2e-smoke, perf-budget and types-drift were not run.
