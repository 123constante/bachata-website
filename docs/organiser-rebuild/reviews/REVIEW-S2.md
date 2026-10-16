# REVIEW-S2 -- independent review of slice S2 (Change a date)

Reviewer: cloud worker, ticket dt_6b8f58dbdaa1, 2026-10-16. Brief `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/R-S2.md`.
Slice head `origin/claude/org-r1-change` @ `0798541`; base `origin/feat/organiser-r1` @ `9807a49` (S0a + S0b merged).
One pass, as the brief requires. Nothing in the slice was edited. Mutants were applied to the working tree, run, and reverted (`git status` clean after each).

## Verdict: 3 BLOCKING / 3 SHOULD / 6 NOTE

| # | Sev | Where | One line |
|---|---|---|---|
| B1 | BLOCKING | `flows/change/__tests__/change.flow.test.tsx:236-248` | The untouched-Save test cannot fail: it checks the spy before the async send lands (mutant (b) stays green) |
| B2 | BLOCKING | `flows/change/useChange.ts:711-716` + tests | No test pins "a retry reuses its idempotency key" (mutant (g) stays green) |
| B3 | BLOCKING | `home/index.tsx:167` (effect of `shell/OrganiserRoutes.tsx:760`) | Home's line-up strip now opens C4, which has no line-up control |
| S1 | SHOULD | `flows/change/Venue.tsx:245-249` | `save()` is not in a try/catch, so a failure in `venueOverridePatch` is an unhandled rejection with nothing on screen |
| S2 | SHOULD | `flows/change/WhatChanges.tsx:298` | "Move to another day" fails for every tap on prod until A1 ships `occurrence.move_date` (not in `v_owner_kinds` yet) |
| S3 | SHOULD | `flows/change/WhichDate.tsx:326` + `changeModel.ts:460` | C3 stops at 14 dates; 30 of 67 live series have more (open call, recommendation below) |
| N1-N6 | NOTE | see below | |

## The four rulings

### Ruling 1: commands through `useOwnerCommand(seriesId)` -> `occurrence_command_p5`, the date's own version: CORRECT

What prod says (read-only `pg_get_functiondef`, `stsdtacfauprzrdebmzg`, 2026-10-16):

- `series_command_p5`: `IF v_kind IS NULL OR NOT v_kind LIKE 'series.%' THEN RAISE EXCEPTION 'invalid_payload: series_command_p5 expects command.kind starting with "series."'`. The brief's literal route (`useRunCommands` -> `runSeriesCommand`) would refuse all three writes. `occurrence_command_p5` is the same dispatcher with `'occurrence.%'`.
- `apply_aggregate_write_p5` line 486-498: for an occurrence target it locks the series row, then `SELECT version ... FROM public.event_occurrence_p5 WHERE id = v_target_id`, then `IF v_expected_ver IS NOT NULL AND v_current_ver <> v_expected_ver THEN RAISE EXCEPTION 'version_conflict: expected %, got %'`. So the check uses the occurrence's own version.
- Where the version comes from: `event_view_p5({occurrence_id})` -> `_compute_effective_occurrence_p5` line 202 `'version', v_occ.version`. That is the same `event_occurrence_p5` row the write compares against. `parseDateDetail` reads `o.version` (`shared/seriesModel.ts:150`). (`admin_event_workspace_p5` also carries `o.version` per date: a second source that agrees.)
- A stale version gives `version_conflict`. `useChangeSend` maps it through `isVersionConflict` to `<Conflict>`: `VERSION_CONFLICT` plus one button to `ORG_PATHS.event(seriesId)` (R3-7). The test `version_conflict renders the R3-7 copy with one button to the event` covers this.
- Idempotency key: `envelope()` always sends one, and `useChangeSend` keeps one key for each command signature so a retry reuses it. Server line 340-342: a key that already succeeded replays `response_payload` and nothing is stored for a refusal, so reusing the key is safe. **No test pins the reuse. That is B2.**

**S3 (cancel/add):** `occurrence.cancel` / `occurrence.cancel {cancelled:false}` MUST take the same route: `useOwnerCommand(seriesId)`, `targetId` = the date, `version` = the date's `event_view_p5` / workspace version. `useRunCommands` will refuse them. `series.add_date` and `series.unskip_date` stay on `useRunCommands` with the series version. **Action for the orchestrator:** amend 4.3 #6 / #11 and the S3 brief to say "occurrence.* -> `useOwnerCommand`, target = occurrence, the occurrence's version; series.* -> `useRunCommands`".

### Ruling 2: `dates/DateSheet|DatePreview|index` kept on `/change/:s/:o/lineup`: CORRECT

Plan 4.2 makes the line-up/session editor must-keep ("R1 reaches the line-up/session editor from C37 Details as a row, it does not redraw it"). `dates/index.tsx` is that editor's page and `organiser-date.spec.ts` / `organiser-layout.spec.ts` test it. Deleting it would break must-keep behaviour. The brief's "once nothing imports them" condition is not met, because the route still imports it.

The `events/EditorRows.tsx` change is minimal: 2 lines, `ORG_PATHS.date` -> `ORG_PATHS.dateLineup`, and two test expectations follow it. Without this change the event's date rows would land on C4, because the base route `change/:s/:o` used to be `DatePage`. Acceptable, and S5 should keep this link when it rewrites the file.

It also has a side effect the slice missed: B3.

### Ruling 3: C5 "current time" = the date's own `materialised_start_utc`: CORRECT (harmless on prod; the diagnosis is off)

On prod, `event_view_p5`'s `schedule.local_start_time` is NOT session-derived. `_compute_effective_occurrence_p5` line 237 reads `COALESCE((v_occ.materialised_start_utc AT TIME ZONE 'UTC')::time, v_series.default_local_start_time)`. So both sources give the same value on every prod date. The 19:00/20:00 mismatch on the walk came from `organiserFake`, whose `schedule` disagrees with `occurrence`.

The choice is still right: C3 and C5 now read one field through one mapping (`localAsZTime`), and mutant (h) proves a test pins it.

Prod shapes:
- 1 live coming date has its own time different from the series default (a date that has already been time-edited). It reads correctly under either source.
- Separately, `_cmd_occurrence_set_time_p5` (lines 115-161) anchors on the date's EARLIEST SESSION start (`v_delta := v_new_start - v_cur_start`), not on `materialised_start_utc`. 3 of 1,541 coming scheduled dates (3 series) have an earliest session start different from the date's own time. On those dates, "Moved to 21:00" is still true of the first session, but typing the session's current start sends a command that changes nothing. See N3.

### Ruling 4: Done route wired to `flows/Done.tsx`; `version_conflict` rendered in the step: ACCEPTABLE

- 4.3 #11 is the `useRunCommands` / `useEventWorkspace` move (4.11 COLLISION line), not a Done variant list. The Done contract is 4.3 #4 as amended by D49/D51: `DoneState { title, message, seriesId, next? }`, "Back to Home" plus an optional `next`.
- `flows/Done.tsx` / `doneState.ts` match that exactly. S2 passes no `next`, so its Done shows one button and no Undo (D49). The D29 lines `Moved to HH:MM` / `Different venue - <Weekday D Month>` / `Moved to <Weekday D Month>` come from `changeModel.ts:487-489`.
- R3-7 says "Done variant ... with one button to the event". `DoneState` has no variant and its only second button is labelled `NEXT_LABEL = 'Put it back'`, so the conflict screen can't be expressed through Done without changing S0b's pinned interface. Rendering it in the step (`parts.tsx:581-591`, `VERSION_CONFLICT` + one button "Open the event" -> `ORG_PATHS.event`) meets R3-7's content.
- Wiring `DonePage` in `OrganiserRoutes.tsx` (S0a's file, 2 lines) is necessary: every flow ended on a placeholder. S3 will need the same lines, so the orchestrator must merge both without duplicating them (see N5).

## Findings

**B1 (BLOCKING) The untouched-Save test cannot fail.** `change.flow.test.tsx:236-248` clicks Save, then synchronously asserts `commands()).toHaveLength(0)`. `useOwnerCommand`'s `mutationFn` runs on a later tick, so a Save that DOES send is invisible to this assertion.
- Mutant (b) (`parts.tsx:615` `if (ready && !busy)` -> `if (!busy)`) stays GREEN, 38/38.
- With `await new Promise((r) => setTimeout(r, 50));` before the assertion, the same mutant goes RED (`expected [ …(2) ] to have a length of +0 but got 2`), and the unmutated code stays GREEN (38/38).
- **Fix:** add that flush (or `await act(async () => {})` plus a `waitFor`-free settle) before each `toHaveLength(0)` in this test, and keep the venue Save test to the same rule.

**B2 (BLOCKING) Idempotency reuse is untested.** `envelope()` (`shared/seriesCommands.ts:141`) always adds a fresh key, so the flow test's `typeof idempotency_key === 'string'` passes whether or not `useChangeSend` reuses its key.
- Mutant (g) (`useChange.ts:716` `idempotencyKey: keys.current.get(sig)` -> `undefined`) stays GREEN, 38/38.
- **Fix:** add a flow test where the first `occurrence_command_p5` call returns a non-conflict error (e.g. `{ error: { message: 'network' } }`), Save is tapped again, and the test asserts two calls with the SAME `idempotency_key`.

**B3 (BLOCKING) Home's line-up strip points at a screen with no line-up.** `home/index.tsx:167` (`home-strip-lineup`, the text says a date has no line-up) and `:33` (`home-date-row`, "Opens the date editor") navigate to `ORG_PATHS.date(...)`. That legacy-redirects to `/change/:s/:o`.
- On the base, that route was `DatePage` (the line-up editor). S2 makes it C4 (`OrganiserRoutes.tsx:760`), which offers time / venue / day and no line-up.
- e2e: `organiser-home.spec.ts:57` (the line-up strip) is flaky-green on the base and red on both tries on the slice. It lands on C4 and `org-page-date` never shows (CI table).
- The handover notes the date-row change and leaves it to S1. But on `feat/organiser-r1` after an S2 merge, the line-up strip's text points at a control that is not on screen, and that holds until S1's rewrite lands.
- **Fix (one sentence):** point `home-strip-lineup`'s `onPress` (and preferably `DateRow`) at `ORG_PATHS.dateLineup(...)`, the same one-line precedent as `EditorRows.tsx`, OR have the orchestrator merge S1 before or with S2 and record that order.

**S1 (SHOULD) Venue save can fail silently.** `Venue.tsx:245-249`: `save()` awaits `venueOverridePatch(...)` OUTSIDE `useChangeSend`'s try/catch, and `onSave={() => void save()}` discards the rejection. `resolveCreateCityId` catches its own resolver errors, so the risk is low. But any throw there (or in `overrideCommand`, which throws on an empty patch) leaves Save doing nothing visible. **Fix:** wrap the body of `save` in try/catch and surface `commandErrorMessage(err)` through the same `error` line.

**S2 (SHOULD) "Move to another day" cannot work on prod yet.** Prod `v_owner_kinds` (`apply_aggregate_write_p5` lines 17-22) has no `occurrence.move_date`, so every C5c tap is refused (`permission_denied`) and shows the generic error. The DoD says "a control that cannot work is disabled with a reason".
- **Fix:** make A1 (with `move_date`) a recorded hard merge/deploy gate for S2 in 4.6/4.8. If it can't be, hide the C4 row behind a flag until A1 is on prod.
- Also, R3-18 (20:00 on 24 Oct -> 31 Oct stays 20:00) is untestable from this repo until then. The Website side is correct: the payload is the wall-clock `to_date`, pinned by mutant (f).

**S3 (SHOULD) C3 is capped at 14 dates. Open call; recommendation, not a decision.** Prod (counts, 2026-10-16): of 67 live series, 16 have 0 coming scheduled dates, 16 have 1-3, 5 have 4-14, and **30 have more than 14** (max 59). A date beyond the 14th cannot be reached from Change a date.
- *"N more" row* (`moreDatesCount` already exists in `dateList.ts`). Cost: one more row and a second state for C3 (expanded or paged), one more test row, and a sentence-free label ("12 more"). The screen stays short by default.
- *Higher limit* (e.g. `comingDates(..., 60)`, or no limit since the workspace read already holds them). Cost: a list of up to 59 rows of 52px (~3,000px of scroll on a phone) for the 30 weekly series. No new state, and a one-argument change.
- **Recommendation:** raise the limit to cover the full workspace list (60 covers today's max of 59, and the read already returns every coming date). A weekly organiser looking for a date 3 months out scrolls a list sorted by date, which a date list is built for. Add "N more" only if a later board asks for a short C3. Either way, add a test row with more than 14 dates.

**N1 (NOTE) `DateStep`'s `needsDetail` prop is never passed `false`** (`DateStep.tsx:78`). It is dead and can be dropped.

**N2 (NOTE) A paused series' C3 reached by URL shows "No coming dates" + "Add a date"** (`WhichDate.tsx:326` filters on `live`). That is not reachable from C2, so it is low risk. A refusal would read better.

**N3 (NOTE) `set_time` anchors on the first session start** (Ruling 3). On the 3 prod dates where that differs from the date's own time, the untouched check compares against the wrong anchor. No R1 action; record it for the S8 matrix.

**N4 (NOTE) `organiserFake`'s `schedule.local_start_time` disagrees with `occurrence.materialised_start_utc`.** On prod both come from the same column. Make the fake mirror prod so that later walks don't chase this again.

**N5 (NOTE) Merge reconciliation.** `OrganiserRoutes.tsx` (DonePage wiring) and `paths.ts` (`dateLineup`) are S0a files. S3 will also wire DonePage, so the orchestrator should keep exactly one `DonePage` import and route.

**N6 (NOTE) The legacy URL `/events/:s/dates/:o` now lands on C4, not on the line-up editor.** That matches `legacyPaths.ts`' documented mapping (S0a), but a bookmark of main's date editor no longer opens the editor. This is an owner call: map it to `dateLineup` if line-up bookmarks matter.

## Files touched vs the S2 Owns row

`git diff --name-only origin/feat/organiser-r1...origin/claude/org-r1-change`: 24 files.
- **Owned:** `flows/change/**` (15), `docs/.../handovers/S2.md`.
- **Outside the row, judged:**
  - `shell/OrganiserRoutes.tsx`: needed (route targets, `/lineup`, Done wiring).
  - `shell/paths.ts` +1 key with `paths.test.ts`/`routes.test.tsx`: needed.
  - `events/EditorRows.tsx` (2 lines) + `editor.matrix.test.tsx`/`pages.test.tsx` (URL only): minimal, needed (Ruling 2).
  - `tests/e2e/organiser-date.spec.ts` / `organiser-layout.spec.ts`: URL edits only.
- **Protected files (00-COMMON list + 4.11 READ-ONLY list):** none touched. Every outside path above was compared against the list by hand.
- `dates/**`: untouched in behaviour, as the brief requires.

## Boards check (C2..C5c, Done)

- **URLs as steps:** yes. Six routes, one lazy chunk (`flows/change/index.ts` -> `ChangeFlow`).
- **One-event skip (D34):** `WhichEvent.tsx:377` `Navigate replace`. Tested.
- **C3 uses the full workspace list, not home_v1's 3:** `changeModel.ts:445-461`. Tested. Capped at 14 (S3).
- **Past date:** `dateGate` -> `dateLock()` (`eventState.ts:75` text, read from the function, not copied). Tested on 4 routes; mutant (c) RED.
- **Cancelled date:** refused (`changeModel.ts:482`). Unit-tested.
- **Save:** `aria-disabled` with a visible reason ("Pick a new time" / "Pick a different venue"). The untouched-Save test is unsound (B1).
- **Undo:** none (D49). Done shows "Back to Home" only.
- **D28:** no sentences besides the `dateLock` refusal and `VERSION_CONFLICT`. Labels are short ("Not found", "No coming dates", "Did not load").
- **44px:** `StepRow` is `min-h-[52px]`. The time input is 52px. The `every control is a 44px+ target` table covers six screens.

## Exactly one command per path

| Path | Kind | Payload | Target / version | Test |
|---|---|---|---|---|
| Time | `occurrence.set_time` | `{new_local_start:"HH:MM", new_local_end:null}` (the server keeps the length: `_cmd_occurrence_set_time_p5` line 114/144) | date / date's version | table row + mutants (a),(d) |
| Venue | `occurrence.set_override` | `{venue_id, city_id}` via `venueOverridePatch`; the usual venue -> `{venue_id:null, city_id:null}` | date / date's version | table row + (a),(d) |
| Day | `occurrence.move_date` | `{to_date:"YYYY-MM-DD"}` (wall clock) | date / date's version | table row + R3-18 row + (a),(d),(f) |

The fixtures put one date on each side of 2026-10-25 (clock frozen on 2026-10-20). The R3-18 test moves a date by 8 days across 25 October and asserts `{to_date}` matches `^\d{4}-\d{2}-\d{2}$`.

## Mutation evidence

Command: `npx vitest run src/modules/organiser/flows/change/` with each mutant applied alone, then `git checkout -- src/modules/organiser/flows/change/` (runner `scratchpad/mutate.py`). Baseline: `npx vitest run src/modules/organiser/flows/change src/modules/organiser/dates src/modules/organiser/shell` -> **14 files, 269 tests passed**.

| Mutant | Change | Result |
|---|---|---|
| (a) two commands | `useChange.ts` calls `mutateAsync` twice | **RED** 4 failed: the 3 one-command rows + R3-18 |
| (b) untouched Save sends | `parts.tsx` `if (ready && !busy)` -> `if (!busy)` | **GREEN 38/38: B1.** RED with a 50 ms flush (`expected [ …(2) ] to have a length of +0 but got 2`) |
| (c) drop past-date refusal | `changeModel.ts` `if (lock)` -> `if (false && lock)` | **RED** 6 failed: 4 route rows + 2 dateGate units |
| (d) series version | Time/Venue/Day send `ws.series.version` | **RED** 3 failed: the 3 one-command rows |
| (e) held day offered | `moveDays` -> `comingDays({...series, next_dates: []}, today, 30, [])` | **RED** 2 failed: move-list flow + moveDays unit |
| (f) `to_date` as UTC instant | `moveDateCommand(new Date(d.date+'T20:00:00+01:00').toISOString())` | **RED** 2 failed: move row + R3-18 |
| (g) drop idempotency key | `idempotencyKey: undefined` | **GREEN 38/38: B2** |
| (h) C5 current from session start | `detail.start ?? localAsZTime(...)` | **RED** 1 failed: "one fact, one mapping" |

## Real-data shapes (prod `stsdtacfauprzrdebmzg`, SELECT only, counts only, 2026-10-16)

| Shape | Count | Test row? |
|---|---|---|
| Live series | 67 | n/a |
| ... 0 coming scheduled | 16 | yes (`No Dates` fixture, C2 filter) |
| ... 1-3 coming | 16 | yes (flow fixtures) |
| ... 4-14 coming | 5 | yes (`changeDates` past-3 unit) |
| ... more than 14 coming (max 59) | 30 | **cap only** (the unit asserts "at most 14"; no row for reaching the 15th: S3) |
| Live series with a cancelled coming date | 2 | yes (dateGate cancelled; moveDays skips a cancelled day) |
| Live series whose coming dates include one with its own time different from the series default | 1 (1 date) | yes ("one fact, one mapping") |
| Coming dates whose first-session start differs from the date's own time | 3 (3 series) of 1,541 | **none** (N3) |
| Live series with more than 100 dates in total (workspace `LIMIT 100`, `ORDER BY occurrence_date DESC`) | 1 | none needed: the newest 100 include every coming date |

## CI (sandbox, slice head `0798541`)

| Job | Command | Exit | Note |
|---|---|---|---|
| typecheck | `npm run typecheck` | 2 | 96 errors; **base `9807a49` also 96**; 0 in `flows/change`, `shell/`, `EditorRows.tsx` |
| unit-tests | `npm run test:unit` | 1 | 15 reds in 4 files, all outside the slice: `eventViewCompat` (5), `occurrenceProgram` (2), `publicEventPageLineup` (3) live-DB contracts, `integrityCouldNotRun` (5, sandbox). 8652 passed. The same list the author reported |
| unit (slice) | `npx vitest run src/modules/organiser/flows/change src/modules/organiser/dates src/modules/organiser/shell` | 0 | 14 files, 269 tests |
| lint | `npm run lint` | 1 | 17/18 links green; `check:integrity` exit 126 because `bin/check-integrity.sh` is committed `100644` (no exec bit, same blob on base); `bash bin/check-integrity.sh` -> 0. Not a slice failure |
| perf-budget | `npm run build` | 0 | |
| architecture-guard | `npm run check:mojibake` | 0 | |
| architecture-guard | `npm run lint:architecture` | 0 | |
| e2e-smoke (organiser) | `CI=1 npx playwright test` the 9 organiser specs of `test:e2e`, chromium | 1 | 59 passed, 2 flaky (organiser-date:32, :40, passed on retry), 5 failed: events:257, home:11, home:31, home:57, loop:14 |
| e2e on base | the same 5 on `9807a49` | 1 | events:257, home:11, home:31, loop:14 **fail on base too** (not this slice). **home:57 is only FLAKY on base (passes on retry) but fails both tries on the slice**: the line-up strip lands on `/account/o/change/<s>/<o>` (C4) and `org-page-date` never shows. This is e2e evidence for **B3** |
| types-drift | not run | n/a | needs gen-types credentials |

The author's handover says "5 reds, all red on the base too". That holds for 4 of the 5; home:57 is a slice regression (B3).

## Verified

- Prod `pg_proc` for ruling 1: the dispatchers, the occurrence version check, the idempotency replay, and the `move_date` absence.
- Prod `pg_proc` for ruling 3: the `event_view_p5` schedule source and the `set_time` anchor.
- Prod shape counts above (read-only, counts only).
- Slice tests are green. 8 mutants were run; 6 go red and 2 survive (B1, B2). The B1 test fix was proved red-on-mutant and green-on-code.
- CI steps as in the table, with typecheck compared against the base.

## Not verified

- No write against any database, prod or E2E (`occurrence.move_date` is not on prod; E2E `srrpvuxldthwumzrngla` not touched by this review).
- No browser walk or real phone by the reviewer; the author's 390x844 walk was not repeated.
- `types-drift` not run (needs gen-types credentials).
- The B2 test and the B3 / S1 fixes are described, not written (the reviewer does not fix).
