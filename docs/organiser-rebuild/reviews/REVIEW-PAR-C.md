# REVIEW-PAR-C -- independent review of the F-PAR fix pass on PR #809

- Brief `R-PAR-C.md` (sha 2602dce), ticket dt_6eb4d71b034e. One pass, read-only on source. A different worker from the FIX-PAR author.
- Scope: `git diff 5369379..6c33ffa` (the head of `claude/org-r1-integrate`, which is also `refs/pull/809/head`). 39 files, +1189 / -112.
- Read first: `handovers/FIX-PAR.md`. Prod `stsdtacfauprzrdebmzg`: SELECT only, counts only, no personal data (2026-10-18).
- Nothing was fixed. This branch adds only this doc and `walk-PARC/` screenshots.

**Verdict: 0 BLOCKING / 1 SHOULD / 6 NOTE.**

Every fix does what FIX-PAR says. Each new rule matches the prod function it mirrors. Nine of the ten mutants of the new rules go red. Unit tests, lint and the build are green, and the 390x844 walk passes. The findings are what the fixes left half-done, and three latent server or client mismatches with 0 prod reach today.

## Findings

### SHOULD

**S1. Pick several on a weekly or monthly event offers Earlier / Later and the days box, but Move can never work there.** `src/modules/organiser/flows/change/Pick.tsx:166-174`
- The S8 fix added live Earlier / Later chips and a days input. On a series where `shiftRefusal(recurrence_rule)` is set (`Pick.tsx:63`), they render as normal controls.
- The server refuses every bulk_shift on such a series (`admin_bulk_occurrence_command_p5`: `contract_violation: cannot shift a weekly|monthly series`). So the button under them is always off, with "Dates of a repeating event can't be moved together. Change the repeat instead."
- This is the most common shape: 34 recurring series have 10+ coming dates on prod. CLAUDE.md DoD 2 says a control that cannot work is disabled with a reason; here only the last of three controls is.
- Walk: `walk-PARC/pick-weekly-01.png`, `pick-weekly-02-bottom.png`.
- **Fix:** when `shiftOff` is set, render the shift reason in place of the chips, the days box and Move, or mark all three disabled with that reason.

### NOTE

**N1. On the server, set_time's START delta also ignores midnight, and the decision-1 table marks that shape "box".** `src/modules/organiser/flows/change/changeModel.ts:144` (`timeDelta`) vs `_cmd_occurrence_set_time_p5`
- The server computes `v_delta := v_new_start - v_cur_start`, where `v_cur_start` is the plain-`time` `min(eff_start)`. The client works out the delta from the date's start on the night clock.
- On a party 21:00-00:00 + after-party 00:30-04:00 night, the server's start is 00:30. Typing 22:00 moves every session +21 h 30 min, not +1 h. The preview would be wrong and the write would be wrong.
- The decision-1 table row `party 21:00-00:00 + after-party 00:30-04:00` -> box (`pdates.model.test.ts:50`) is right about the END target, but the whole command misfires on that shape.
- Prod reach today: **0** coming dates have a session that starts before 08:00 alongside an evening one. So it is latent.
- **Fix:** add the start side to the queued admin defect (use the night clock for both `min(eff_start)` and `max(eff_end)`). Until that lands, extend the client guard: refuse Change time when `nightStart(min) != plain min`.

**N2. Change time is not refused for a festival (FIX-PAR queued PAR-A N2). This review confirms it and counts the reach.** `src/modules/organiser/flows/change/Time.tsx:37`
- The walk shows the full form on a festival date, with the session list, New start, an "End of Party (optional)" box and Save (`walk-PARC/time-festival-01.png`).
- The server then refuses with `invalid_payload: per-date time is not supported for festivals`, which shows as the generic line.
- Prod reach: **6** coming scheduled festival dates.
- **Fix:** have DateStep or Time show the festival refusal before the form (`s.format === 'festival' || s.festival_id`).

**N3. Stop repeating's "with their own changes stay" can miss a date that holds a reason-only override row.** `src/modules/organiser/shared/seriesModel.ts:229` (`keepsOwnChanges`) vs `_occurrence_is_curated_v1`
- The server spares ANY override row. The workspace's `has_override` drops a row that owns only `cancellation_reason_label` while the date is scheduled (`admin_event_workspace_p5`, D8 W4).
- Such a date would be counted as "comes off", but the server keeps it.
- Prod reach: **0**. All 23 reason-only rows are on cancelled dates, and `wsComing` lists scheduled dates only.
- **Fix:** none needed now. If a put-back ever leaves the row behind, the workspace needs a raw `has_override_row` for this line.

**N4. Pick several with 0 coming dates still renders the whole Cancel / Move block under NO_COMING and Add a date.** `src/modules/organiser/flows/change/Pick.tsx:140-178`
- The block shows "Tick at least one date", the reasons, Earlier / Later and the days box (`walk-PARC/pick-none-01.png`).
- It is only reachable by a direct or stale URL: WhichDate's empty state has no Pick entry. One ruled series on prod has 0 coming dates.
- **Fix:** render the action block only when `dates.length > 0`.

**N5. NO_COMING reads "so nothing repeats" on Pick several too, including for a one-off.** `src/modules/organiser/shared/copy.ts:34`
- This was the orchestrator's decision 5 (one sentence). On Pick several, the clause about repeating does not fit what the screen does.
- **Fix (owner's call):** keep NO_COMING for Stop repeating, and give Pick its own wording ("No coming dates to pick. Add a date first.").

**N6. The guard's reach is larger than the queued count, which matters for prioritising the admin fix.** `changeModel.ts:216` (`endBoxShown`)
- On prod (2026-10-18), 1,839 coming non-festival dates have sessions. Of those:
  - **1,445** get the end box: 246 with one session, 1,199 with several.
  - **394 (21%)** get END_GUARD. 290 of them because the plain-clock `max(eff_end)` is not the night-last session, and 200 because two or more sessions share the end (the two groups overlap).
- FIX-PAR quotes 241 from REVIEW-PAR-A (2026-10-17, plain-vs-night only). My comparable figure is 290: the predicate differs a little, and the data has grown.
- Walk: on the class+party screen, "Open Sessions" sits just above a "Change one session's time" row that goes to the same place (`walk-PARC/time-classparty-01.png`). That is harmless, but it says the same thing twice.

## Check by check (brief items)

1. **Change time vs `_cmd_occurrence_set_time_p5` (pg_get_functiondef, read 2026-10-18).**
   - The end target is `array_agg ... FILTER (eff_end = max(eff_end))` on plain `time`, applied only when `v_new_end IS DISTINCT FROM v_cur_end + v_delta`. `serverEndTargets` mirrors this exactly, nulls excluded.
   - Shape table:

     | shape | server target | endBoxShown | right? |
     |---|---|---|---|
     | class 20-21 + party 21-02 | class | guard | yes |
     | two daytime (12-14, 14-16) | 2nd | box | yes |
     | one session | it | box | yes |
     | two ending together | both | guard | yes |
     | party 21-00 + after 00:30-04 | after | box | END yes; START wrong on the server (N1) |

   - Prod counts are in N6.
2. **Pick several.**
   - `shift = later ? n : -n` with n from 1 to 60: the payload is signed (M6 red).
   - `shiftPastProblem` = server `(occurrence_date + shift) < today` (London date) over eligible dates (M2 red).
   - `bulkShiftCommand` / `runBulkCommand` are untouched in the diff, so the envelope is unchanged.
   - The confirm title reads from `payload.shift_days`, so its words follow the sign.
   - The collision pre-check is still absent (FIX-PAR queued). See S1 and N4.
3. **Copy half-done.**
   - `sendAll` counts `applied` after each landed command, and moves `v` on before the next. `partial` is called only when `applied > 0`, and a version conflict still goes to the conflict screen.
   - `useOwnerCommand` invalidates the workspace, the home and the date detail on each success. So after a half-done copy, `detail.version` and `copyPatches` refresh: a retry sends only what is left, against the new version.
   - Mutants M3 and M9 go red.
4. **Stop repeating vs `_cmd_series_stop_repeating_p5`.**
   - The server deletes or cancels scheduled dates after today that are not in keep and where `NOT _occurrence_is_curated_v1`. `stopLine` matches that, apart from the gap in N3 (M4 red).
   - NO_COMING shows on the One event row, on `?do=stop` and on Pick several. Each has an Add a date link (M5 red; walk `stop-none-01`, `pick-none-01`).
5. **One name per action.**
   - The only "Put back" left in organiser source is in comments. The visible labels are `PUT_IT_BACK` (DateSheet, DatesTakenOff), plus OneEvent's own literal "Put it back".
   - DateSheet and Change's Take off both render `TAKE_OFF.body` and `TAKE_OFF.undo`.
   - `A1_APPLIED` (false) still gates every Go live / Move offer:
     - `lifecycleModel.ts:40`, `:71`: Go live always carries a reason (GO_LIVE_READY or A1_REASON).
     - `Day.tsx:31`: Move refused.
     - `WhatChanges.tsx:38`: the Move row is hidden.
     - `NewFlow.tsx:319` and `new/model.ts:53-66`: draft only.
   - Pick's bulk_shift is not an A1 path (the server allows `_can_act_as_organiser_p5`). M7 red.
6. **Regression.** See the CI table and the mutation table.
7. **Walk.** See below.

## Mutation table (each applied alone, then `npx vitest run src/modules/organiser`, then reverted; the tree was clean after)

| id | rule | mutant | result |
|---|---|---|---|
| M1 | endBoxShown | `return true` | RED, 4 failed: `'class 20:00-21:00 + party 21:00-02:00': end box false` |
| M2 | shiftPastProblem | `addDaysToKey(d, -shiftDays)` | RED, 4 failed: `S1: a shift that lands a ticked date before today is refused...` |
| M3 | sendAll partial | drop the `partial(...)` branch | RED, 1 failed: `S3: the second set_override is refused: says which key was copied...` |
| M4 | stopLine curated | `stay = 0` | RED, 2 failed: `some curated after the cut`, `all curated after the cut` |
| M5 | eventActions NO_COMING | drop `comingCount === 0` arm | RED, 3 failed: `?do=stop with nothing coming is refused with NO_COMING...` |
| M6 | signed shift | `shift = n` | RED, 2 failed: `S8: Earlier / Later plus an unsigned number of days...` |
| M7 | GO_LIVE_READY | back to `${A1_REASON}.` | RED, 1 failed: `nothing missing, a1 off: the reason names what to do...` |
| M8 | serverEndTargets | every session is a target | RED, 5 failed: `'two daytime sessions': end box true` |
| M9 | copyHalfDone split | `slice(0, n + 1)` | RED, 1 failed: `S3: the second set_override is refused...` |
| M10 | Time `endGiven = endBox && ...` | drop `endBox &&` | GREEN (survives). Equivalent: in guard mode the end input is not rendered, so `end` stays `''`. No action. |

## CI table (sandbox, this head 6c33ffa)

| job / step | command | result |
|---|---|---|
| organiser unit | `npx vitest run src/modules/organiser` | 0: 108 files, 3329 pass, 2 skip |
| lint chain | `npm run lint` (after `chmod +x bin/*.sh .claude/hooks/*.sh` as CI does; reverted) | 0, every link PASS |
| build (perf-budget env) | `npm run build` with the workflow's placeholder Supabase env | 0 |
| perf | `check:bundle-budget`, `check:first-load-requests` | 0, 0 |
| build for walk | `VITE_ENABLE_ORGANISER_SELF_SERVE=true npm run build` | 0 |
| GitHub PR #809 checks on 6c33ffa | read through the GitHub connector | 24 success, 8 skipped (lighthouse, doc-weight, og/seo/synthetic previews, enable), 0 failed |

## Walk (390x844, production build, route-mocked organiser fake, throwaway spec, not committed)

Shots are in `docs/organiser-rebuild/walk-PARC/`. `scrollWidth` was 390 on every screen, for the document and the inner scroller. No tap target inside the organiser screens was under 44 px. The only hits were the site header/footer links outside the viewport and the 1x1 skip link.

| shape | screen | result |
|---|---|---|
| class+party night | Change time | PASS. No end box; END_GUARD + Open Sessions. 21:00 gives "Every session moves 1 h later", and the rows preview 21:00-22:00 and 22:00-03:00 (`time-classparty-01/02`). |
| one date 20:00-01:00 | Change time | PASS. End box shows. "Now 20:00-01:00 -> new 21:00-02:00"; end 02:30 gives "-> new 21:00-02:30" (`time-one-01/02`). |
| weekly, 12 coming | Pick several | Ticks and chips work, and Move stays off with the repeat reason (S1) (`pick-weekly-01/02/03`). |
| weekly, 12 coming | Stop repeating | PASS. "12 dates stay. No new dates after them."; picking the 3rd: "3 dates stay. 9 after them come off. ..." (`stop-weekly-01/02`). |
| festival | Change time | Full form shown, no refusal (N2) (`time-festival-01`). |
| 0 coming | `?do=stop`, Pick several | PASS. NO_COMING + Add a date on both. Pick also shows the dead action block (N4) (`stop-none-01`, `pick-none-01`). |

## Verified

- The prod bodies of `_cmd_occurrence_set_time_p5`, `_cmd_series_stop_repeating_p5`, `_occurrence_is_curated_v1`, `admin_bulk_occurrence_command_p5` and the `has_override` expression of `admin_event_workspace_p5`, compared line by line with the client rules.
- The prod shape counts in N1-N6 and S1: SELECT only, counts only.
- The ten mutants above, unit tests, lint, both builds and the perf checks, and the PR #809 check runs on the current head.
- The 390x844 walk of the five shapes on the production build.

## Not verified

- **Real-data writes:** none. No set_time, bulk_shift or stop_repeating was sent to prod, so N1 comes from reading the function body, not from a write.
- **The full unit suite, e2e-smoke and the live contract suites:** not run locally. They are green on GitHub for this head.
- **Devices:** no real phone, iOS number pad or screen reader.
- **The walk** used the route-mocked fake, not prod rows. The fake's shapes were matched to the prod shapes counted above.
- **Vercel:** no `VERCEL_TOKEN`, so the preview was not opened. Needs owner: Vercel token.
