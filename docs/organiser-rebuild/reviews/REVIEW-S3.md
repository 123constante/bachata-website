# REVIEW-S3 -- independent review of slice S3 (Add a date, Cancel a date, no dates left)

Reviewer: cloud worker, ticket dt_e2856e9aa9d9, 2026-10-17. Brief `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/R-S3.md` (blob b314102).
Slice head `origin/claude/org-r1-addcancel` @ `39f7db2` (PR #801); base `feat/organiser-r1` @ `9807a49` (S0a + S0b merged).
One pass, as the brief requires. Nothing in the slice was edited. Each mutant was applied to the working tree, run, and reverted (`git checkout <file>`, `git status` clean after each).
Prod reads: `stsdtacfauprzrdebmzg`, SELECT only (`pg_get_functiondef` and count aggregates), London today = 2026-10-17.

## Verdict: 2 BLOCKING / 3 SHOULD / 6 NOTE

| # | Sev | Where | One line |
|---|---|---|---|
| B1 | BLOCKING | `flows/cancel/Confirm.tsx:90`, `:127-152` | "Put it back" is refused by the server on every one of the 27 at-cap live series (the un-cancel date cap), and Done offers it anyway |
| B2 | BLOCKING | `flows/add/addModel.ts:26`, `:83-104`; `flows/add/WhichEvent.tsx:30` | A festival that already holds a date can never take another (`festival_extra_date`), but C7 lists it and C8 offers 30 days that all fail with the generic error (7 of 67 live) |
| S1 | SHOULD | `flows/add/Time.tsx:66-75` | When the second write (`occurrence.set_time`) fails, Done says the usual time and nothing tells the organiser that the time they typed was not saved |
| S2 | SHOULD | `flows/cancel/__tests__/cancel.flow.test.tsx` | No test that a cancel / put-back retry reuses its idempotency key, and no refusal test for either cancel write (date_cap on put back is untested) |
| S3 | SHOULD | `flows/add/WhichEvent.tsx:36`, `WhichDay.tsx:82` | At-cap series (27 of 67 live, all at 47+ dates): the open call, recommendation below |
| N1-N6 | NOTE | see below | |

## The four rulings

### Ruling 1: `flows/fix/NoDates*.tsx` not created, C15 reuses C8: ACCEPTABLE, the proof is mostly real

- 4.3 / the Owns row says C15 -> C15b -> C15c are "the SAME add screens with the event pre-chosen". Home's `no_dates_left` row already targets `ORG_PATHS.addEvent(id)` (S0b, `jobs/homeJobs.ts`), and C8 titles itself with the event name and nothing else (`WhichDay.tsx:70`). A `NoDates*.tsx` wrapper would render C8 with no difference, so it would be dead code. The Owns row lists a file the design does not need. Not creating it is right.
- The proof (`add.flow.test.tsx:198-219`): the row is read from the real `homeJobs()` with an all-cancelled series (R3-3 shape), its `to` is mounted, ONE `series.add_date` is asserted by the rpc spy, and the next `homeJobs()` has no `no_dates_left` row. Mutant (a) turns this test RED too, so it is not decorative.
- Weak spot (N1): the "after" world is hand-written and DROPS the cancelled date `ox` (`world.occs[EMPTY] = [only the new date]`). Prod's after-state keeps it. Keep `ox` in the after-state so the test proves "a cancelled date plus one new scheduled date = no row".

### Ruling 2: no pick sends `'Other'`, and "Other" is not offered as a chip: CORRECT

Prod `apply_aggregate_write_p5` lines 140-145:
```
-- The handler maps a missing or unknown reason to 'Other' silently; an owner's
-- cancellation must name one of the offered reasons. Un-cancel needs none.
IF (v_req_payload ->> 'cancelled')::boolean
   AND NOT public._owner_cancellation_reason_ok_p5(v_req_payload ->> 'reason') THEN
    RAISE EXCEPTION 'permission_denied: occurrence.cancel needs a reason that is a cancellation_reasons label'
```
`_owner_cancellation_reason_ok_p5` is an exact match on a label with `archived_at IS NULL`. Live labels (5, none archived): Bank holiday, Low signups, Other, Teacher unavailable, Venue closed. `Other` is live (count 1). Owner cancel keys are `['cancelled','reason']` (line 37), and the slice sends exactly those.
- So the optional-reason UI MUST send a label, and `Other` is the server's own fallback word. Not offering "Other" as a chip is right: tapping "Other" would send the same payload as not tapping anything.
- `fetchCancellationReasons` filters `archived_at IS NULL` and orders by `sort_order`, so the chips match the server's accepted set.
- Risk to record: if an admin ever archives "Other", every reason-less owner cancel is refused. A guard belongs in admin (not this repo); flag it to the A-track.

### Ruling 3: a changed time costs TWO writes: ACCEPTABLE, with S1

- Prod `_cmd_series_add_date_p5` reads `p_payload->>'date'` only, inserts with no time, then `_recompute_occurrence_headline_time_from_sessions_v1`. It returns `{occurrence_id}`, which the dispatcher wraps as `{ok, data:{occurrence_id}, new_version, audit_id}` (`_command_result_ok_p5`). So `added.data.occurrence_id` (`Time.tsx:67`) is what prod sends. The workspace-re-read fallback is dead on prod, but harmless.
- An untouched time is exactly ONE command: `add.flow.test.tsx:123-137` asserts `toHaveLength(1)` AFTER Done renders. Mutant (a) turns it RED (below). This avoids S2's B1 class: the assertion runs after the awaited send, so it can fail.
- A failed second write (S1): Done is truthful (the date exists at the usual time), but the organiser typed 19:30 and gets "Added - Tuesday 27 October, 20:00" with no word that 19:30 did not save. That is the same class as the 2026-10-08 "copy that does not match what happened" lesson.

### Ruling 4: Add through `useOwnerCommand`; `series.*` -> `series_command_p5`, `occurrence.*` -> `occurrence_command_p5` on the date's own version: CORRECT

- `series_command_p5` / `occurrence_command_p5` (792 / 772 bytes) are the same thin dispatchers REVIEW-S2 Ruling 1 read. `series.add_date`, `occurrence.cancel` and `occurrence.set_time` are all in `v_owner_kinds` (lines 17-22).
- `useOwnerCommand` routes on `command.kind.startsWith('series.')` (`shared/useOwnerCommand.ts:45`). Add sends `series_command_p5`, target = series, `expected_version` = the workspace series version (test asserts 9). Cancel and put back send `occurrence_command_p5`, target = the date, version = `event_view_p5`'s `version` (tests assert 6, then 7 after the cancel's `new_version` lands in the cache).
- `useOwnerCommand` over `useRunCommands` for add is the better choice: `useRunCommands` does not return the reply `Time.tsx` needs for `occurrence_id`.

## Findings

**B1 (BLOCKING) "Put it back" cannot work on any at-cap series.**
Prod `_cmd_occurrence_cancel_p5` lines 62-91 (A0a) cap the UN-cancel:
`IF v_upcoming >= 30 THEN RAISE EXCEPTION 'permission_denied: date_cap: this series already has % upcoming dates (cap 30); remove or cancel one before restoring another'`.
- On prod (counts, 2026-10-17): 27 of 67 live series hold 30 or more coming scheduled dates, and the SMALLEST of them holds 47. After a cancel, every one of them still holds 46 or more. So the Done screen's second button (`Confirm.tsx:90`, D61) and the C13 already-cancelled screen (`:127-152`) offer a control the server always refuses there.
- What the organiser sees: `commandErrorMessage` maps `date_cap` to "No new date can be added while 30 or more upcoming dates are listed ... Cancel or remove an upcoming date first". The organiser just cancelled a date, so this copy is wrong for a restore. It also points at a fix (cancel another date) to get one date back.
- 1 live at-cap series already has a cancelled coming date, so the direct C13 path is live today.
- The DoD says "a control that cannot work is disabled with a reason". No test covers a put-back refusal.
- **Fix:** read the cap before offering the restore. With N = coming scheduled count AFTER the cancel (or now, for an already-cancelled date), when `N >= MAX_UPCOMING`, Done passes no `next` and C13's Put it back is `aria-disabled` with `CAP_NOTE` as its reason. Add a table row for that (fixture at 47 coming), and a `date_cap` refusal test whose message is not the add-date copy.

**B2 (BLOCKING) Festivals are offered days that the server always refuses.**
Prod `_cmd_series_add_date_p5` (migration 20260905050000): `IF format = 'festival' ... IF v_other_dates > 0 AND v_same_date = 0 THEN RAISE 'invalid_transition: festival_extra_date: ... a festival holds ONE date'`.
- On prod: 7 live festivals, all 7 already hold a date. 1 of them has no coming date, so its Home `no_dates_left` row leads to C8, and every one of its 30 days fails.
- `canAddTo` (`addModel.ts:26`) checks status only. `addDays` / `addDayGate` (`:83-104`) never look at `format`. `selfServeErrors.ts` has no `festival_extra_date` entry, so the tap shows the generic error.
- No fixture or test has a festival.
- **Fix:** add `format === 'festival' && the series holds any date` to `addDayGate` and `addDays` (every day `aria-disabled`, with a short reason such as "A festival has one date"), and have C7 show it on the row. Add a festival row to the matrix. Whether Home's `no_dates_left` row should send a festival elsewhere is S1's / homeJobs' call: record it there.

**S1 (SHOULD) A failed time write is silent.** `Time.tsx:66-75`: when `send(..., setTimeCommand)` returns null, the error line is set, but `goDone` navigates away at once, so the organiser never sees it. Done then says the usual time.
- `fetchDateDetail` throwing (`:72`) is different: `run`'s catch shows the error, there is no Done, and a second Save replays the add by its key (server line 342) and tries the time again. That path is fine.
- **Fix:** when the time write fails, end on Done with a message that names the saved time AND that the new time did not save (or stay on C9 with the error and a "Done" way out). One test with the second call failing.

**S2 (SHOULD) The cancel side's retry and refusal paths are untested.** Mutant (b) is RED only through the ADD test (`add.flow.test.tsx:183-196`). `useFlowSend` is shared, so cancel's key reuse holds by construction, but no cancel test pins it. No cancel test makes either write fail with a non-conflict error, so the error line is never asserted. **Fix:** one row: first `occurrence_command_p5` returns `{ error: { message: 'network' } }`, tap again, assert two calls with the same `idempotency_key` and the error line between them. Add a second row with `date_cap` on put back (pairs with B1).

**S3 (SHOULD) Open call: at-cap series in C7. Recommendation only, not a decision.**
Prod: 27 of 67 live series are at the cap, holding between 47 and 59 coming scheduled dates (0 hold exactly 30). C7 already shows `CAP_NOTE` on their row (`WhichEvent.tsx:36`), and C8 shows 30 disabled rows with the same note.
- *Keep (today):* the row says why before the tap. The tap then opens a screen of 30 disabled rows, which is 30 times the same sentence and no action.
- *Disable the row in C7* (`reason = CAP_NOTE`, `aria-disabled`, the same `StepRow` mechanism): no dead-end screen. A URL to C8 keeps the per-day refusal.
- **Recommendation:** disable the C7 row with `CAP_NOTE` (the D35 "a control that cannot work is disabled with a reason" rule), and on C8 at the cap show ONE refusal (`Refusal` with `CAP_NOTE` and "Back to Home") instead of 30 disabled rows. Hiding the row is worse: the organiser would not learn why that event is missing. If the one-event organiser is at the cap, D34's skip lands on that single refusal, which is acceptable.

**N1 (NOTE)** The C15 test's after-state drops the cancelled date (Ruling 1). Keep it.

**N2 (NOTE) The put-back comment overstates.** `cancelModel.ts:6` says put-back "replaces itself with Done, so Back or a reload never sends twice". `goDone` (`flows/doneState.ts:20`) pushes and does not replace.
- What happens: Back from "Back on" Done lands on `?put=back` again. The date is now scheduled, so the form shows and nothing is sent. That holds.
- But after a FAILED put back, a reload of `?put=back` (or a shared or bookmarked copy of that URL) sends again on arrival with a new key.
- Low risk. Fix the comment, or `navigate(..., { replace: true })` the put-back hop.

**N3 (NOTE) Mutant (c) as briefed hangs the suite instead of failing it.** With the `fired` guard removed, the effect (which has no dependency list, `Confirm.tsx:136-142`) loops: `cancel.flow.test.tsx` never finishes, and `timeout 200` killed the run. That is a real red in CI (a job timeout), but not an assertion. The equivalent clean mutant (two sends in one effect) is caught by an assertion (below). Give the effect a dependency list (`[auto]`) so a later edit fails fast.

**N4 (NOTE) C13 for a paused series reached by URL.** `Confirm.tsx:38` uses `dateLock` only. C12 refuses paused events (`seriesLock(..., 'cancel')`), but C13 opened directly shows the cancel form. The server allows an owner to cancel on a paused series, so this is consistent, not broken. Apply `seriesLock` for symmetry, or leave it.

**N5 (NOTE) DST.** `comingDays` walks London date keys with `addDaysToKey`, so there is no zone math. The fixtures straddle 25 October, today 2026-10-20 is frozen, and the add payload is the key itself (`payload: { date: day(7) }`). 28 March 2027 enters the 30-day window only from 26 February, so no test covers it. Wall-clock time (R3-18): `setTimeCommand(value)` sends the typed HH:MM. Nothing converts it.

**N6 (NOTE) Merge with S2.** A trial `git merge origin/claude/org-r1-change` (S2 @ 0852588) into scratch branch `scratch/s3-s2-trial` @ 39f7db2:
- `OrganiserRoutes.tsx`: 1 conflict, on adjacent lines. Take S2's `ChangeFlow` line and S3's `AddFlow` / `CancelFlow` lines. The `DonePage` import and route auto-merge into ONE copy (line 42, line 135).
- `routes.test.tsx`: 2 conflicts. Keep BOTH describe blocks (S3's add/cancel and S2's change), keep ONE `/done` test, and drop BOTH placeholder row sets (change rows and add/cancel rows).
- The merge was aborted, and nothing was committed from it.

## Files touched vs the S3 Owns row

`git diff --name-only 9807a49 39f7db2`: 20 files.
- **Owned:** `flows/add/**` (11), `flows/cancel/**` (8 incl. test), `docs/organiser-rebuild/handovers/S3.md`.
- **Outside the row, judged:** `shell/OrganiserRoutes.tsx` (route targets + `step` props + DonePage; needed, identical DonePage lines to S2) and `shell/__tests__/routes.test.tsx` (S3 rows replace placeholders; needed).
- **Protected files (00-COMMON + 4.11 READ-ONLY lists):** none. A grep of the diff list against every protected path came back empty.
- `flows/fix/NoDates*.tsx`: not created (Ruling 1).

## Boards check

| Board | Check | Result |
|---|---|---|
| C7 | live + draft, one qualifying skips (D34) | yes, tested. A festival is wrongly addable (B2) |
| C8 | 30 days from today minus EVERY held day (scheduled or cancelled, workspace list, not home_v1's 3) | yes (`addModel.ts:85`), mutant (d) RED |
| C8 | at the cap every day `aria-disabled` + `CAP_NOTE` sub-line, tap goes nowhere | yes, tested. Open call S3 |
| C8/C9 by URL | past day (`eventState.ts:75` verbatim), held day, capped day, malformed day refused | yes (`addDayGate`). Past and held are tested, capped by URL is not (covered by the same gate) |
| C9 | prefilled usual time; untouched = ONE `series.add_date` | yes, mutant (a) RED |
| C11/C12 | live with a coming scheduled date; C12 SCHEDULED only; none -> "No dates to cancel" + ONE action | yes, mutant (e) RED |
| C13 | only `WARN_DATE` importer | yes, the import-site test asserts exactly `flows/cancel/Confirm.tsx` |
| C13 | gold "Cancel this date", quiet "Keep it", optional reason | yes (Ruling 2) |
| Done | two buttons after a cancel; Put it back = ONE `occurrence.cancel {cancelled:false}`; final Done one button | yes, clean mutant (c') RED. Server refuses on at-cap series (B1) |
| C13 direct | already-cancelled date shows Put it back, not a second cancel | yes, tested |
| R3-7 | `version_conflict` -> `VERSION_CONFLICT` + one button to the event | yes, tested in both flows |
| D49/D61 | no Undo | none anywhere |
| 44px | `StepRow` 52px, time input 52px, Keep it 44px | the `tooSmall` checks pass |

## Mutation evidence

Command: `npx vitest run src/modules/organiser/flows/add src/modules/organiser/flows/cancel` (baseline with `shell`: 8 files, 93/93 green).

| Mutant | Change | Result |
|---|---|---|
| (a) two commands on the untouched-time path | `Time.tsx:66` `if (value && value !== usual)` -> `if (value)` | RED, 2 fail: "prefills the usual time; Save sends exactly ONE series.add_date" `expected [ …(2) ] to have a length of 1 but got 2`; "C15 ... ONE add" |
| (b) key regenerated on retry | `useFlow.ts` drop `if (!keys.current.has(sig))` | RED, 1 fail: "a retry after a lost reply reuses the idempotency key" `expected 'a27ebb55-…' to be '4518844f-…'` |
| (c) put back sends twice (as briefed: drop the `fired` guard) | `Confirm.tsx` `if (auto && !fired.current)` -> `if (auto)` | cancel suite HANGS (render/send loop) and is killed by `timeout 200`. Add suite 13/13 green (N3) |
| (c') put back sends twice (clean) | `Confirm.tsx:140` `void putBack();` -> `void putBack(); void putBack();` | RED, 1 fail: "the Done screen has exactly two buttons; Put it back sends ONE uncancel" `expected [ …3 ] to have a length of 2 but got 3` |
| (d) cancelled held day not excluded from C8 | `addModel.ts:85` held = scheduled dates only | RED, 1 fail: "shows 30 days minus every day holding a date" `to have a length of 27 but got 28` |
| (e) C12 includes cancelled dates | `addModel.ts:53` `lifecycle_status: 'scheduled'` | RED, 2 fail: "lists coming SCHEDULED dates only", "an all-cancelled event shows No dates to cancel" |

All reverted. `git status` was clean after each one.

## Real data (prod, counts only, 2026-10-17)

| Shape | Count |
|---|---|
| live series | 67 (draft 6) |
| live, 0 coming scheduled | 17 (author: 16 on 10-16; one more ran out) |
| live, 1-29 coming scheduled | 23 |
| live, exactly 30 | 0 |
| live, more than 30 (at the cap) | 27, smallest 47 (author: 27, matches) |
| live with ONLY cancelled coming dates (R3-3) | 1 (matches) |
| max days held (any status) in a 30-day window | 5 (matches) |
| live festivals / holding a date / with no coming date | 7 / 7 / 1 (B2) |
| at-cap live series with a cancelled coming date | 1 (B1, direct path) |
| live `cancellation_reasons` labels | 5, "Other" live (Ruling 2) |

## CI per job (sandbox, slice head 39f7db2; base 9807a49 in a scratch worktree)

| Job | Command | Slice | Base |
|---|---|---|---|
| typecheck (info, full tsc) | `npm run typecheck` | exit 2, 96 errors, **0 in `flows/add` or `flows/cancel`** | exit 2, 96 errors (same count) |
| typecheck | `npm run check:rpc-typing` | 0 | - |
| typecheck | `npm run check:wallclock-brand` | 0 | - |
| architecture-guard | `npm run lint:architecture` | 0 | - |
| integrity | `npm run check:mojibake` | 0 | - |
| lint | `npm run lint` | 1: 17/18 links pass. `check:integrity` exits 126, `bin/check-integrity.sh: Permission denied`, because the file is mode 100644 in git (pre-existing, not S3). `bash bin/check-integrity.sh` gives 0 ("1758 files checked, 0 issues"). eslint link skipped by the chain | - |
| perf-budget | `npm run build` | 0 | - |
| perf-budget | `npm run check:bundle-budget` / `check:first-load-requests` / `check:chunk-cycles` | 0 / 0 / 0 | - |
| unit-tests | `npm run test:unit` | 1: 8647 pass, 15 fail in 4 files: `eventViewCompat.contract`, `occurrenceProgram.contract`, `publicEventPageLineup.contract` (live-DB contracts) and `integrityCouldNotRun` (sandbox TS-helper precondition) | the same 4 files, the same 15 fail |
| unit (slice) | `npx vitest run src/modules/organiser/flows/add src/modules/organiser/flows/cancel src/modules/organiser/shell` | 0, 93/93 | - |

Could not run: e2e-smoke (no Docker-free organiser login; the author's run showed 5 pre-existing failures on base and slice), types-drift (`gen:types` needs DB credentials; S3 changes no type), a real phone.

## Verified
- The four rulings, against live `pg_get_functiondef` of `apply_aggregate_write_p5`, `_cmd_series_add_date_p5`, `_cmd_occurrence_cancel_p5`, `_owner_cancellation_reason_ok_p5`, `_command_result_ok_p5`, and the `cancellation_reasons` table.
- Five briefed mutants plus one clean variant: every one is caught. (c) as briefed is caught only by a hang (N3).
- File scope and protected files. The trial merge with S2 needs three hand resolutions, all mechanical (N6).
- The prod shape aggregate, re-run: it matches the author's except one more series with no dates left.

## Not verified
- No browser walk at 390x844 (no organiser login in this sandbox), and no write against the E2E project. B1 and B2 are read from the handler source, not observed on the wire.
- e2e-smoke not run (the author ran it: base and slice have the same 5 pre-existing failures).
- `/code-review` not run (a worker cannot get it typed).
- Vercel preview: not checked (no VERCEL_TOKEN use needed for a docs-only review).
